def test_flight_search_requires_auth(client):
    response = client.get("/api/flights/search?origin=JFK&departure=2026-08-01&return_date=2026-08-07")
    assert response.status_code == 401

def test_flight_search_returns_stub(auth_client):
    response = auth_client.get("/api/flights/search?origin=JFK&departure=2026-08-01&return_date=2026-08-07")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"
