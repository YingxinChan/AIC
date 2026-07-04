def test_flight_search_returns_flights(auth_client):
    response = auth_client.get("/api/flights/search?origin=Paris&departure=2026-08-01&return_date=2026-08-07")
    assert response.status_code == 200
    flights = response.json()["flights"]
    assert len(flights) > 0
    assert all(f["departure_city"] == "Paris" for f in flights)