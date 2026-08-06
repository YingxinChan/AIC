import asyncio
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

from services.daily_summary_service import send_daily_summaries
from tests.conftest import _TestSessionLocal

TODAY = date.today()
LONDON_COORDS = (51.5074, -0.1278)
SUNNY_DAY = {
    "date": TODAY.isoformat(), "condition": "Clear", "temp_min": 15, "temp_max": 22,
    "rain_mm": 0, "wind_level": "Light breeze", "uv_level": "Moderate", "uv_advice": "Wear sunscreen",
    "flood_risk": "Low", "beach_safety": "Safe", "hiking_safety": "Good",
}
SUMMARY_POINTS = [
    {"icon": "temperature", "text": "Mild and clear, low 20s"},
    {"icon": "clothing", "text": "Light layers should be plenty"},
]


def _create_trip(auth_client, monkeypatch, start_date, end_date, destination="London"):
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    response = auth_client.post("/api/trips/", json={
        "name": "Test Trip",
        "destination": destination,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    })
    return response.json()["id"]


def _send_daily_summaries():
    async def _inner():
        async with _TestSessionLocal() as db:
            return await send_daily_summaries(db)
    return asyncio.run(_inner())


def _mock_weather(monkeypatch, forecast=None):
    forecast = forecast if forecast is not None else [SUNNY_DAY]
    monkeypatch.setattr(
        "services.daily_summary_service.get_weather_prediction",
        lambda lat, lon, start, end: forecast,
    )


def _mock_generate_summary(monkeypatch, points=None):
    monkeypatch.setattr(
        "services.daily_summary_service.generate_weather_summary",
        AsyncMock(return_value=points if points is not None else SUMMARY_POINTS),
    )


def _mock_send_email(monkeypatch):
    mock_send = MagicMock(return_value={"status": "sent"})
    monkeypatch.setattr("services.daily_summary_service.email_service.send_email", mock_send)
    return mock_send


# send_daily_summaries() operates over every ongoing trip in the (shared,
# real) dev DB by design — these tests scope assertions to the trip_id they
# created rather than the raw return value, same convention as
# test_auto_swap_service.py/test_notifications.py.


def test_sends_a_summary_for_a_trip_ongoing_today(auth_client, monkeypatch):
    # A distinctive destination (not the "London" every other test/trip in
    # the shared dev DB defaults to) so this test's email is unambiguously
    # identifiable among whatever else send_daily_summaries() also emails
    # in the same run.
    trip_id = _create_trip(auth_client, monkeypatch, TODAY, TODAY + timedelta(days=2), destination="Zurich")
    _mock_weather(monkeypatch)
    _mock_generate_summary(monkeypatch)
    mock_send = _mock_send_email(monkeypatch)

    results = _send_daily_summaries()
    our_results = [r for r in results if r["trip_id"] == trip_id]

    assert len(our_results) == 1
    assert our_results[0]["status"] == "sent"

    our_call = next(c for c in mock_send.call_args_list if "Zurich" in c.args[1])
    subject, html_body, text_body = our_call.args[1], our_call.args[2], our_call.args[3]
    assert "Zurich" in subject
    assert "Light layers should be plenty" in text_body
    assert "🌡️" in html_body  # the "temperature" icon key mapped to its emoji


def test_skips_a_trip_that_has_not_started_yet(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch, TODAY + timedelta(days=1), TODAY + timedelta(days=5))
    _mock_weather(monkeypatch)
    _mock_generate_summary(monkeypatch)
    _mock_send_email(monkeypatch)

    results = _send_daily_summaries()

    assert [r for r in results if r["trip_id"] == trip_id] == []


def test_skips_a_trip_that_has_already_ended(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch, TODAY - timedelta(days=5), TODAY - timedelta(days=1))
    _mock_weather(monkeypatch)
    _mock_generate_summary(monkeypatch)
    _mock_send_email(monkeypatch)

    results = _send_daily_summaries()

    assert [r for r in results if r["trip_id"] == trip_id] == []


def test_one_trips_claude_failure_does_not_block_another_trips_summary(auth_client, monkeypatch, other_auth_client):
    failing_trip_id = _create_trip(auth_client, monkeypatch, TODAY, TODAY + timedelta(days=2))
    ok_trip_id = _create_trip(other_auth_client, monkeypatch, TODAY, TODAY + timedelta(days=2))
    _mock_weather(monkeypatch)
    _mock_send_email(monkeypatch)

    async def _generate(trip, weather_day):
        if trip.id == failing_trip_id:
            raise RuntimeError("Claude API down")
        return SUMMARY_POINTS
    monkeypatch.setattr("services.daily_summary_service.generate_weather_summary", _generate)

    results = _send_daily_summaries()

    assert [r for r in results if r["trip_id"] == failing_trip_id] == []
    ok_results = [r for r in results if r["trip_id"] == ok_trip_id]
    assert len(ok_results) == 1
    assert ok_results[0]["status"] == "sent"
