import json
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

LONDON_COORDS = (51.5074, -0.1278)
TODAY = date.today()


def _create_trip(auth_client, start="2026-08-01", end="2026-08-02", destination=None, original_plan=None, hotel_address=None):
    body = {"name": "Test Trip", "start_date": start, "end_date": end}
    if destination is not None:
        body["destination"] = destination
    if original_plan is not None:
        body["original_plan"] = original_plan
    if hotel_address is not None:
        body["hotel_address"] = hotel_address
    response = auth_client.post("/api/trips/", json=body)
    return response.json()["id"]


def _mock_claude(monkeypatch, fake_days=None):
    fake_days = fake_days or {
        "days": [{"activities": [
            {"name": "British Museum", "type": "indoor", "time_slot": "09:00 - 11:00",
             "location": "Great Russell St", "description": "Explore world history."},
        ]}]
    }
    fake_block = MagicMock(type="text", text=json.dumps(fake_days))
    fake_response = MagicMock(content=[fake_block])
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=fake_response)
    monkeypatch.setattr("services.itinerary_service.settings.anthropic_api_key", "fake-key")
    monkeypatch.setattr(
        "services.itinerary_service.anthropic.AsyncAnthropic",
        lambda **kwargs: mock_client,
    )
    return mock_client


def test_get_itinerary_requires_auth(client):
    response = client.get("/api/trips/1/itinerary/")
    assert response.status_code == 401


def test_get_itinerary_404_for_missing_trip(auth_client):
    response = auth_client.get("/api/trips/999999/itinerary/")
    assert response.status_code == 404


def test_get_itinerary_not_generated_yet(auth_client):
    trip_id = _create_trip(auth_client)
    response = auth_client.get(f"/api/trips/{trip_id}/itinerary/")
    assert response.status_code == 200
    assert response.json()["status"] == "not_generated"


def test_generate_itinerary_without_api_key_returns_not_configured(auth_client, monkeypatch):
    monkeypatch.setattr("services.itinerary_service.settings.anthropic_api_key", "")
    trip_id = _create_trip(auth_client)

    response = auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")
    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"


def test_generate_itinerary_persists_activities(auth_client, monkeypatch):
    fake_days = {
        "days": [
            {"activities": [
                {"name": "British Museum", "type": "indoor", "time_slot": "09:00 - 11:00",
                 "location": "Great Russell St", "description": "Explore world history."},
            ]},
            {"activities": [
                {"name": "Hyde Park", "type": "outdoor", "time_slot": "10:00 - 12:00",
                 "location": "Hyde Park", "description": "Walk through the park."},
            ]},
        ]
    }
    _mock_claude(monkeypatch, fake_days)

    trip_id = _create_trip(auth_client)
    response = auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")
    assert response.status_code == 200

    days = response.json()["days"]
    assert len(days) == 2
    assert days[0]["activities"][0]["name"] == "British Museum"
    assert days[1]["activities"][0]["type"] == "outdoor"

    # GET should now reflect the persisted activities too
    get_response = auth_client.get(f"/api/trips/{trip_id}/itinerary/")
    assert len(get_response.json()["days"]) == 2


def test_generate_itinerary_prompt_excludes_flight_context_when_unset(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client)

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "lands in London" not in prompt
    assert "departs London" not in prompt


def test_generate_itinerary_prompt_includes_only_arrival_when_departure_unset(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client)
    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "lands in London at 14:00" in prompt
    assert "departs London" not in prompt


def test_generate_itinerary_prompt_includes_arrival_and_departure(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client)
    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "departure", "flight_number": "FR 3110", "airline": "Ryanair", "time": "09:00"
    })

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "lands in London at 14:00" in prompt
    assert "departs London at 09:00" in prompt


def test_generate_itinerary_prompt_uses_trip_destination_not_hardcoded_london(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client, destination="Paris")
    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    call = mock_client.messages.create.call_args
    system_prompt = call.kwargs["system"]
    user_prompt = call.kwargs["messages"][0]["content"]

    assert "Paris" in system_prompt
    assert "Paris" in user_prompt
    assert "lands in Paris at 14:00" in user_prompt
    assert "London" not in system_prompt
    assert "London" not in user_prompt


def test_generate_itinerary_prompt_excludes_original_plan_when_unset(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client)

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "already has some ideas" not in prompt


def test_generate_itinerary_prompt_includes_original_plan_when_set(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(
        auth_client,
        original_plan="Really want to see the changing of the guard and a West End show.",
    )

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "already has some ideas" in prompt
    assert "changing of the guard and a West End show" in prompt


def test_generate_itinerary_prompt_orders_day_time_then_plan(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client, original_plan="Visit the Tate Modern.")
    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    # day count/destination, then arrival/departure time, then the user's own plan — in that order
    assert prompt.index("day") < prompt.index("lands in London") < prompt.index("Tate Modern")


def test_generate_itinerary_system_prompt_always_includes_routing_instruction(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client)

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    system_prompt = mock_client.messages.create.call_args.kwargs["system"]
    assert "geographic area" in system_prompt
    assert "one-directional route" in system_prompt


def test_generate_itinerary_prompt_excludes_hotel_when_unset(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client)

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "is staying at" not in prompt


def test_generate_itinerary_prompt_includes_hotel_when_set(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client, hotel_address="45 Park Lane, London W1K 1PN")

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "is staying at 45 Park Lane, London W1K 1PN" in prompt


def test_generate_itinerary_prompt_orders_day_time_hotel_then_plan(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(
        auth_client, original_plan="Visit the Tate Modern.", hotel_address="45 Park Lane, London",
    )
    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert (
        prompt.index("day") < prompt.index("lands in London")
        < prompt.index("is staying at") < prompt.index("Tate Modern")
    )


def test_generate_itinerary_scales_max_tokens_with_trip_length(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client, start="2026-08-01", end="2026-08-14")  # 14 days

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    max_tokens = mock_client.messages.create.call_args.kwargs["max_tokens"]
    assert max_tokens > 4096  # the fixed default that truncated longer trips
    assert max_tokens <= 16000


def test_generate_itinerary_short_trip_keeps_default_max_tokens(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    trip_id = _create_trip(auth_client, start="2026-08-01", end="2026-08-02")  # 2 days

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    assert mock_client.messages.create.call_args.kwargs["max_tokens"] == 4096


def test_generate_itinerary_handles_truncated_json_gracefully(auth_client, monkeypatch):
    fake_block = MagicMock(type="text", text='{"days": [{"activities": [{"name": "Truncated mid')
    fake_response = MagicMock(content=[fake_block])
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=fake_response)
    monkeypatch.setattr("services.itinerary_service.settings.anthropic_api_key", "fake-key")
    monkeypatch.setattr("services.itinerary_service.anthropic.AsyncAnthropic", lambda **kwargs: mock_client)

    trip_id = _create_trip(auth_client)
    response = auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    assert response.status_code == 200
    assert response.json()["status"] == "error"
    assert "cut off" in response.json()["message"]


def test_generate_itinerary_prompts_indoor_for_days_already_forecast_rainy(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    trip_id = _create_trip(auth_client, start=TODAY.isoformat(), end=(TODAY + timedelta(days=2)).isoformat())

    day2 = (TODAY + timedelta(days=1)).isoformat()
    monkeypatch.setattr(
        "services.itinerary_service.get_weather_prediction",
        lambda lat, lon, start, end: [
            {"date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 5.0},
            {"date": day2, "heavy_rain_warning": True, "heavy_rain_probability": 80.0},
            {"date": (TODAY + timedelta(days=2)).isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 3.0},
        ],
    )

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Heavy rain is already forecast for day 2" in prompt
    assert "plan only indoor activities" in prompt


def test_generate_itinerary_omits_rain_mention_when_forecast_is_clear(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    trip_id = _create_trip(auth_client, start=TODAY.isoformat(), end=(TODAY + timedelta(days=1)).isoformat())

    monkeypatch.setattr(
        "services.itinerary_service.get_weather_prediction",
        lambda lat, lon, start, end: [
            {"date": TODAY.isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 5.0},
            {"date": (TODAY + timedelta(days=1)).isoformat(), "heavy_rain_warning": False, "heavy_rain_probability": 2.0},
        ],
    )

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Heavy rain" not in prompt


def test_generate_itinerary_skips_weather_check_beyond_forecast_horizon(auth_client, monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    far_start = (TODAY + timedelta(days=60)).isoformat()
    far_end = (TODAY + timedelta(days=62)).isoformat()
    trip_id = _create_trip(auth_client, start=far_start, end=far_end)

    mock_weather = MagicMock()
    monkeypatch.setattr("services.itinerary_service.get_weather_prediction", mock_weather)

    auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    mock_weather.assert_not_called()
    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Heavy rain" not in prompt


def test_generate_itinerary_succeeds_even_when_weather_fetch_fails(auth_client, monkeypatch):
    _mock_claude(monkeypatch)
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: LONDON_COORDS)
    trip_id = _create_trip(auth_client, start=TODAY.isoformat(), end=(TODAY + timedelta(days=1)).isoformat())

    def _raise(*args, **kwargs):
        raise RuntimeError("weather API down")
    monkeypatch.setattr("services.itinerary_service.get_weather_prediction", _raise)

    response = auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")

    assert response.status_code == 200
    assert "days" in response.json()


def test_swap_activity_returns_stub(auth_client):
    trip_id = _create_trip(auth_client)
    response = auth_client.patch(
        f"/api/trips/{trip_id}/itinerary/activities/1/swap",
        json={"swap_to": "indoor"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"


def test_swap_activity_404_for_missing_trip(auth_client):
    response = auth_client.patch(
        "/api/trips/999999/itinerary/activities/1/swap",
        json={"swap_to": "indoor"},
    )
    assert response.status_code == 404
