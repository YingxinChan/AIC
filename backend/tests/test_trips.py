import json
from unittest.mock import AsyncMock, MagicMock


def test_list_trips_requires_auth(client):
    response = client.get("/api/trips/")
    assert response.status_code == 401

def test_create_trip_requires_auth(client):
    response = client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    assert response.status_code == 401

def test_create_trip_returns_id(auth_client):
    response = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    assert response.status_code == 200
    assert "id" in response.json()

def test_list_trips_returns_created_trip(auth_client):
    auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    response = auth_client.get("/api/trips/")
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) == 1
    assert trips[0]["name"] == "Summer Trip"

def test_get_trip_returns_created_trip(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]
    response = auth_client.get(f"/api/trips/{trip_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Summer Trip"

def test_create_trip_persists_original_plan(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07",
        "original_plan": "Want to visit the Tate Modern and catch a show.",
    })
    trip_id = create.json()["id"]
    response = auth_client.get(f"/api/trips/{trip_id}")
    assert response.status_code == 200
    assert response.json()["original_plan"] == "Want to visit the Tate Modern and catch a show."

def test_create_trip_defaults_original_plan_to_empty_string(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]
    response = auth_client.get(f"/api/trips/{trip_id}")
    assert response.json()["original_plan"] == ""

def test_get_trip_404_when_not_found(auth_client):
    response = auth_client.get("/api/trips/999999")
    assert response.status_code == 404

def test_delete_trip_returns_204(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]
    response = auth_client.delete(f"/api/trips/{trip_id}")
    assert response.status_code == 204

def test_delete_trip_404_when_not_found(auth_client):
    response = auth_client.delete("/api/trips/999999")
    assert response.status_code == 404

def test_delete_trip_with_generated_activities_returns_204(auth_client, monkeypatch):
    # Regression test: deleting a trip that already has AI-generated activities
    # used to 500 with a ForeignKeyViolationError since activities.trip_id had
    # no ON DELETE CASCADE and delete_trip never cleaned them up first.
    monkeypatch.setattr("services.itinerary_service.settings.anthropic_api_key", "fake-key")
    fake_days = {"days": [{"activities": [
        {"name": "British Museum", "type": "indoor", "time_slot": "09:00 - 11:00",
         "location": "Great Russell St", "description": "x"},
    ]}]}
    fake_block = MagicMock(type="text", text=json.dumps(fake_days))
    fake_response = MagicMock(content=[fake_block])
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=fake_response)
    monkeypatch.setattr(
        "services.itinerary_service.anthropic.AsyncAnthropic",
        lambda **kwargs: mock_client,
    )

    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-01"
    })
    trip_id = create.json()["id"]
    generate = auth_client.post(f"/api/trips/{trip_id}/itinerary/generate")
    assert generate.status_code == 200
    assert len(generate.json()["days"]) == 1  # confirm activities were actually created

    response = auth_client.delete(f"/api/trips/{trip_id}")
    assert response.status_code == 204

def test_select_flight_requires_auth(client):
    response = client.patch("/api/trips/1/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.status_code == 401

def test_select_flight_persists_arrival(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["arrival_flight_number"] == "BA 112"
    assert data["arrival_airline"] == "British Airways"
    assert data["arrival_time"] == "14:00"
    assert data["departure_time"] == ""

def test_select_flight_persists_departure_independently(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    response = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "departure", "flight_number": "FR 3110", "airline": "Ryanair", "time": "09:00"
    })
    assert response.status_code == 200
    data = response.json()
    # arrival should be untouched by the departure update
    assert data["arrival_flight_number"] == "BA 112"
    assert data["departure_flight_number"] == "FR 3110"
    assert data["departure_airline"] == "Ryanair"
    assert data["departure_time"] == "09:00"

def test_select_flight_persists_other_time_alongside_the_leg_time(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    arrival = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways",
        "time": "14:00", "other_time": "08:00",
    })
    assert arrival.status_code == 200
    assert arrival.json()["arrival_time"] == "14:00"
    assert arrival.json()["arrival_other_time"] == "08:00"

    departure = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "departure", "flight_number": "FR 3110", "airline": "Ryanair",
        "time": "09:00", "other_time": "10:15",
    })
    assert departure.status_code == 200
    assert departure.json()["departure_time"] == "09:00"
    assert departure.json()["departure_other_time"] == "10:15"
    # arrival's other_time should be untouched by the departure update
    assert departure.json()["arrival_other_time"] == "08:00"

def test_select_flight_other_time_defaults_to_empty_string(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.json()["arrival_other_time"] == ""

def test_select_flight_invalid_leg_returns_400(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "sideways", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.status_code == 400

def test_select_flight_404_when_trip_not_found(auth_client):
    response = auth_client.patch("/api/trips/999999/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.status_code == 404