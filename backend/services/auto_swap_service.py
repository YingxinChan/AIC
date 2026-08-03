from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.activity import Activity
from models.trip import Trip
from services import geocoding_service, swap_service
from services.weather_rules import ACTIVE_RULES
from services.weather_service import (
    FORECAST_HORIZON_DAYS,
    get_hourly_weather,
    get_weather_prediction,
)

async def run_auto_swap(db: AsyncSession) -> dict:
    """Re-check weather for upcoming/active trips and auto-swap outdoor
    activities affected by any ACTIVE_RULES condition (rain, fog, wind,
    extreme heat/cold/UV, poor beach safety) for a suitable alternative.

    Safe to call repeatedly (e.g. on a Celery Beat schedule, or manually for
    testing) — Activity.is_swapped is the idempotency guard, so an
    already-swapped activity is never re-evaluated or re-notified.

    Returns {"swapped": [...], "tips": [...]}:
    - "swapped": {trip_id, activity_id, reason, rain_mm, day_date,
      original_name, original_location, alternate_name, alternate_location}
      for activities swapped during this run.
    - "tips": {trip_id, activity_id, reason, tip, day_date, name, location}
      for *fixed* activities affected by a rule — these are never swapped
      (is_fixed excludes them from the swap-candidate pool entirely), so
      this is informational only, no row is mutated. Not deduped across
      runs — a fixed activity on a rainy day may generate the same tip on
      each scheduled check until the day passes or the forecast clears;
      accepted trade-off since tips are non-destructive, unlike a swap.

    Both are consumed by notifications_service.send_swap_digest_emails to
    build the per-user digest email.
    """
    today = date.today()
    horizon = today + timedelta(days=FORECAST_HORIZON_DAYS)

    result = await db.execute(select(Trip).where(Trip.end_date >= today))
    trips = result.scalars().all()

    swapped = []
    tips = []
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

        # Hourly rain data, used by RainRule to refine which activities on a
        # rainy day are actually affected (their time_slot overlaps a rainy
        # hour) rather than swapping every outdoor activity that day. A
        # failed fetch degrades to an empty dict — RainRule's own fallback
        # then reproduces the original whole-day blanket behavior, so this
        # can only narrow swaps relative to before, never miss a rainy day.
        try:
            hourly_days = get_hourly_weather(
                trip.lat, trip.lng,
                window_start.isoformat(), window_end.isoformat(),
            )
        except Exception:
            hourly_days = []

        hourly_by_date: dict[str, list[dict]] = {}
        for entry in hourly_days:
            hourly_by_date.setdefault(entry["time"][:10], []).append(entry)

        activities_result = await db.execute(
            select(Activity).where(
                Activity.trip_id == trip.id,
                Activity.type == "outdoor",
                Activity.is_swapped.is_(False),
                Activity.is_fixed.is_(False),
                Activity.day_date >= window_start,
                Activity.day_date <= window_end,
            )
        )
        activities_by_date: dict[str, list[Activity]] = {}
        for activity in activities_result.scalars().all():
            activities_by_date.setdefault(activity.day_date.isoformat(), []).append(activity)

        # Fixed activities in the same window get a tip instead of a swap
        # (see run_auto_swap's docstring) — not filtered to type=="outdoor"
        # since a fixed indoor activity just won't match any rule in
        # practice, no need to assume that structurally.
        fixed_activities_result = await db.execute(
            select(Activity).where(
                Activity.trip_id == trip.id,
                Activity.is_fixed.is_(True),
                Activity.day_date >= window_start,
                Activity.day_date <= window_end,
            )
        )
        fixed_activities_by_date: dict[str, list[Activity]] = {}
        for activity in fixed_activities_result.scalars().all():
            fixed_activities_by_date.setdefault(activity.day_date.isoformat(), []).append(activity)

        # Everything actually happening elsewhere on this trip right now — the
        # current plan for a day is its alternate_name once swapped, not the
        # original name. Passed to find_alternative_activity so it doesn't
        # suggest something already scheduled on another day, and grown as
        # swaps happen below so two swaps in the same run don't collide either.
        all_activities_result = await db.execute(select(Activity).where(Activity.trip_id == trip.id))
        planned_names = {
            (a.alternate_name if a.is_swapped else a.name)
            for a in all_activities_result.scalars().all()
            if (a.alternate_name if a.is_swapped else a.name)
        }

        for forecast_day in forecast_days:
            # Fixed activities affected by a rule get a tip instead of a
            # swap — no Claude call, no apply_swap, no is_swapped mutation.
            # Checked before the swappable-activities early-exit below, so a
            # day with only a fixed activity (no swap candidates at all)
            # still gets its tip generated.
            for activity in fixed_activities_by_date.get(forecast_day["date"], []):
                for rule in ACTIVE_RULES:
                    reason = rule.evaluate(forecast_day, activity, hourly=hourly_by_date.get(forecast_day["date"]))
                    if reason:
                        tips.append({
                            "trip_id": trip.id,
                            "activity_id": activity.id,
                            "rule_id": rule.id,
                            "reason": reason,
                            "tip": rule.tip(forecast_day),
                            "day_date": activity.day_date.isoformat(),
                            "name": activity.name,
                            "location": activity.location,
                        })
                        break

            day_activities = activities_by_date.get(forecast_day["date"])
            if not day_activities:
                continue

            # Evaluated per activity, not once per day — blanket rules (rain)
            # fire the same for every activity regardless, but targeted rules
            # (fog, wind, heat, beach...) only fire for activities carrying
            # the matching weather_sensitivity tag, so two activities on the
            # same day can get different verdicts.
            for activity in day_activities:
                reason = None
                for rule in ACTIVE_RULES:
                    reason = rule.evaluate(forecast_day, activity, hourly=hourly_by_date.get(forecast_day["date"]))
                    if reason:
                        break
                if not reason:
                    continue

                try:
                    # Captured before apply_swap mutates the row, so the
                    # digest email can show what the plan used to be.
                    original_name = activity.name
                    original_location = activity.location

                    alternate = await swap_service.find_alternative_activity(
                        activity, trip, reason, exclude_names=list(planned_names)
                    )
                    await swap_service.apply_swap(db, activity, alternate, reason)
                    planned_names.add(alternate["name"])
                    swapped.append({
                        "trip_id": trip.id,
                        "activity_id": activity.id,
                        "rule_id": rule.id,
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

    return {"swapped": swapped, "tips": tips}
