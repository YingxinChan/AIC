import json
from datetime import date, timedelta

import anthropic
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.activity import Activity
from models.trip import Trip
from services import geocoding_service
from services.auto_swap_service import FORECAST_HORIZON_DAYS
from services.weather_rules import ACTIVE_RULES, RainRule
from services.weather_service import get_hourly_weather, get_weather_prediction

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
                                "weather_sensitivity": {
                                    "type": "array",
                                    "items": {
                                        "type": "string",
                                        "enum": ["view_dependent", "wind_exposed", "strenuous_outdoor", "beach"],
                                    },
                                },
                            },
                            "required": [
                                "name", "type", "time_slot", "location", "description",
                                "lat", "lng", "weather_sensitivity",
                            ],
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


async def _trip_rule_day_numbers(trip: Trip, db: AsyncSession) -> tuple[dict[str, list[int]], dict[int, str]]:
    """For each ACTIVE_RULES rule, which day numbers (1-indexed) within the
    forecast horizon already trigger it — so generation can steer away from
    planning a mismatched activity for those days directly, instead of
    relying entirely on the auto-swap job to fix it afterward. Days beyond
    the ~16-day forecast horizon return nothing here; those are exactly what
    the auto-swap job still handles once they enter range (or if the
    forecast changes after generation).

    Also returns a day_number -> human-readable rainy-hour-window mapping
    (e.g. "between 08:00 and 11:00"), populated only for heavy-rain (not
    thunderstorm) days where hourly data was available to identify a
    specific window. Days in this second dict get a targeted sentence
    telling Claude which hours to avoid instead of the blanket "plan only
    indoor activities" wording — letting it schedule around the rain
    directly when it first builds the itinerary, the same hourly data the
    swap job separately uses later to decide which already-scheduled
    activities are actually affected. Thunderstorm-triggered days, and
    heavy-rain days where hourly data wasn't available, are absent from
    this dict and keep the existing blanket wording via rule_day_numbers.
    """
    if trip.lat == 0.0 and trip.lng == 0.0:
        coords = geocoding_service.geocode(trip.destination)
        if not coords:
            return {}, {}
        trip.lat, trip.lng = coords
        await db.commit()

    today = date.today()
    horizon = today + timedelta(days=FORECAST_HORIZON_DAYS)
    window_start = max(today, trip.start_date)
    window_end = min(trip.end_date, horizon)
    if window_start > window_end:
        return {}, {}

    try:
        forecast_days = get_weather_prediction(
            trip.lat, trip.lng, window_start.isoformat(), window_end.isoformat()
        )
    except Exception:
        return {}, {}  # a weather fetch failure shouldn't block itinerary generation

    try:
        hourly_days = get_hourly_weather(
            trip.lat, trip.lng, window_start.isoformat(), window_end.isoformat()
        )
    except Exception:
        hourly_days = []  # no hourly data -> rain days fall back to the blanket sentence

    hourly_by_date: dict[str, list[dict]] = {}
    for entry in hourly_days:
        hourly_by_date.setdefault(entry["time"][:10], []).append(entry)

    rain_rule = RainRule()
    rule_day_numbers: dict[str, list[int]] = {rule.id: [] for rule in ACTIVE_RULES}
    rain_windows: dict[int, str] = {}
    for forecast_day in forecast_days:
        day_number = (date.fromisoformat(forecast_day["date"]) - trip.start_date).days + 1
        for rule in ACTIVE_RULES:
            if rule.day_triggers(forecast_day):
                rule_day_numbers[rule.id].append(day_number)

        is_heavy_rain_day = (
            forecast_day.get("heavy_rain_warning")
            and forecast_day.get("weather_code") not in RainRule.THUNDERSTORM_CODES
        )
        if is_heavy_rain_day:
            hourly_day = hourly_by_date.get(forecast_day["date"])
            if hourly_day:
                window = rain_rule.describe_rainy_window(hourly_day)
                if window:
                    rain_windows[day_number] = window

    return {rid: sorted(days) for rid, days in rule_day_numbers.items()}, rain_windows


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
            "alternate_name": a.alternate_name,
            "alternate_location": a.alternate_location,
            "swap_reason": a.swap_reason,
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

    # Scale the output budget with trip length — a fixed 4096 truncates
    # Claude's JSON mid-generation for longer trips (~10+ days), regardless
    # of destination. Capped at 16000 to stay within the non-streaming
    # request's safe timeout window; very long trips may still truncate,
    # but that now fails cleanly (see the try/except below) instead of a
    # raw 500.
    max_tokens = min(max(4096, num_days * 700 + 1500), 16000)

    destination = trip.destination

    content = f'Plan a {num_days}-day {destination} itinerary for the trip "{trip.name}".'

    rule_day_numbers, rain_windows = await _trip_rule_day_numbers(trip, db)
    for rule in ACTIVE_RULES:
        day_numbers = rule_day_numbers.get(rule.id, [])
        if not day_numbers:
            continue

        if rule.avoid_phrase is None:
            # Blanket rule (rain/thunderstorm). Days with a known specific
            # rainy-hour window (rain_windows) get their own sentence so
            # Claude can schedule around it directly; the rest (thunderstorm
            # days, or heavy-rain days where hourly data wasn't available)
            # keep the original whole-day wording, unchanged from before
            # targeted rules or hourly refinement existed.
            windowed_days = [d for d in day_numbers if d in rain_windows]
            blanket_days = [d for d in day_numbers if d not in rain_windows]

            for day_number in windowed_days:
                content += (
                    f' Day {day_number} has rain expected roughly {rain_windows[day_number]} — '
                    f'schedule outdoor activities outside that window where possible, or plan '
                    f'something indoor for it.'
                )

            if blanket_days:
                day_list = ", ".join(str(n) for n in blanket_days)
                day_word = "day" if len(blanket_days) == 1 else "days"
                that_day = "that day" if len(blanket_days) == 1 else "those days"
                content += (
                    f' Heavy rain is already forecast for {day_word} {day_list} of this trip — '
                    f'plan only indoor activities for {that_day}, not outdoor ones.'
                )
        else:
            day_list = ", ".join(str(n) for n in day_numbers)
            day_word = "day" if len(day_numbers) == 1 else "days"
            that_day = "that day" if len(day_numbers) == 1 else "those days"
            content += (
                f' {day_word.capitalize()} {day_list} may not be suitable for '
                f'{rule.avoid_phrase} — avoid planning those for {that_day} if possible.'
            )

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
            max_tokens=max_tokens,
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
                f"city's center point. "
                f"When weather conditions vary across the trip's days, prefer scheduling "
                f"weather-sensitive activities (beach, viewpoints, hikes) on the best-suited "
                f"days rather than a fixed order — rearrange which activities fall on which "
                f"day if that produces a better overall fit. "
                f"For every activity, also tag weather_sensitivity as a list — empty if none "
                f"apply. Use \"view_dependent\" only when the activity's main point is a view "
                f"or vista that bad visibility would ruin (e.g. a mountain viewpoint, a "
                f"rooftop observation deck) — not just any outdoor activity. Use "
                f"\"wind_exposed\" only for activities on open water or suspended/exposed "
                f"transport (e.g. a boat cruise, a cable car, a hot air balloon) — not a "
                f"regular outdoor walk. Use \"strenuous_outdoor\" only for genuinely "
                f"physically demanding activities done mostly outdoors (e.g. a multi-hour "
                f"hiking trail, a steep uphill walking tour) — not a short stroll. Use "
                f"\"beach\" only for literal beach or open-water swimming activities. An "
                f"activity can have multiple tags (a coastal hike could be both "
                f"\"strenuous_outdoor\" and \"view_dependent\") or none — a museum visit, an "
                f"indoor market, or a flat city walking tour touching none of these should "
                f"get an empty list, not a defensive guess."
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
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {
            "status": "error",
            "message": (
                "The itinerary response was cut off before it could be parsed — "
                "this usually happens on longer trips. Try a shorter date range, "
                "or generate it again."
            ),
        }

    await db.execute(delete(Activity).where(Activity.trip_id == trip_id))
    for offset, day in enumerate(data["days"][:num_days]):
        day_date = trip.start_date + timedelta(days=offset)
        for activity in day["activities"]:
            weather_sensitivity = activity.pop("weather_sensitivity", [])
            db.add(Activity(
                trip_id=trip_id, day_date=day_date,
                weather_sensitivity=",".join(weather_sensitivity),
                **activity,
            ))
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
