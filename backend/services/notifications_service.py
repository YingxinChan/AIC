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


async def send_swap_digest_emails(db: AsyncSession, swapped: list[dict]) -> list[dict]:
    """Send one digest email per affected user summarizing this run's
    weather-triggered swaps, respecting their email_enabled/rain_threshold_mm
    preferences. `swapped` is the list run_auto_swap() returns."""
    if not swapped:
        return []

    trip_ids = {s["trip_id"] for s in swapped}
    trips_result = await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))
    trip_by_id = {t.id: t for t in trips_result.scalars().all()}

    by_user: dict[int, list[dict]] = {}
    for s in swapped:
        trip = trip_by_id.get(s["trip_id"])
        if trip is None:
            continue
        by_user.setdefault(trip.user_id, []).append({**s, "trip_name": trip.name})

    results = []
    for user_id, user_swaps in by_user.items():
        prefs = await get_preferences(db, user_id)
        if not prefs["email_enabled"]:
            continue

        qualifying = [s for s in user_swaps if (s.get("rain_mm") or 0) >= prefs["rain_threshold_mm"]]
        if not qualifying:
            continue

        user = await db.get(User, user_id)
        if user is None:
            continue

        html, text = email_templates.swap_digest_email(qualifying)
        result = await asyncio.to_thread(
            email_service.send_email, user.email, "SmartTrip AI: itinerary updated for weather", html, text,
        )
        results.append({"user_id": user_id, **result})

    return results
