import asyncio
import json
from datetime import date

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.trip import Trip
from models.user import User
from services import email_service, email_templates, geocoding_service
from services.email_templates import SUMMARY_ICONS
from services.weather_service import get_weather_prediction

MODEL = "claude-haiku-4-5"

# No minItems/maxItems on "points" — Anthropic's structured-output schema
# validator rejects array bounds other than 0 or 1. The "3-5 points" count
# is enforced by the system prompt below only, not this schema.
SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "icon": {"type": "string", "enum": list(SUMMARY_ICONS.keys())},
                    "text": {"type": "string"},
                },
                "required": ["icon", "text"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["points"],
    "additionalProperties": False,
}


async def generate_weather_summary(trip: Trip, weather_day: dict) -> list[dict]:
    """Ask Claude for 3-5 short point-form highlights of one day's weather
    for a trip currently in progress — practical, human advice (what to
    wear/bring, whether outdoor plans are at risk) rather than a raw data
    dump. Shares find_alternative_activity's client/model/config/structured-
    output pattern (see swap_service.py). Returns [{"icon", "text"}, ...] —
    `icon` is one of SUMMARY_ICONS' keys, mapped to an emoji at render time
    (email_templates.daily_summary_email), not embedded here."""
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    content = (
        f"Today ({weather_day['date']}) in {trip.destination}: {weather_day.get('condition')}, "
        f"{weather_day.get('temp_min')}-{weather_day.get('temp_max')}°C, "
        f"{weather_day.get('rain_mm')}mm rain, wind {weather_day.get('wind_level')}, "
        f"UV {weather_day.get('uv_level')} ({weather_day.get('uv_advice')}), "
        f"flood risk {weather_day.get('flood_risk')}, beach safety {weather_day.get('beach_safety')}, "
        f"hiking safety {weather_day.get('hiking_safety')}."
    )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=30.0)
    response = await client.messages.create(
        model=MODEL,
        max_tokens=400,
        system=(
            "You write short, friendly daily weather briefings for travelers currently "
            "on a trip. Given one day's weather data, produce 3-5 short point-form "
            "highlights (each a short phrase, not a full sentence — think text message, "
            "not essay) covering what the day will feel like and practical advice: what "
            "to wear or bring, and whether outdoor plans are at any risk. Tag each point "
            "with whichever icon key best represents it. Do not repeat the raw numbers "
            "verbatim; describe them naturally. All temperatures given to you are in "
            "Celsius — always describe temperature in Celsius, never Fahrenheit."
        ),
        messages=[{"role": "user", "content": content}],
        output_config={"format": {"type": "json_schema", "schema": SUMMARY_SCHEMA}},
    )
    text = next(block.text for block in response.content if block.type == "text")
    return json.loads(text)["points"]


async def send_daily_summaries(db: AsyncSession) -> list[dict]:
    """Send every currently-ongoing trip's owner one email with an
    AI-generated summary of that day's weather — unconditionally (no
    email_enabled gate: there's no UI for that preference today, see
    NotificationPreference, so every trip owner gets it, same as every other
    user-facing feature in this app currently has no opt-out). Meant to run
    once daily (see .github/workflows/daily-weather-summary.yml), unlike
    run_auto_swap's every-3-hours swap check.

    Returns [{trip_id, user_id, status}, ...] — one entry per ongoing trip
    whose email send was attempted (skipped trips, e.g. failed geocode or a
    failed Claude call, are not included)."""
    today = date.today()

    result = await db.execute(
        select(Trip).where(Trip.start_date <= today, Trip.end_date >= today)
    )
    trips = result.scalars().all()
    print(f"[daily_summary] {len(trips)} ongoing trip(s) today...", flush=True)

    results = []
    for trip in trips:
        print(f"[daily_summary] trip {trip.id} ({trip.destination})...", flush=True)
        if trip.lat == 0.0 and trip.lng == 0.0:
            coords = geocoding_service.geocode(trip.destination)
            if not coords:
                continue
            trip.lat, trip.lng = coords
            await db.commit()

        try:
            forecast_days = get_weather_prediction(trip.lat, trip.lng, today.isoformat(), today.isoformat())
            weather_day = forecast_days[0]
            summary_points = await generate_weather_summary(trip, weather_day)
        except Exception as e:
            # One bad weather fetch or Claude call shouldn't block other
            # travelers' emails — see openmeteo.py's own retry/cache handling
            # for why this can still happen despite that.
            print(f"[daily_summary] trip {trip.id}: failed, skipping — {e}", flush=True)
            continue

        user = await db.get(User, trip.user_id)
        if user is None:
            continue

        subject = f"Navia: today's weather in {trip.destination}"
        html, text = email_templates.daily_summary_email(trip, weather_day, summary_points)
        send_result = await asyncio.to_thread(email_service.send_email, user.email, subject, html, text)
        results.append({"trip_id": trip.id, "user_id": trip.user_id, **send_result})

    return results
