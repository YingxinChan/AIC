import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.notification_preference import NotificationPreference
from models.trip import Trip
from models.user import User
from services import email_service, email_templates

DEFAULT_PREFS = {"email_enabled": True, "rain_threshold_mm": 0.0}


async def get_preferences(db: AsyncSession, user_id: int) -> dict:
    row = await db.get(NotificationPreference, user_id)
    if row is None:
        return dict(DEFAULT_PREFS)
    return {"email_enabled": row.email_enabled, "rain_threshold_mm": row.rain_threshold_mm}


async def update_preferences(db: AsyncSession, user_id: int, email_enabled: bool, rain_threshold_mm: float) -> dict:
    row = await db.get(NotificationPreference, user_id)
    if row is None:
        row = NotificationPreference(user_id=user_id, email_enabled=email_enabled, rain_threshold_mm=rain_threshold_mm)
        db.add(row)
    else:
        row.email_enabled = email_enabled
        row.rain_threshold_mm = rain_threshold_mm
    await db.commit()
    return {"email_enabled": row.email_enabled, "rain_threshold_mm": row.rain_threshold_mm}


async def send_test_email(db: AsyncSession, user_id: int) -> dict:
    user = await db.get(User, user_id)
    html, text = email_templates.test_email()
    return await asyncio.to_thread(
        email_service.send_email, user.email, "SmartTrip AI test email", html, text,
    )


async def send_swap_digest_emails(db: AsyncSession, swapped: list[dict], tips: list[dict] | None = None) -> list[dict]:
    """Send one combined digest email per affected user summarizing this
    run's weather-triggered swaps and any fixed-activity tips, respecting
    their email_enabled preference. `swapped` and `tips` are the two
    collections run_auto_swap() returns.

    Rain-caused swaps are additionally gated by rain_threshold_mm (a silent
    plan change should meet the user's bar) — non-rain swaps (wind, extreme
    heat/cold, UV, beach safety, fog; see services/weather_rules.py's
    scoring engine) always qualify, since rain_threshold_mm is specifically
    a rain-volume preference and has no meaningful value to compare against
    for a swap that had nothing to do with rain. Tips are not gated by
    rain_threshold_mm at all — they're informational only, no plan was
    changed, so only email_enabled applies to them."""
    tips = tips or []
    if not swapped and not tips:
        return []

    trip_ids = {s["trip_id"] for s in swapped} | {t["trip_id"] for t in tips}
    trips_result = await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))
    trip_by_id = {t.id: t for t in trips_result.scalars().all()}

    by_user_swaps: dict[int, list[dict]] = {}
    for s in swapped:
        trip = trip_by_id.get(s["trip_id"])
        if trip is None:
            continue
        by_user_swaps.setdefault(trip.user_id, []).append({**s, "trip_name": trip.name})

    by_user_tips: dict[int, list[dict]] = {}
    for t in tips:
        trip = trip_by_id.get(t["trip_id"])
        if trip is None:
            continue
        by_user_tips.setdefault(trip.user_id, []).append({**t, "trip_name": trip.name})

    results = []
    for user_id in set(by_user_swaps) | set(by_user_tips):
        prefs = await get_preferences(db, user_id)
        if not prefs["email_enabled"]:
            continue

        user_swaps = by_user_swaps.get(user_id, [])
        user_tips = by_user_tips.get(user_id, [])

        qualifying_swaps = [
            s for s in user_swaps
            if s.get("rule_id") != "rain" or (s.get("rain_mm") or 0) >= prefs["rain_threshold_mm"]
        ]
        if not qualifying_swaps and not user_tips:
            continue

        user = await db.get(User, user_id)
        if user is None:
            continue

        subject = (
            "SmartTrip AI: itinerary updated for weather" if qualifying_swaps
            else "SmartTrip AI: weather tips for your trip"
        )
        html, text = email_templates.swap_digest_email(qualifying_swaps, user_tips)
        result = await asyncio.to_thread(
            email_service.send_email, user.email, subject, html, text,
        )
        results.append({"user_id": user_id, **result})

    return results
