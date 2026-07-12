import json
from datetime import timedelta

import anthropic
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.activity import Activity
from models.trip import Trip

MODEL = "claude-haiku-4-5"

ITINERARY_SCHEMA = {
    "type": "object",
    "properties": {
        "days": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "activities": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "type": {"type": "string", "enum": ["indoor", "outdoor"]},
                                "time_slot": {"type": "string"},
                                "location": {"type": "string"},
                                "description": {"type": "string"},
                                "lat": {"type": "number"},
                                "lng": {"type": "number"},
                            },
                            "required": ["name", "type", "time_slot", "location", "description", "lat", "lng"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["activities"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["days"],
    "additionalProperties": False,
}


async def get_itinerary(trip_id: int, db: AsyncSession, user_id: int) -> dict:
    await _get_owned_trip(db, trip_id, user_id)

    result = await db.execute(
        select(Activity)
        .where(Activity.trip_id == trip_id)
        .order_by(Activity.day_date, Activity.time_slot)
    )
    activities = result.scalars().all()
    if not activities:
        return {"status": "not_generated"}

    days: dict[str, list[dict]] = {}
    for a in activities:
        days.setdefault(a.day_date.isoformat(), []).append({
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "time_slot": a.time_slot,
            "location": a.location,
            "description": a.description,
            "lat": a.lat,
            "lng": a.lng,
            "is_swapped": a.is_swapped,
        })

    return {"days": [{"date": d, "activities": acts} for d, acts in sorted(days.items())]}


async def generate_itinerary(trip_id: int, db: AsyncSession, user_id: int) -> dict:
    trip = await _get_owned_trip(db, trip_id, user_id)

    if not settings.anthropic_api_key:
        return {
            "status": "not_configured",
            "message": "AI itinerary generation requires ANTHROPIC_API_KEY in backend/.env.",
        }

    num_days = (trip.end_date - trip.start_date).days + 1
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    destination = trip.destination

    content = f'Plan a {num_days}-day {destination} itinerary for the trip "{trip.name}".'
    if trip.arrival_time:
        content += (
            f' The traveler lands in {destination} at {trip.arrival_time} on day 1 — '
            f'day 1 activities should start after that time.'
        )
    if trip.departure_time:
        content += (
            f' The traveler departs {destination} at {trip.departure_time} on the last day — '
            f'the last day should end well before that time.'
        )
    if trip.hotel_address:
        content += (
            f' The traveler is staying at {trip.hotel_address} — each day\'s activities '
            f'should form a sensible route starting and ending near this location, not '
            f'requiring long detours back to it partway through the day.'
        )
    if trip.original_plan:
        content += (
            f' The traveler already has some ideas for this trip — work around them where '
            f'reasonable rather than ignoring them: "{trip.original_plan}"'
        )

    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=(
                f"You plan {destination} travel itineraries. Prioritize the most iconic, "
                f"must-see landmarks in {destination} that a first-time tourist would want "
                f"to visit — do not skip famous landmarks in favor of only lesser-known "
                f"spots. Suggest a realistic mix of indoor and outdoor activities, 3-4 "
                f"activities per day, with specific time slots (e.g. '09:00 - 11:00') and "
                f"real {destination} locations. Each day's activities must be grouped by "
                f"geographic area and ordered into a sensible one-directional route — never "
                f"schedule a day that crosses the city, comes back, then crosses it again. "
                f"For every activity, also give its real approximate latitude and longitude "
                f"(as decimal degrees, e.g. lat 51.5194, lng -0.1270 for the British Museum) "
                f"— use your knowledge of the actual location, not a placeholder or the "
                f"city's center point."
            ),
            messages=[{"role": "user", "content": content}],
            output_config={"format": {"type": "json_schema", "schema": ITINERARY_SCHEMA}},
        )
    except anthropic.AuthenticationError:
        return {"status": "error", "message": "ANTHROPIC_API_KEY was rejected — check the key in backend/.env."}
    except anthropic.RateLimitError:
        return {"status": "error", "message": "Rate limited by Anthropic — try again shortly."}
    except anthropic.APIStatusError as e:
        return {"status": "error", "message": f"Anthropic API error: {e.message}"}
    except anthropic.APIConnectionError:
        return {"status": "error", "message": "Could not reach the Anthropic API."}

    text = next(block.text for block in response.content if block.type == "text")
    data = json.loads(text)

    await db.execute(delete(Activity).where(Activity.trip_id == trip_id))
    for offset, day in enumerate(data["days"][:num_days]):
        day_date = trip.start_date + timedelta(days=offset)
        for activity in day["activities"]:
            db.add(Activity(trip_id=trip_id, day_date=day_date, **activity))
    await db.commit()

    return await get_itinerary(trip_id, db, user_id)


async def swap_activity(trip_id: int, activity_id: int, swap_to: str, db: AsyncSession, user_id: int) -> dict:
    await _get_owned_trip(db, trip_id, user_id)
    # STUB — replace with real swap logic once weather-triggered swaps are built
    return {"status": "not_implemented", "data": {}}


async def _get_owned_trip(db: AsyncSession, trip_id: int, user_id: int) -> Trip:
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip
