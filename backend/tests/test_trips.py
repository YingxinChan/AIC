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