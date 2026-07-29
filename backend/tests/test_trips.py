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

    trip = response.json()
    assert trip["arrival_flight_number"] == "BA 112"
    assert trip["arrival_airline"] == "British Airways"
    assert trip["arrival_time"] == "14:00"
    assert trip["departure_time"] == ""

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

    trip = response.json()
    # arrival should be untouched by the departure update
    assert trip["arrival_flight_number"] == "BA 112"
    assert trip["departure_flight_number"] == "FR 3110"
    assert trip["departure_airline"] == "Ryanair"
    assert trip["departure_time"] == "09:00"

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
    trip = arrival.json()
    assert trip["arrival_time"] == "14:00"
    assert trip["arrival_other_time"] == "08:00"

    departure = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "departure", "flight_number": "FR 3110", "airline": "Ryanair",
        "time": "09:00", "other_time": "10:15",
    })
    assert departure.status_code == 200
    trip = departure.json()
    assert trip["departure_time"] == "09:00"
    assert trip["departure_other_time"] == "10:15"
    # arrival's other_time should be untouched by the departure update
    assert trip["arrival_other_time"] == "08:00"

def test_select_flight_other_time_defaults_to_empty_string(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.status_code == 200
    assert response.json()["arrival_other_time"] == ""

def test_select_flight_does_not_auto_regenerate_itinerary(auth_client):
    # Regression guard: flight edits are batched with dates/hotel edits on
    # the frontend and regenerated once via a separate explicit call — this
    # PATCH must return the trip, not itinerary data.
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}/flight", json={
        "leg": "arrival", "flight_number": "BA 112", "airline": "British Airways", "time": "14:00"
    })
    assert response.status_code == 200
    assert "days" not in response.json()

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

def test_update_trip_requires_auth(client):
    response = client.patch("/api/trips/1", json={"hotel_address": "The Ritz"})
    assert response.status_code == 401

def test_update_trip_persists_hotel_address(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={"hotel_address": "The Ritz, London"})
    assert response.status_code == 200
    assert response.json()["hotel_address"] == "The Ritz, London"

    trip = auth_client.get(f"/api/trips/{trip_id}").json()
    assert trip["hotel_address"] == "The Ritz, London"

def test_update_trip_persists_dates(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={
        "start_date": "2026-08-02", "end_date": "2026-08-09",
    })
    assert response.status_code == 200
    assert response.json()["start_date"] == "2026-08-02"
    assert response.json()["end_date"] == "2026-08-09"

def test_update_trip_partial_patch_leaves_other_fields_untouched(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07",
        "hotel_address": "The Ritz, London",
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={"start_date": "2026-08-03"})
    assert response.status_code == 200
    trip = response.json()
    assert trip["start_date"] == "2026-08-03"
    assert trip["end_date"] == "2026-08-07"
    assert trip["hotel_address"] == "The Ritz, London"

def test_update_trip_rejects_end_date_before_start_date(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={
        "start_date": "2026-08-10", "end_date": "2026-08-05",
    })
    assert response.status_code == 400

    trip = auth_client.get(f"/api/trips/{trip_id}").json()
    assert trip["start_date"] == "2026-08-01"  # unchanged — rejected before saving
    assert trip["end_date"] == "2026-08-07"

def test_update_trip_rejects_end_date_equal_to_start_date(auth_client):
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={
        "start_date": "2026-08-07", "end_date": "2026-08-07",
    })
    assert response.status_code == 400

def test_update_trip_rejects_a_partial_start_date_patch_that_crosses_the_existing_end_date(auth_client):
    # Regression test: patching only start_date (leaving end_date untouched)
    # must still be validated against the trip's *existing* end_date, not
    # skipped just because end_date wasn't part of this request.
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={"start_date": "2026-08-09"})
    assert response.status_code == 400

    trip = auth_client.get(f"/api/trips/{trip_id}").json()
    assert trip["start_date"] == "2026-08-01"  # unchanged

def test_update_trip_ignores_origin_since_it_is_permanently_locked(auth_client):
    # Origin (like destination) is fixed once a trip is created — passing it
    # here must have no effect, not silently accepted.
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07",
        "origin": "London, UK",
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={"origin": "Paris, France"})
    assert response.status_code == 200
    assert response.json()["origin"] == "London, UK"

def test_update_trip_does_not_auto_regenerate_itinerary(auth_client):
    # Regression guard: dates/hotel edits are batched with flight edits on the
    # frontend and regenerated once via a separate explicit call — this PATCH
    # must return the trip, not itinerary data, and must not touch activities.
    create = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    trip_id = create.json()["id"]

    response = auth_client.patch(f"/api/trips/{trip_id}", json={"hotel_address": "The Ritz, London"})
    assert response.status_code == 200
    assert "days" not in response.json()

def test_update_trip_404_when_not_found(auth_client):
    response = auth_client.patch("/api/trips/999999", json={"hotel_address": "The Ritz"})
    assert response.status_code == 404