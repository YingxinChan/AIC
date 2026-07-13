def test_prediction_requires_auth(client):
    response = client.get(
        "/api/weather/prediction?lat=51.5074&lon=-0.1278"
    )
    assert response.status_code == 401


def test_prediction_returns_forecast(auth_client):
    response = auth_client.get(
        "/api/weather/prediction?lat=51.5074&lon=-0.1278"
    )

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 7

    first_day = data[0]

    assert "date" in first_day
    assert "condition" in first_day
    assert "temp_min" in first_day
    assert "temp_max" in first_day
    assert "rain_mm" in first_day
    assert "heavy_rain_probability" in first_day
    assert "heavy_rain_warning" in first_day
    assert "flood_score" in first_day
    assert "flood_risk" in first_day
    assert "beach_safety_score" in first_day
    assert "beach_safety_level" in first_day
    assert "snow_probability" in first_day