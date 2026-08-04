# Run: python -m pytest tests/test_weather.py
from datetime import date, timedelta
from unittest.mock import patch

from services.weather_service import FORECAST_HORIZON_DAYS


def test_prediction_beyond_horizon_falls_back_to_climatology_with_no_historical_data(
    auth_client,
):
    far_start_date = (
        date.today()
        + timedelta(days=FORECAST_HORIZON_DAYS + 5)
    )

    far_end_date = far_start_date + timedelta(days=1)

    empty_historical_response = {
        "daily": {
            "time": [],
            "temperature_2m_max": [],
            "temperature_2m_min": [],
            "weather_code": [],
            "precipitation_sum": [],
            "wind_speed_10m_mean": [],
        },
    }

    with patch(
        "services.climatology_service.get_historical_forecast",
        return_value=empty_historical_response,
    ):
        response = auth_client.get(
            "/api/weather/prediction"
            f"?lat=51.5074"
            f"&lon=-0.1278"
            f"&start_date={far_start_date.isoformat()}"
            f"&end_date={far_end_date.isoformat()}"
        )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert all(day["is_climatology"] is True for day in data)
    assert all(day["weather_code"] is None for day in data)
    assert all(day["condition"] == "Unknown" for day in data)

def test_prediction_beyond_horizon_falls_back_to_climatology_with_real_historical_data(
    auth_client,
):
    far_start = (
        date.today()
        + timedelta(days=FORECAST_HORIZON_DAYS + 5)
    ).isoformat()

    far_end = (
        date.today()
        + timedelta(days=FORECAST_HORIZON_DAYS + 6)
    ).isoformat()

    response = auth_client.get(
        "/api/weather/prediction"
        f"?lat=51.5074"
        f"&lon=-0.1278"
        f"&start_date={far_start}"
        f"&end_date={far_end}"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert all(day["is_climatology"] is True for day in data)
    assert all("weather_code" in day for day in data)
    # Regression test: sunrise/sunset are pure astronomy (date + lat/lon, see
    # _sunrise_sunset in climatology_service.py), not weather — real values
    # even on a climatology day, unlike everything else that needs
    # historical data.
    assert all(day["sunrise"] is not None for day in data)
    assert all(day["sunset"] is not None for day in data)

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
    assert "uv_level" in first_day
    assert "uv_advice" in first_day
    assert all(
        isinstance(day["uv_advice"], str) and day["uv_advice"]
        for day in data
    )
    # Regression test: visibility_m was computed in weather_service.py but
    # missing from the ForecastDayOut response_model, so FastAPI silently
    # stripped it from the response — the frontend's `visibility_m / 1000`
    # then rendered "NaN km" on the Visibility card instead of a real value.
    assert "visibility_km" in first_day
    assert "visibility_m" in first_day
    assert isinstance(first_day["visibility_m"], (int, float))


def test_hourly_returns_forecast(auth_client):
    response = auth_client.get(
        "/api/weather/hourly?lat=51.5074&lon=-0.1278"
    )

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0

    first_hour = data[0]

    assert "time" in first_hour
    assert "temperature" in first_hour
    assert "feels_like_temp" in first_hour
    assert "rain_mm" in first_hour
    assert "rain_probability" in first_hour
    assert "wind_speed" in first_hour
    assert "uv_index" in first_hour
    assert "visibility_km" in first_hour
    assert "condition" in first_hour
    # Regression test: get_hourly_weather sets utc_offset_seconds per entry
    # (services/weather_service.py) but this test wasn't updated to check for
    # it, so a future schema change silently dropping it (same failure mode
    # as the visibility_m bug above) would go unnoticed.
    assert "utc_offset_seconds" in first_hour


def test_hourly_beyond_horizon_returns_empty_without_erroring(auth_client):
    # Regression test: get_hourly_weather used to pass the full requested
    # range straight to Open-Meteo's forecast API with no horizon check.
    # Open-Meteo 400s on start_date/end_date beyond its forecast window, so
    # any trip planned more than FORECAST_HORIZON_DAYS out made this endpoint
    # raise — which the frontend's Promise.all([prediction, hourly]) turned
    # into "Weather unavailable for this destination" for the *whole* trip,
    # even though /prediction's climatology fallback had real data.
    far_start = (
        date.today() + timedelta(days=FORECAST_HORIZON_DAYS + 5)
    ).isoformat()
    far_end = (
        date.today() + timedelta(days=FORECAST_HORIZON_DAYS + 6)
    ).isoformat()

    response = auth_client.get(
        "/api/weather/hourly"
        f"?lat=51.5074"
        f"&lon=-0.1278"
        f"&start_date={far_start}"
        f"&end_date={far_end}"
    )

    assert response.status_code == 200
    assert response.json() == []


def test_hourly_spanning_horizon_only_covers_in_horizon_days(auth_client):
    start = date.today().isoformat()
    end = (
        date.today() + timedelta(days=FORECAST_HORIZON_DAYS + 5)
    ).isoformat()

    response = auth_client.get(
        "/api/weather/hourly"
        f"?lat=51.5074"
        f"&lon=-0.1278"
        f"&start_date={start}"
        f"&end_date={end}"
    )

    assert response.status_code == 200

    data = response.json()
    assert len(data) > 0

    horizon = (
        date.today() + timedelta(days=FORECAST_HORIZON_DAYS)
    ).isoformat()
    assert all(hour["time"][:10] <= horizon for hour in data)

