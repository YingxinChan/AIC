from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.activity import Activity
from models.trip import Trip
from services import geocoding_service, swap_service
from services.time_slot import parse_time_slot
from services.weather_rules import (
    ADVISORY_THRESHOLD,
    SWAP_THRESHOLD,
    contributing_metrics_recovered,
    describe_scores,
    describe_tip,
    score_activity,
    top_rule_id,
)
from services.weather_service import (
    FORECAST_HORIZON_DAYS,
    get_hourly_weather,
    get_weather_prediction,
)


def _evaluate_activity(forecast_day: dict, activity: Activity, hourly: list[dict] | None) -> dict | None:
    """Every weather metric — rain included — goes through the scoring
    engine (see services/weather_rules.py's score_activity()), so a
    moderate risk on its own (e.g. moderate rain) can stack with another
    moderate risk (e.g. moderate wind) into a swap even though neither
    alone would cross SWAP_THRESHOLD. Heavy rain is NOT exempt from
    horizon_factor decay, deliberately — a "heavy rain" forecast 3+ days
    out is exactly the kind of not-yet-certain signal horizon decay exists
    to avoid over-committing to (stability: don't swap today for a forecast
    that's likely to shift before the day arrives), the same reasoning that
    already applies to every other risk. Returns None if nothing applies at
    all (combined score below even the advisory threshold), otherwise a
    dict with `reason`/`tip`/`rule_id` (for the swap/tip record and
    notification email) and `adjusted`/`score_trace` (for the caller to
    decide advisory vs. swap, and for persisting on the Activity row when
    it swaps)."""
    result = score_activity(forecast_day, activity, hourly=hourly)
    if result["adjusted"] < ADVISORY_THRESHOLD:
        return None
    effective_values = result["effective_values"]
    return {
        "reason": describe_scores(forecast_day, result["scores"], effective_values),
        "tip": describe_tip(forecast_day, result["scores"], effective_values),
        "rule_id": top_rule_id(result["scores"]),
        "score_trace": result,
        "adjusted": result["adjusted"],
    }


def _hours_until_activity(activity: Activity, now: datetime) -> float:
    """Hours from `now` to the activity's start, using the same time_slot
    parsing already used elsewhere for hourly rain/fog refinement. An
    unparseable time_slot conservatively falls back to midnight (hour 0) —
    this can only ever shrink hours_until, never inflate it, so it errs
    toward skipping a revert rather than allowing one too close to the
    activity."""
    window = parse_time_slot(activity.time_slot)
    start_hour = window[0] if window else 0
    activity_start = datetime.combine(activity.day_date, time(hour=start_hour))
    return (activity_start - now).total_seconds() / 3600


def _check_revert(forecast_day: dict, activity: Activity, hourly: list[dict] | None) -> bool:
    """A swap reverts once every metric that actually contributed at swap
    time is independently good again (see
    weather_rules.contributing_metrics_recovered). Legacy fallback: rows
    swapped before rain was folded into the scoring engine (see
    weather_rules.score_rain) never got a score_trace at all — treat those
    as a synthetic single-metric "rain" trace so they still revert via
    weather_rules.good_rain instead of never reverting."""
    scores_at_swap = (
        {"rain": 1} if activity.swap_score_trace is None
        else activity.swap_score_trace.get("scores", {})
    )
    return contributing_metrics_recovered(scores_at_swap, forecast_day, activity, hourly)


async def run_auto_swap(db: AsyncSession) -> dict:
    """Re-check weather for upcoming/active trips and auto-swap outdoor
    activities affected by a combined rain/cold/heat/UV/fog/wind/
    beach-safety score crossing SWAP_THRESHOLD (see
    services/weather_rules.py's score_activity()) for a suitable
    alternative. A combined score in the advisory band (at or above
    ADVISORY_THRESHOLD but below SWAP_THRESHOLD) produces a tip instead of a
    swap, same as a *fixed* activity affected by anything at or above the
    advisory threshold.

    Also reverts a previously-swapped activity once the weather that caused
    it clears — see _check_revert — but only once it's at least 24h out (no
    flip-flopping right before the activity happens).

    Safe to call repeatedly (e.g. on a Celery Beat schedule, or manually for
    testing) — Activity.is_swapped is the idempotency guard, so an
    already-swapped activity is never re-evaluated or re-notified, and a
    freshly-reverted activity only becomes swap-eligible again on the next
    scheduled run.

    Returns {"swapped": [...], "tips": [...], "reverted": [...]}:
    - "swapped": {trip_id, activity_id, rule_id, reason, rain_mm, day_date,
      original_name, original_location, alternate_name, alternate_location}
      for activities swapped during this run.
    - "tips": {trip_id, activity_id, rule_id, reason, tip, day_date, name,
      location} for *fixed* activities, and for non-fixed activities whose
      combined score only reached the advisory band (no row mutated in
      either case) — informational only. Not deduped across runs — the same
      tip may repeat on each scheduled check until the day passes or the
      forecast improves; accepted trade-off since tips are non-destructive,
      unlike a swap.
    - "reverted": {trip_id, activity_id, day_date, restored_name,
      restored_location, previous_alternate_name, previous_alternate_location}
      for activities reverted back to their original plan during this run.

    All three are consumed by notifications_service.send_swap_digest_emails
    to build the per-user digest email.
    """
    today = date.today()
    now = datetime.now()
    horizon = today + timedelta(days=FORECAST_HORIZON_DAYS)

    result = await db.execute(select(Trip).where(Trip.end_date >= today))
    trips = result.scalars().all()

    swapped = []
    tips = []
    reverted = []
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

        # Already-swapped, non-fixed activities in the same window — checked
        # for a possible revert below. Snapshotted from the DB before the
        # forecast_day loop runs, same as activities_by_date above, so an
        # activity reverted mid-run can't also be picked up as a fresh swap
        # candidate in this same run.
        revert_result = await db.execute(
            select(Activity).where(
                Activity.trip_id == trip.id,
                Activity.is_swapped.is_(True),
                Activity.is_fixed.is_(False),
                Activity.day_date >= window_start,
                Activity.day_date <= window_end,
            )
        )
        revert_candidates_by_date: dict[str, list[Activity]] = {}
        for activity in revert_result.scalars().all():
            revert_candidates_by_date.setdefault(activity.day_date.isoformat(), []).append(activity)

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
            hourly_for_day = hourly_by_date.get(forecast_day["date"])

            # Fixed activities affected by anything at or above the advisory
            # threshold get a tip instead of a swap — no Claude call, no
            # apply_swap, no is_swapped mutation. Checked before the
            # swappable-activities early-exit below, so a day with only a
            # fixed activity (no swap candidates at all) still gets its tip.
            for activity in fixed_activities_by_date.get(forecast_day["date"], []):
                evaluation = _evaluate_activity(forecast_day, activity, hourly_for_day)
                if evaluation:
                    tips.append({
                        "trip_id": trip.id,
                        "activity_id": activity.id,
                        "rule_id": evaluation["rule_id"],
                        "reason": evaluation["reason"],
                        "tip": evaluation["tip"],
                        "day_date": activity.day_date.isoformat(),
                        "name": activity.name,
                        "location": activity.location,
                    })

            # Revert candidates checked before new swaps below — reuses the
            # same forecast_day/hourly_for_day already fetched for this
            # trip, no extra weather API call.
            for activity in revert_candidates_by_date.get(forecast_day["date"], []):
                if _hours_until_activity(activity, now) < 24:
                    continue  # inside the commit window — don't flip-flop this close to the activity
                if not _check_revert(forecast_day, activity, hourly_for_day):
                    continue
                previous_alternate_name = activity.alternate_name
                previous_alternate_location = activity.alternate_location
                await swap_service.revert_activity(db, activity)
                reverted.append({
                    "trip_id": trip.id,
                    "activity_id": activity.id,
                    "day_date": activity.day_date.isoformat(),
                    "restored_name": activity.name,
                    "restored_location": activity.location,
                    "previous_alternate_name": previous_alternate_name,
                    "previous_alternate_location": previous_alternate_location,
                })

            day_activities = activities_by_date.get(forecast_day["date"])
            if not day_activities:
                continue

            # Evaluated per activity, not once per day — rain and the
            # blanket fog-safety score fire the same for every activity
            # regardless, but tag-gated scores (cold/heat/UV/scenic-fog/
            # wind/beach) only apply to activities carrying the matching
            # weather_sensitivity tag, so two activities on the same day can
            # get different verdicts (and different combined scores).
            for activity in day_activities:
                evaluation = _evaluate_activity(forecast_day, activity, hourly_for_day)
                if not evaluation:
                    continue

                if evaluation["adjusted"] < SWAP_THRESHOLD:
                    # Advisory band — inform, don't touch the activity.
                    tips.append({
                        "trip_id": trip.id,
                        "activity_id": activity.id,
                        "rule_id": evaluation["rule_id"],
                        "reason": evaluation["reason"],
                        "tip": evaluation["tip"],
                        "day_date": activity.day_date.isoformat(),
                        "name": activity.name,
                        "location": activity.location,
                    })
                    continue

                reason = evaluation["reason"]
                try:
                    # Captured before apply_swap mutates the row, so the
                    # digest email can show what the plan used to be.
                    original_name = activity.name
                    original_location = activity.location

                    alternate = await swap_service.find_alternative_activity(
                        activity, trip, reason, exclude_names=list(planned_names)
                    )
                    await swap_service.apply_swap(
                        db, activity, alternate, reason, evaluation["score_trace"]
                    )
                    planned_names.add(alternate["name"])
                    swapped.append({
                        "trip_id": trip.id,
                        "activity_id": activity.id,
                        "rule_id": evaluation["rule_id"],
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

    return {"swapped": swapped, "tips": tips, "reverted": reverted}
