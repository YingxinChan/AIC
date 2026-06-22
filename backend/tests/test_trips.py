def test_list_trips_requires_auth(client):
    response = client.get("/api/trips/")
    assert response.status_code == 401

def test_list_trips_returns_stub(auth_client):
    response = auth_client.get("/api/trips/")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"

def test_create_trip_requires_auth(client):
    response = client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    assert response.status_code == 401

def test_create_trip_returns_stub(auth_client):
    response = auth_client.post("/api/trips/", json={
        "name": "Summer Trip", "start_date": "2026-08-01", "end_date": "2026-08-07"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"

def test_get_trip_returns_stub(auth_client):
    response = auth_client.get("/api/trips/1")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"

def test_delete_trip_returns_204(auth_client):
    response = auth_client.delete("/api/trips/1")
    assert response.status_code == 204
