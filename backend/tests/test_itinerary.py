def test_get_itinerary_requires_auth(client):
    response = client.get("/api/trips/1/itinerary/")
    assert response.status_code == 401

def test_get_itinerary_returns_stub(auth_client):
    response = auth_client.get("/api/trips/1/itinerary/")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"

def test_generate_itinerary_returns_job_id(auth_client):
    response = auth_client.post("/api/trips/1/itinerary/generate")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "stub-job-id"
    assert data["status"] == "queued"

def test_swap_activity_returns_stub(auth_client):
    response = auth_client.patch("/api/trips/1/itinerary/activities/1/swap",
                                  json={"swap_to": "indoor"})
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"
