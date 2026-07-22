from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.activity import Activity
from models.trip import Trip
from services import geocoding_service, swap_service
from services.weather_rules import ACTIVE_RULES
from services.weather_service import get_weather_prediction

FORECAST_HORIZON_DAYS = 15  # Open-Meteo only reliably forecasts ~16 days out


async def run_auto_swap(db: AsyncSession) -> list[dict]:
    """Re-check weather for upcoming/active trips and auto-swap rained-out
    outdoor activities to an indoor alternative.

    Safe to call repeatedly (e.g. on a Celery Beat schedule, or manually for
    testing) — Activity.is_swapped is the idempotency guard, so an
    already-swapped activity is never re-evaluated or re-notified.

    Returns a list of {trip_id, activity_id, reason, rain_mm, day_date,
    original_name, original_location, alternate_name, alternate_location}
    for activities swapped during this run (consumed by
    notifications_service.send_swap_digest_emails to build the per-user
    digest email).
    """
    today = date.today()
    horizon = today + timedelta(days=FORECAST_HORIZON_DAYS)

    result = await db.execute(select(Trip).where(Trip.end_date >= today))
    trips = result.scalars().all()

    swapped = []
    for trip in trips:
        if trip.lat == 0.0 and trip.lng == 0.0:
            coords = geocoding_service.geocode(trip.destination)
            if not coords:
                continue
            trip.lat, trip.lng = coords
            await db.commit()

        window_start = max(today, trip.start_date)
        window_end = min(trip.end_date, horizon)
        if window_start > window_end:
            continue  # trip hasn't entered the forecast horizon yet

        try:
            forecast_days = get_weather_prediction(
                trip.lat, trip.lng,
                window_start.isoformat(), window_end.isoformat(),
            )
        except Exception:
            continue  # transient forecast failure — retried on the next scheduled run

        activities_result = await db.execute(
            select(Activity).where(
                Activity.trip_id == trip.id,
                Activity.type == "outdoor",
                Activity.is_swapped.is_(False),
                Activity.day_date >= window_start,
                Activity.day_date <= window_end,
            )
        )
        activities_by_date: dict[str, list[Activity]] = {}
        for activity in activities_result.scalars().all():
            activities_by_date.setdefault(activity.day_date.isoformat(), []).append(activity)

        # Everything actually happening elsewhere on this trip right now — the
        # current plan for a day is its alternate_name once swapped, not the
        # original name. Passed to find_indoor_alternative so it doesn't
        # suggest something already scheduled on another day, and grown as
        # swaps happen below so two swaps in the same run don't collide either.
        all_activities_result = await db.execute(select(Activity).where(Activity.trip_id == trip.id))
        planned_names = {
            (a.alternate_name if a.is_swapped else a.name)
            for a in all_activities_result.scalars().all()
            if (a.alternate_name if a.is_swapped else a.name)
        }

        for forecast_day in forecast_days:
            day_activities = activities_by_date.get(forecast_day["date"])
            if not day_activities:
                continue

            reason = None
            for rule in ACTIVE_RULES:
                reason = rule.evaluate(forecast_day)
                if reason:
                    break
            if not reason:
                continue

            for activity in day_activities:
                try:
                    # Captured before apply_swap mutates the row, so the
                    # digest email can show what the plan used to be.
                    original_name = activity.name
                    original_location = activity.location

                    alternate = await swap_service.find_indoor_alternative(
                        activity, trip, exclude_names=list(planned_names)
                    )
                    await swap_service.apply_swap(db, activity, alternate, reason)
                    planned_names.add(alternate["name"])
                    swapped.append({
                        "trip_id": trip.id,
                        "activity_id": activity.id,
                        "reason": reason,
                        "rain_mm": forecast_day.get("rain_mm"),
                        "day_date": activity.day_date.isoformat(),
                        "original_name": original_name,
                        "original_location": original_location,
                        "alternate_name": alternate["name"],
                        "alternate_location": alternate["location"],
                    })
                except Exception:
                    continue  # one bad Claude call shouldn't abort the rest of the batch

    return swapped
