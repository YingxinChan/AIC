def test_forecast_requires_auth(client):
    response = client.get("/api/weather/forecast?start=2026-08-01&end=2026-08-07")
    assert response.status_code == 401

def test_forecast_returns_stub(auth_client):
    response = auth_client.get("/api/weather/forecast?start=2026-08-01&end=2026-08-07")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"
