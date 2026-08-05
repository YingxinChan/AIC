import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.notification_preference import NotificationPreference
from models.trip import Trip
from models.user import User
from services import email_service, email_templates

DEFAULT_PREFS = {"email_enabled": True}


async def get_preferences(db: AsyncSession, user_id: int) -> dict:
    row = await db.get(NotificationPreference, user_id)
    if row is None:
        return dict(DEFAULT_PREFS)
    return {"email_enabled": row.email_enabled}


async def update_preferences(db: AsyncSession, user_id: int, email_enabled: bool) -> dict:
    row = await db.get(NotificationPreference, user_id)
    if row is None:
        row = NotificationPreference(user_id=user_id, email_enabled=email_enabled)
        db.add(row)
    else:
        row.email_enabled = email_enabled
    await db.commit()
    return {"email_enabled": row.email_enabled}


async def send_test_email(db: AsyncSession, user_id: int) -> dict:
    user = await db.get(User, user_id)
    html, text = email_templates.test_email()
    return await asyncio.to_thread(
        email_service.send_email, user.email, "SmartTrip AI test email", html, text,
    )


async def send_swap_digest_emails(
    db: AsyncSession,
    swapped: list[dict],
    tips: list[dict] | None = None,
    reverted: list[dict] | None = None,
) -> list[dict]:
    """Send one combined digest email per affected user summarizing this
    run's weather-triggered swaps, any fixed-activity tips, and any reverts
    back to the original plan, respecting their email_enabled preference.
    `swapped`, `tips`, and `reverted` are the three collections
    run_auto_swap() returns. Whether a swap happened at all is already
    gated by the scoring engine's own confidence check (see
    services/weather_rules.py's horizon_factor decay) — nothing here
    re-filters which swaps/reverts are "worth" notifying about."""
    tips = tips or []
    reverted = reverted or []
    if not swapped and not tips and not reverted:
        return []

    trip_ids = {s["trip_id"] for s in swapped} | {t["trip_id"] for t in tips} | {r["trip_id"] for r in reverted}
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

    by_user_reverted: dict[int, list[dict]] = {}
    for r in reverted:
        trip = trip_by_id.get(r["trip_id"])
        if trip is None:
            continue
        by_user_reverted.setdefault(trip.user_id, []).append({**r, "trip_name": trip.name})

    results = []
    for user_id in set(by_user_swaps) | set(by_user_tips) | set(by_user_reverted):
        prefs = await get_preferences(db, user_id)
        if not prefs["email_enabled"]:
            continue

        user_swaps = by_user_swaps.get(user_id, [])
        user_tips = by_user_tips.get(user_id, [])
        user_reverted = by_user_reverted.get(user_id, [])

        user = await db.get(User, user_id)
        if user is None:
            continue

        subject = (
            "SmartTrip AI: itinerary updated for weather" if (user_swaps or user_reverted)
            else "SmartTrip AI: weather tips for your trip"
        )
        html, text = email_templates.swap_digest_email(user_swaps, user_tips, user_reverted)
        result = await asyncio.to_thread(
            email_service.send_email, user.email, subject, html, text,
        )
        results.append({"user_id": user_id, **result})

    return results
