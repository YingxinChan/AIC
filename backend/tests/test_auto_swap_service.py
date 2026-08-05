import asyncio
from datetime import date, timedelta
from unittest.mock import AsyncMock

from sqlalchemy import select

from models.activity import Activity
from services.auto_swap_service import run_auto_swap
from tests.conftest import _TestSessionLocal

TODAY = date.today()
LONDON_COORDS = (51.5074, -0.1278)
RAINY_FORECAST = [{
    "date": TODAY.isoformat(),
    "heavy_rain_warning": True,
    "heavy_rain_probability": 80.0,
}]


def _create_trip(auth_client, monkeypatch):
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    response = auth_client.post("/api/trips/", json={
        "name": "Test Trip",
        "start_date": TODAY.isoformat(),
        "end_date": (TODAY + timedelta(days=1)).isoformat(),
    })
    return response.json()["id"]


def _add_activity(
    trip_id, activity_type, is_swapped=False, name="Hyde Park Walk", day_date=TODAY, weather_sensitivity="",
    time_slot="10:00 - 12:00", is_fixed=False, alternate_name="", alternate_location="",
    swap_reason="", swap_score_trace=None, lat=51.5073, lng=-0.1657, original_lat=None, original_lng=None,
):
    async def _inner():
        async with _TestSessionLocal() as db:
            activity = Activity(
                trip_id=trip_id, day_date=day_date, name=name, type=activity_type,
                time_slot=time_slot, location="Hyde Park", is_swapped=is_swapped,
                lat=lat, lng=lng,  # defaults to Hyde Park's real coordinates
                weather_sensitivity=weather_sensitivity, is_fixed=is_fixed,
                alternate_name=alternate_name, alternate_location=alternate_location,
                swap_reason=swap_reason, swap_score_trace=swap_score_trace,
                original_lat=original_lat, original_lng=original_lng,
            )
            db.add(activity)
            await db.commit()
            await db.refresh(activity)
            return activity.id
    return asyncio.run(_inner())


def _create_trip_ending(auth_client, monkeypatch, days):
    """Like _create_trip, but with a longer window — needed for revert tests
    whose activity must sit comfortably >=24h out (the default _create_trip
    trip only spans TODAY..TODAY+1, too short for that)."""
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    response = auth_client.post("/api/trips/", json={
        "name": "Test Trip",
        "start_date": TODAY.isoformat(),
        "end_date": (TODAY + timedelta(days=days)).isoformat(),
    })
    return response.json()["id"]


def _get_activity(activity_id):
    async def _inner():
        async with _TestSessionLocal() as db:
            result = await db.execute(select(Activity).where(Activity.id == activity_id))
            return result.scalar_one()
    return asyncio.run(_inner())


def _run_auto_swap():
    async def _inner():
        async with _TestSessionLocal() as db:
            return await run_auto_swap(db)
    return asyncio.run(_inner())


def _mock_weather(monkeypatch, forecast=RAINY_FORECAST):
    monkeypatch.setattr(
        "services.auto_swap_service.get_weather_prediction",
        lambda lat, lon, start, end: forecast,
    )


def _mock_hourly_weather(monkeypatch, hourly=None):
    # Defaults to [] rather than None — get_hourly_weather() always returns
    # a list, and an empty list reproduces RainRule's pre-hourly blanket
    # fallback exactly, matching every existing test's expectations without
    # needing per-test hourly fixtures. get_hourly_weather() would otherwise
    # make a real network call once run_auto_swap() starts fetching it.
    hourly = hourly if hourly is not None else []
    monkeypatch.setattr(
        "services.auto_swap_service.get_hourly_weather",
        lambda lat, lon, start, end: hourly,
    )


def _mock_find_alternative(monkeypatch, alternate=None):
    alternate = alternate or {
        "name": "British Museum", "location": "Great Russell St",
        "lat": 51.5194, "lng": -0.1270, "type": "indoor",
    }
    mock = AsyncMock(return_value=alternate)
    monkeypatch.setattr("services.auto_swap_service.swap_service.find_alternative_activity", mock)
    return mock


# run_auto_swap() operates over every trip in the (shared, real) dev DB by
# design — that's the correct production behavior. So these tests scope their
# assertions to the trip_id they created rather than the raw return value,
# since other trips may legitimately exist in the shared DB at the same time.


def test_auto_swap_swaps_outdoor_activity_on_rainy_day(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert len(our_swaps) == 1
    assert our_swaps[0]["activity_id"] == activity_id
    assert "80.0" in our_swaps[0]["reason"]

    activity = _get_activity(activity_id)
    assert activity.is_swapped is True
    assert activity.alternate_name == "British Museum"
    assert activity.alternate_location == "Great Russell St"
    assert activity.swap_reason == our_swaps[0]["reason"]
    # The map pin must move to the alternate's coordinates, not stay at the
    # rained-out original's — otherwise it silently shows the wrong location
    # under the new activity's name.
    assert (activity.lat, activity.lng) == (51.5194, -0.1270)
    # type must reflect the alternate's real indoor/outdoor value, not stay
    # "outdoor" (the original) or get assumed "indoor" by a caller instead.
    assert activity.type == "indoor"


def test_auto_swap_is_idempotent(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    first = [s for s in _run_auto_swap()["swapped"] if s["trip_id"] == trip_id]
    second = [s for s in _run_auto_swap()["swapped"] if s["trip_id"] == trip_id]

    assert len(first) == 1
    assert len(second) == 0
    calls_for_our_activity = [c for c in mock_find.call_args_list if c.args[0].id == activity_id]
    assert len(calls_for_our_activity) == 1


def test_auto_swap_skips_indoor_and_already_swapped_activities(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    indoor_id = _add_activity(trip_id, "indoor")
    already_swapped_id = _add_activity(trip_id, "outdoor", is_swapped=True)
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert our_swaps == []
    calls_for_our_activities = [
        c for c in mock_find.call_args_list if c.args[0].id in (indoor_id, already_swapped_id)
    ]
    assert calls_for_our_activities == []


def test_auto_swap_excludes_activities_already_planned_elsewhere_on_the_trip(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _add_activity(trip_id, "indoor", name="British Museum", day_date=TODAY + timedelta(days=1))
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    _run_auto_swap()

    call = next(c for c in mock_find.call_args_list if c.args[0].id == activity_id)
    assert "British Museum" in call.kwargs["exclude_names"]


def test_auto_swap_excludes_activities_swapped_earlier_in_the_same_run(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    first_id = _add_activity(trip_id, "outdoor", name="Hyde Park Walk")
    second_id = _add_activity(trip_id, "outdoor", name="Regent's Park Picnic")
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    _run_auto_swap()

    calls_in_order = [c for c in mock_find.call_args_list if c.args[0].id in (first_id, second_id)]
    assert len(calls_in_order) == 2
    # whichever activity was swapped second should see the first's new
    # alternate ("British Museum") in its own exclusion list
    assert "British Museum" in calls_in_order[1].kwargs["exclude_names"]


def test_auto_swap_targeted_rule_only_swaps_the_tagged_activity(auth_client, monkeypatch):
    """Two outdoor activities scheduled the same foggy day — only the one
    tagged view_dependent should get swapped; the untagged one is unaffected
    even though it's outdoor on the same bad-visibility day."""
    trip_id = _create_trip(auth_client, monkeypatch)
    viewpoint_id = _add_activity(
        trip_id, "outdoor", name="Primrose Hill Viewpoint", weather_sensitivity="view_dependent",
    )
    market_id = _add_activity(trip_id, "outdoor", name="Borough Market", weather_sensitivity="")
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "visibility_km": 0.8, "visibility_m": 800,
    }])
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = {s["activity_id"] for s in swapped if s["trip_id"] == trip_id}

    assert our_swaps == {viewpoint_id}
    assert market_id not in our_swaps


def test_auto_swap_does_not_trigger_without_rain(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 5.0,
    }])
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert our_swaps == []
    calls_for_our_activity = [c for c in mock_find.call_args_list if c.args[0].id == activity_id]
    assert calls_for_our_activity == []


_RAINY_MORNING_HOURLY = [
    {"time": f"{TODAY.isoformat()}T09:00", "rain_probability": 85},
    {"time": f"{TODAY.isoformat()}T10:00", "rain_probability": 90},
    {"time": f"{TODAY.isoformat()}T14:00", "rain_probability": 5},
    {"time": f"{TODAY.isoformat()}T15:00", "rain_probability": 10},
]


def test_auto_swap_hourly_only_swaps_the_activity_overlapping_the_rainy_window(auth_client, monkeypatch):
    """The flagship scenario: two outdoor activities on the same rainy day —
    only the one whose time_slot overlaps the actual rainy hours gets
    swapped, the one in the clear afternoon does not."""
    trip_id = _create_trip(auth_client, monkeypatch)
    morning_id = _add_activity(trip_id, "outdoor", name="Morning Walk", time_slot="09:00 - 11:00")
    afternoon_id = _add_activity(trip_id, "outdoor", name="Afternoon Market", time_slot="14:00 - 16:00")
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch, hourly=_RAINY_MORNING_HOURLY)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = {s["activity_id"] for s in swapped if s["trip_id"] == trip_id}

    assert our_swaps == {morning_id}
    assert afternoon_id not in our_swaps


def test_auto_swap_falls_back_to_blanket_when_hourly_fetch_fails(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    morning_id = _add_activity(trip_id, "outdoor", name="Morning Walk", time_slot="09:00 - 11:00")
    afternoon_id = _add_activity(trip_id, "outdoor", name="Afternoon Market", time_slot="14:00 - 16:00")
    _mock_weather(monkeypatch)

    def _raise(*args, **kwargs):
        raise RuntimeError("hourly weather API down")
    monkeypatch.setattr("services.auto_swap_service.get_hourly_weather", _raise)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = {s["activity_id"] for s in swapped if s["trip_id"] == trip_id}

    # No hourly data available at all -> falls back to the original
    # whole-day blanket behavior, same as before this feature existed.
    assert our_swaps == {morning_id, afternoon_id}


def test_auto_swap_falls_back_to_blanket_when_hourly_data_is_for_a_different_date(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    afternoon_id = _add_activity(trip_id, "outdoor", name="Afternoon Market", time_slot="14:00 - 16:00")
    _mock_weather(monkeypatch)
    # Hourly data present, but for a date that doesn't match the activity's
    # day at all — hourly_by_date.get(...) returns None, distinct from the
    # exception path above.
    other_date = (TODAY + timedelta(days=5)).isoformat()
    _mock_hourly_weather(monkeypatch, hourly=[{"time": f"{other_date}T09:00", "rain_probability": 90}])
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = {s["activity_id"] for s in swapped if s["trip_id"] == trip_id}

    assert our_swaps == {afternoon_id}


def test_auto_swap_never_swaps_a_fixed_activity(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    fixed_id = _add_activity(trip_id, "outdoor", is_fixed=True)
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert our_swaps == []
    calls_for_fixed = [c for c in mock_find.call_args_list if c.args[0].id == fixed_id]
    assert calls_for_fixed == []

    activity = _get_activity(fixed_id)
    assert activity.is_swapped is False


def test_auto_swap_generates_a_tip_for_a_fixed_activity_on_a_rainy_day(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    fixed_id = _add_activity(trip_id, "outdoor", name="Beach Day", is_fixed=True)
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    result = _run_auto_swap()
    our_tips = [t for t in result["tips"] if t["trip_id"] == trip_id]

    assert len(our_tips) == 1
    assert our_tips[0]["activity_id"] == fixed_id
    assert "80.0" in our_tips[0]["reason"]
    assert "umbrella" in our_tips[0]["tip"].lower()
    assert our_tips[0]["name"] == "Beach Day"

    # Still never swapped — a tip is informational only, no row mutation.
    activity = _get_activity(fixed_id)
    assert activity.is_swapped is False
    mock_find.assert_not_called()


def test_auto_swap_does_not_tip_a_fixed_indoor_activity_on_a_rainy_day(auth_client, monkeypatch):
    """Rain/fog_safety are blanket checks (not gated by weather_sensitivity
    tag), so without a type=="outdoor" filter a fixed indoor activity would
    get a nonsensical "bring an umbrella" tip for weather that can't affect
    it — e.g. a museum visit is unaffected by rain."""
    trip_id = _create_trip(auth_client, monkeypatch)
    fixed_id = _add_activity(trip_id, "indoor", name="Museum Visit", is_fixed=True)
    _mock_weather(monkeypatch)
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    result = _run_auto_swap()
    our_tips = [t for t in result["tips"] if t["trip_id"] == trip_id]

    assert our_tips == []
    mock_find.assert_not_called()


def test_auto_swap_fixed_activity_tip_respects_weather_sensitivity_tag(auth_client, monkeypatch):
    """Fixed activities go through the same targeted-rule tag check as
    swappable ones — an untagged fixed activity shouldn't get a fog tip."""
    trip_id = _create_trip(auth_client, monkeypatch)
    tagged_id = _add_activity(
        trip_id, "outdoor", name="Fixed Viewpoint Tour", weather_sensitivity="view_dependent", is_fixed=True,
    )
    untagged_id = _add_activity(trip_id, "outdoor", name="Fixed Market Tour", weather_sensitivity="", is_fixed=True)
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "visibility_km": 0.8, "visibility_m": 800,
    }])
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    result = _run_auto_swap()
    our_tip_ids = {t["activity_id"] for t in result["tips"] if t["trip_id"] == trip_id}

    assert our_tip_ids == {tagged_id}
    assert untagged_id not in our_tip_ids
    assert result["swapped"] == [] or all(s["trip_id"] != trip_id for s in result["swapped"])


# ---------------------------------------------------------------------------
# New scoring engine, at the run_auto_swap() integration level (see
# tests/test_weather_rules.py for the underlying score_activity() unit
# tests). Rain-related behavior above is untouched by the redesign — these
# cover the new cold/heat/UV/fog-safety/wind/beach scoring + advisory tier +
# stacking + score-trace persistence.
# ---------------------------------------------------------------------------

def test_auto_swap_single_moderate_score_produces_advisory_tip_not_swap(auth_client, monkeypatch):
    """High UV alone scores 50 — above ADVISORY_THRESHOLD (40) but below
    SWAP_THRESHOLD (70), so a strenuous_outdoor activity should get a tip,
    not be swapped. (Strong wind used to be this test's example, but wind is
    now swap-tier alone at 75 — see score_wind — so it no longer
    demonstrates the advisory-only path.)"""
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor", name="Long Hike", weather_sensitivity="strenuous_outdoor")
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "uv_level": "High", "uv_index": 7,
    }])
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    result = _run_auto_swap()
    our_swaps = [s for s in result["swapped"] if s["trip_id"] == trip_id]
    our_tips = [t for t in result["tips"] if t["trip_id"] == trip_id]

    assert our_swaps == []
    assert len(our_tips) == 1
    assert our_tips[0]["activity_id"] == activity_id
    assert "uv" in our_tips[0]["reason"].lower()
    calls_for_our_activity = [c for c in mock_find.call_args_list if c.args[0].id == activity_id]
    assert calls_for_our_activity == []

    activity = _get_activity(activity_id)
    assert activity.is_swapped is False


def test_auto_swap_stacked_scores_swap_even_when_neither_alone_would(auth_client, monkeypatch):
    """Extreme cold (score 50, the -5..-10 advisory tier) and Moderate beach
    safety (score 50) each sit below SWAP_THRESHOLD alone, but combined
    (50 + 0.5*50 = 75) cross it — an activity tagged with both should be
    swapped. (Wind used to be this test's example, but wind is now
    swap-tier alone at 75 — see score_wind — so it no longer demonstrates
    two moderates stacking.)"""
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(
        trip_id, "outdoor", name="Beach Walk", weather_sensitivity="strenuous_outdoor,beach",
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "temp_min": -7, "beach_safety_level": "Moderate",
    }])
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert len(our_swaps) == 1
    assert our_swaps[0]["activity_id"] == activity_id

    activity = _get_activity(activity_id)
    assert activity.is_swapped is True
    assert activity.swap_score_trace is not None
    assert activity.swap_score_trace["scores"]["cold"] == 50
    assert activity.swap_score_trace["scores"]["beach"] == 50
    assert activity.swap_score_trace["combined"] == 75.0


def test_auto_swap_below_advisory_threshold_does_nothing(auth_client, monkeypatch):
    activity_id = None
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor", name="City Walk", weather_sensitivity="wind_exposed")
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "wind_level": "Moderate", "wind_speed": 15,
    }])
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    result = _run_auto_swap()
    assert [s for s in result["swapped"] if s["trip_id"] == trip_id] == []
    assert [t for t in result["tips"] if t["trip_id"] == trip_id] == []
    assert [c for c in mock_find.call_args_list if c.args[0].id == activity_id] == []


def test_auto_swap_rain_caused_swap_has_a_score_trace(auth_client, monkeypatch):
    """Rain is now part of the scoring engine (see score_rain() in
    services/weather_rules.py), so it can stack with other risks (e.g.
    moderate wind + moderate rain) instead of being checked in total
    isolation — a rain-caused swap should have a real score_trace with
    "rain": 90 (the heavy tier), not None."""
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch)  # RAINY_FORECAST default
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    _run_auto_swap()

    activity = _get_activity(activity_id)
    assert activity.is_swapped is True
    assert activity.swap_score_trace is not None
    assert activity.swap_score_trace["scores"]["rain"] == 90


def test_auto_swap_cold_and_heat_use_temp_min_max_directly(auth_client, monkeypatch):
    """temp_min <= -10 swaps a strenuous_outdoor activity (the new stricter
    swap tier; -5..-10 would only be advisory, see test_weather_rules.py)."""
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor", name="Long Hike", weather_sensitivity="strenuous_outdoor")
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "temp_min": -12, "temp_max": 5,
    }])
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()["swapped"]
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]
    assert len(our_swaps) == 1
    assert our_swaps[0]["activity_id"] == activity_id
    assert "cold" in our_swaps[0]["reason"].lower()


# ---------------------------------------------------------------------------
# Revert — undoing a previous auto-swap once the weather that caused it
# clears. All these activities are seeded already-swapped (is_swapped=True,
# alternate_*/swap_score_trace/original_lat/lng populated) to simulate a
# prior run, rather than going through a real swap first.
# ---------------------------------------------------------------------------

def test_auto_swap_reverts_when_the_contributing_metric_recovers(auth_client, monkeypatch):
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Hyde Park Walk", day_date=far_out_day, time_slot="12:00 - 14:00",
        weather_sensitivity="strenuous_outdoor", is_swapped=True,
        alternate_name="British Museum", alternate_location="Great Russell St",
        swap_reason="Extreme cold expected (around -12°C) — unsafe for extended outdoor exertion",
        swap_score_trace={"scores": {"fog_safety": 0, "cold": 80}, "combined": 80, "adjusted": 80},
        lat=51.5194, lng=-0.1270,  # currently at the alternate's coordinates
        original_lat=51.5073, original_lng=-0.1657,  # Hyde Park's real coordinates
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "temp_min": 5, "temp_max": 15,
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert len(our_reverts) == 1
    assert our_reverts[0]["activity_id"] == activity_id
    assert our_reverts[0]["restored_name"] == "Hyde Park Walk"
    assert our_reverts[0]["restored_location"] == "Hyde Park"
    assert our_reverts[0]["previous_alternate_name"] == "British Museum"

    activity = _get_activity(activity_id)
    assert activity.is_swapped is False
    assert activity.alternate_name == ""
    assert activity.alternate_location == ""
    assert activity.swap_reason == ""
    assert activity.swap_score_trace is None
    assert (activity.lat, activity.lng) == (51.5073, -0.1657)
    assert activity.original_lat is None
    assert activity.original_lng is None
    assert activity.type == "outdoor"


def test_auto_swap_does_not_revert_when_a_different_metric_has_since_gone_strong_bad(auth_client, monkeypatch):
    """The activity was swapped for fog alone (dominant, and only original
    contributor). Fog has cleared, but UV — which had nothing to do with
    the original swap (it was fine back then, so never even appeared in
    swap_score_trace) — has since spiked to Extreme, which alone would
    justify a swap. Reverting anyway would walk this activity straight
    into a different, currently-active risk, so it must stay swapped."""
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Primrose Hill Viewpoint", day_date=far_out_day, time_slot="12:00 - 14:00",
        weather_sensitivity="view_dependent,strenuous_outdoor", is_swapped=True,
        alternate_name="British Museum", alternate_location="Great Russell St",
        swap_score_trace={"scores": {"fog_safety": 0, "fog_scenic": 80}, "combined": 80, "adjusted": 80},
        lat=51.5194, lng=-0.1270, original_lat=51.5364, original_lng=-0.1565,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "visibility_m": 12000,  # fog_scenic's dominant cause: clearly recovered (>= 10000)
        "uv_index": 12,         # "Extreme" via ml.risk_calculator.uv_level() — independently swap-worthy
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert our_reverts == []
    activity = _get_activity(activity_id)
    assert activity.is_swapped is True


def test_auto_swap_reverts_when_dominant_metric_clears_even_if_a_secondary_one_is_merely_advisory(
    auth_client, monkeypatch,
):
    """wind (dominant, 75) + cold (secondary, 50) both contributed at swap
    time. Only the dominant metric needs to fully clear — a secondary
    contributor left at a merely-advisory level (not independently strong
    enough to justify a swap on its own) doesn't block the revert."""
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Thames Boat Tour", day_date=far_out_day, time_slot="12:00 - 14:00",
        weather_sensitivity="wind_exposed,strenuous_outdoor", is_swapped=True,
        alternate_name="Aquarium", alternate_location="County Hall",
        swap_score_trace={"scores": {"fog_safety": 0, "wind": 75, "cold": 50}, "combined": 100, "adjusted": 100},
        lat=51.5033, lng=-0.1195, original_lat=51.5, original_lng=-0.14,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "wind_speed": 5,      # Calm — the dominant cause, clearly recovered
        "temp_min": -7,       # still mildly cold (scores 50, advisory) but not independently swap-worthy (<70)
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert len(our_reverts) == 1
    assert our_reverts[0]["activity_id"] == activity_id
    activity = _get_activity(activity_id)
    assert activity.is_swapped is False


def test_auto_swap_does_not_revert_within_24h_commit_window(auth_client, monkeypatch):
    """Even with clearly-good weather, an activity happening today (well
    inside the 24h commit window) should not be flipped back — avoids
    last-minute flip-flopping."""
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(
        trip_id, "indoor", name="Long Hike", day_date=TODAY, time_slot="00:00 - 01:00",
        weather_sensitivity="strenuous_outdoor", is_swapped=True,
        alternate_name="Science Museum", alternate_location="Exhibition Rd",
        swap_score_trace={"scores": {"fog_safety": 0, "heat": 80}, "combined": 80, "adjusted": 80},
        lat=51.4978, lng=-0.1746, original_lat=51.5073, original_lng=-0.1657,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "temp_min": 10, "temp_max": 20,  # clearly good — but too close to matter
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert our_reverts == []
    activity = _get_activity(activity_id)
    assert activity.is_swapped is True


def test_auto_swap_reverts_a_rain_caused_swap_when_rain_clears(auth_client, monkeypatch):
    """Rain-caused swaps have swap_score_trace=None (rain isn't part of the
    scoring engine) — revert falls back to re-checking RainRule directly."""
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Hyde Park Walk", day_date=far_out_day, time_slot="12:00 - 14:00",
        is_swapped=True, alternate_name="British Museum", alternate_location="Great Russell St",
        swap_score_trace=None,
        lat=51.5194, lng=-0.1270, original_lat=51.5073, original_lng=-0.1657,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 5.0,
        "rain_mm": 0,
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert len(our_reverts) == 1
    assert our_reverts[0]["activity_id"] == activity_id
    activity = _get_activity(activity_id)
    assert activity.is_swapped is False
    assert (activity.lat, activity.lng) == (51.5073, -0.1657)


def test_auto_swap_does_not_revert_rain_caused_swap_while_still_raining(auth_client, monkeypatch):
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Hyde Park Walk", day_date=far_out_day, time_slot="12:00 - 14:00",
        is_swapped=True, alternate_name="British Museum", alternate_location="Great Russell St",
        swap_score_trace=None,
        lat=51.5194, lng=-0.1270, original_lat=51.5073, original_lng=-0.1657,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": True, "heavy_rain_probability": 75.0,
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert our_reverts == []
    activity = _get_activity(activity_id)
    assert activity.is_swapped is True


def test_auto_swap_revert_never_touches_a_fixed_activity(auth_client, monkeypatch):
    """Defensive: is_fixed activities never get auto-swapped in the first
    place, but a user could mark one is_fixed after it was already swapped
    (via the manual-edit endpoint) — the revert pass must still leave it
    alone, same as the swap pass does."""
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Hyde Park Walk", day_date=far_out_day, time_slot="12:00 - 14:00",
        weather_sensitivity="strenuous_outdoor", is_swapped=True, is_fixed=True,
        alternate_name="British Museum", alternate_location="Great Russell St",
        swap_score_trace={"scores": {"fog_safety": 0, "cold": 80}, "combined": 80, "adjusted": 80},
        lat=51.5194, lng=-0.1270, original_lat=51.5073, original_lng=-0.1657,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "temp_min": 5, "temp_max": 15,
    }])
    _mock_hourly_weather(monkeypatch)

    result = _run_auto_swap()
    our_reverts = [r for r in result["reverted"] if r["trip_id"] == trip_id]

    assert our_reverts == []
    activity = _get_activity(activity_id)
    assert activity.is_swapped is True


def test_auto_swap_revert_is_idempotent_within_a_single_run_and_across_runs(auth_client, monkeypatch):
    trip_id = _create_trip_ending(auth_client, monkeypatch, days=5)
    far_out_day = TODAY + timedelta(days=3)
    activity_id = _add_activity(
        trip_id, "indoor", name="Hyde Park Walk", day_date=far_out_day, time_slot="12:00 - 14:00",
        weather_sensitivity="strenuous_outdoor", is_swapped=True,
        alternate_name="British Museum", alternate_location="Great Russell St",
        swap_score_trace={"scores": {"fog_safety": 0, "cold": 80}, "combined": 80, "adjusted": 80},
        lat=51.5194, lng=-0.1270, original_lat=51.5073, original_lng=-0.1657,
    )
    _mock_weather(monkeypatch, forecast=[{
        "date": far_out_day.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0,
        "temp_min": 5, "temp_max": 15,
    }])
    _mock_hourly_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    first = _run_auto_swap()
    second = _run_auto_swap()

    assert len([r for r in first["reverted"] if r["trip_id"] == trip_id]) == 1
    assert len([r for r in second["reverted"] if r["trip_id"] == trip_id]) == 0
    # Weather is still good, so it also shouldn't be swapped right back.
    assert [s for s in second["swapped"] if s["trip_id"] == trip_id] == []
    calls_for_our_activity = [c for c in mock_find.call_args_list if c.args[0].id == activity_id]
    assert calls_for_our_activity == []

    activity = _get_activity(activity_id)
    assert activity.is_swapped is False
