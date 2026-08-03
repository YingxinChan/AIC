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
    time_slot="10:00 - 12:00", is_fixed=False,
):
    async def _inner():
        async with _TestSessionLocal() as db:
            activity = Activity(
                trip_id=trip_id, day_date=day_date, name=name, type=activity_type,
                time_slot=time_slot, location="Hyde Park", is_swapped=is_swapped,
                lat=51.5073, lng=-0.1657,  # Hyde Park's real coordinates
                weather_sensitivity=weather_sensitivity, is_fixed=is_fixed,
            )
            db.add(activity)
            await db.commit()
            await db.refresh(activity)
            return activity.id
    return asyncio.run(_inner())


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
        "visibility_km": 0.8,
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
        "visibility_km": 0.8,
    }])
    _mock_hourly_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    result = _run_auto_swap()
    our_tip_ids = {t["activity_id"] for t in result["tips"] if t["trip_id"] == trip_id}

    assert our_tip_ids == {tagged_id}
    assert untagged_id not in our_tip_ids
    assert result["swapped"] == [] or all(s["trip_id"] != trip_id for s in result["swapped"])
