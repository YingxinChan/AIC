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


def _add_activity(trip_id, activity_type, is_swapped=False, name="Hyde Park Walk", day_date=TODAY):
    async def _inner():
        async with _TestSessionLocal() as db:
            activity = Activity(
                trip_id=trip_id, day_date=day_date, name=name, type=activity_type,
                time_slot="10:00 - 12:00", location="Hyde Park", is_swapped=is_swapped,
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


def _mock_find_alternative(monkeypatch, alternate=None):
    alternate = alternate or {"name": "British Museum", "location": "Great Russell St"}
    mock = AsyncMock(return_value=alternate)
    monkeypatch.setattr("services.auto_swap_service.swap_service.find_indoor_alternative", mock)
    return mock


# run_auto_swap() operates over every trip in the (shared, real) dev DB by
# design — that's the correct production behavior. So these tests scope their
# assertions to the trip_id they created rather than the raw return value,
# since other trips may legitimately exist in the shared DB at the same time.


def test_auto_swap_swaps_outdoor_activity_on_rainy_day(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch)
    _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert len(our_swaps) == 1
    assert our_swaps[0]["activity_id"] == activity_id
    assert "80.0" in our_swaps[0]["reason"]

    activity = _get_activity(activity_id)
    assert activity.is_swapped is True
    assert activity.alternate_name == "British Museum"
    assert activity.alternate_location == "Great Russell St"
    assert activity.swap_reason == our_swaps[0]["reason"]


def test_auto_swap_is_idempotent(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    first = [s for s in _run_auto_swap() if s["trip_id"] == trip_id]
    second = [s for s in _run_auto_swap() if s["trip_id"] == trip_id]

    assert len(first) == 1
    assert len(second) == 0
    calls_for_our_activity = [c for c in mock_find.call_args_list if c.args[0].id == activity_id]
    assert len(calls_for_our_activity) == 1


def test_auto_swap_skips_indoor_and_already_swapped_activities(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    indoor_id = _add_activity(trip_id, "indoor")
    already_swapped_id = _add_activity(trip_id, "outdoor", is_swapped=True)
    _mock_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()
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
    mock_find = _mock_find_alternative(monkeypatch)

    _run_auto_swap()

    call = next(c for c in mock_find.call_args_list if c.args[0].id == activity_id)
    assert "British Museum" in call.kwargs["exclude_names"]


def test_auto_swap_excludes_activities_swapped_earlier_in_the_same_run(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    first_id = _add_activity(trip_id, "outdoor", name="Hyde Park Walk")
    second_id = _add_activity(trip_id, "outdoor", name="Regent's Park Picnic")
    _mock_weather(monkeypatch)
    mock_find = _mock_find_alternative(monkeypatch)

    _run_auto_swap()

    calls_in_order = [c for c in mock_find.call_args_list if c.args[0].id in (first_id, second_id)]
    assert len(calls_in_order) == 2
    # whichever activity was swapped second should see the first's new
    # alternate ("British Museum") in its own exclusion list
    assert "British Museum" in calls_in_order[1].kwargs["exclude_names"]


def test_auto_swap_does_not_trigger_without_rain(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    activity_id = _add_activity(trip_id, "outdoor")
    _mock_weather(monkeypatch, forecast=[{
        "date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 5.0,
    }])
    mock_find = _mock_find_alternative(monkeypatch)

    swapped = _run_auto_swap()
    our_swaps = [s for s in swapped if s["trip_id"] == trip_id]

    assert our_swaps == []
    calls_for_our_activity = [c for c in mock_find.call_args_list if c.args[0].id == activity_id]
    assert calls_for_our_activity == []
