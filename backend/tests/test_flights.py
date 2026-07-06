def test_flight_search_requires_auth(client):
    response = client.get("/api/flights/search?origin=JFK&departure=2026-08-01&return_date=2026-08-07")
    assert response.status_code == 401

def test_flight_search_returns_flights(auth_client):
    response = auth_client.get("/api/flights/search?origin=Paris&departure=2026-08-01&return_date=2026-08-07")
    assert response.status_code == 200
    flights = response.json()["flights"]
    assert len(flights) > 0
    assert all(f["departure_city"] == "Paris" for f in flights)

def test_flight_search_default_direction_has_no_destination_city(auth_client):
    response = auth_client.get("/api/flights/search?origin=Paris&departure=2026-08-01&return_date=2026-08-07")
    flights = response.json()["flights"]
    assert all("destination_city" not in f for f in flights)

def test_flight_search_departure_direction_reframes_as_leaving_london(auth_client):
    response = auth_client.get(
        "/api/flights/search?origin=Paris&departure=2026-08-01&return_date=2026-08-07&direction=departure"
    )
    assert response.status_code == 200
    flights = response.json()["flights"]
    assert len(flights) > 0
    assert all(f["departure_city"] == "London" for f in flights)
    assert all(f["destination_city"] == "Paris" for f in flights)

def test_flight_search_departure_direction_uses_given_destination_not_hardcoded_london(auth_client):
    response = auth_client.get(
        "/api/flights/search?origin=Berlin&departure=2026-08-01&return_date=2026-08-07"
        "&direction=departure&destination=Paris"
    )
    assert response.status_code == 200
    flights = response.json()["flights"]
    assert len(flights) > 0
    assert all(f["departure_city"] == "Paris" for f in flights)
    assert all(f["destination_city"] == "Berlin" for f in flights)