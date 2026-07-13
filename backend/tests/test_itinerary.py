import json
from unittest.mock import AsyncMock, MagicMock


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
