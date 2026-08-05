# Run: python -m pytest tests/test_weather_service.py
#
# Unit-level tests for the forecast/climatology split in
# get_weather_prediction() — _get_forecast_days() and get_climatology_days()
# are each exercised elsewhere (test_weather.py hits the real forecast API
# end-to-end; test_climatology_service.py covers the climatology internals),
# so these mock both out and only check the orchestration: does the right
# date range go to the right place, in the right order, without one
# breaking the other.

from datetime import date, timedelta
from unittest.mock import patch

import pandas as pd

from services.weather_service import get_weather_prediction, _get_forecast_days, FORECAST_HORIZON_DAYS


def _forecast_day(d: date) -> dict:
    return {"date": d.isoformat(), "is_climatology": False}


def _climatology_day(d: date) -> dict:
    return {"date": d.isoformat(), "is_climatology": True}


def test_range_entirely_within_horizon_never_calls_climatology():
    today = date.today()
    start, end = today, today + timedelta(days=3)

    with patch("services.weather_service._get_forecast_days") as mock_forecast, \
         patch("services.weather_service.get_climatology_days") as mock_climatology:
        mock_forecast.return_value = [_forecast_day(start + timedelta(days=i)) for i in range(4)]

        result = get_weather_prediction(1.0, 1.0, start.isoformat(), end.isoformat())

    mock_forecast.assert_called_once_with(1.0, 1.0, start.isoformat(), end.isoformat())
    mock_climatology.assert_not_called()
    assert len(result) == 4
    assert all(not d["is_climatology"] for d in result)


def test_range_entirely_beyond_horizon_never_calls_forecast():
    today = date.today()
    start = today + timedelta(days=FORECAST_HORIZON_DAYS + 10)
    end = start + timedelta(days=2)

    with patch("services.weather_service._get_forecast_days") as mock_forecast, \
         patch("services.weather_service.get_climatology_days") as mock_climatology:
        mock_climatology.return_value = [_climatology_day(start + timedelta(days=i)) for i in range(3)]

        result = get_weather_prediction(1.0, 1.0, start.isoformat(), end.isoformat())

    mock_forecast.assert_not_called()
    mock_climatology.assert_called_once()
    called_dates = mock_climatology.call_args[0][2]
    assert called_dates == [start + timedelta(days=i) for i in range(3)]
    assert len(result) == 3
    assert all(d["is_climatology"] for d in result)


def test_range_straddling_the_horizon_splits_at_the_right_day_and_merges_in_order():
    today = date.today()
    horizon = today + timedelta(days=FORECAST_HORIZON_DAYS)
    start = horizon - timedelta(days=2)   # 2 days inside the horizon
    end = horizon + timedelta(days=2)     # 2 days outside it

    with patch("services.weather_service._get_forecast_days") as mock_forecast, \
         patch("services.weather_service.get_climatology_days") as mock_climatology:
        forecast_days = [start + timedelta(days=i) for i in range((horizon - start).days + 1)]
        climatology_days = [horizon + timedelta(days=i) for i in range(1, (end - horizon).days + 1)]
        mock_forecast.return_value = [_forecast_day(d) for d in forecast_days]
        mock_climatology.return_value = [_climatology_day(d) for d in climatology_days]

        result = get_weather_prediction(1.0, 1.0, start.isoformat(), end.isoformat())

    mock_forecast.assert_called_once_with(1.0, 1.0, start.isoformat(), horizon.isoformat())
    mock_climatology.assert_called_once()
    assert mock_climatology.call_args[0][2] == climatology_days

    # merged, contiguous, date-sorted, and the split lands exactly at the horizon
    assert [d["date"] for d in result] == [d.isoformat() for d in forecast_days + climatology_days]
    assert [d["is_climatology"] for d in result] == (
        [False] * len(forecast_days) + [True] * len(climatology_days)
    )


def test_climatology_failure_does_not_take_out_the_forecast_portion():
    today = date.today()
    horizon = today + timedelta(days=FORECAST_HORIZON_DAYS)
    start = horizon - timedelta(days=1)
    end = horizon + timedelta(days=3)

    with patch("services.weather_service._get_forecast_days") as mock_forecast, \
         patch("services.weather_service.get_climatology_days", side_effect=Exception("archive API down")):
        mock_forecast.return_value = [_forecast_day(start), _forecast_day(horizon)]

        result = get_weather_prediction(1.0, 1.0, start.isoformat(), end.isoformat())

    # The forecast days that *did* succeed are still returned even though
    # the climatology portion blew up.
    assert len(result) == 2
    assert all(not d["is_climatology"] for d in result)


class _FakePredictor:
    """predict() returns, for row i, the model's probability of heavy rain
    on day i+1 (see ml/scripts/train_lgbm.py's heavy_rain_day1 target) —
    exactly what the real WeatherPredictor does, just with fixed values so
    the test can assert on which day each prediction ends up attached to."""
    def __init__(self, predictions):
        self._predictions = predictions

    def predict(self, features_df):
        return self._predictions


def _fake_features(n_days: int) -> pd.DataFrame:
    today = pd.Timestamp(date.today())
    return pd.DataFrame({
        "date": [today + timedelta(days=i) for i in range(n_days)],
        "weather_code": [1] * n_days,
        "temp_min": [10.0] * n_days,
        "temp_max": [20.0] * n_days,
        "rain": [0.0] * n_days,
        "wind": [5.0] * n_days,
        "visibility": [10000.0] * n_days,
        "sunrise": ["06:00 AM"] * n_days,
        "sunset": ["08:00 PM"] * n_days,
        "uv_index": [3.0] * n_days,
        "feels_like_temp": [18.0] * n_days,
        "temp": [15.0] * n_days,
        "snowfall": [0.0] * n_days,
        "max_hourly_rain": [0.0] * n_days,
    })


def test_forecast_days_attach_each_prediction_to_the_day_it_actually_predicts():
    """predictor.predict()'s row i is a prediction FOR day i+1 (trained on
    today's conditions to predict tomorrow's heavy rain) — not for day i
    itself. Regression test for the bug where day i was shown its own
    next-day prediction as if it described day i's own risk, which then
    fed into that day's flood/beach/hiking calculations alongside day i's
    real, same-day rain/wind/temp."""
    features = _fake_features(3)
    predictions = [
        {"heavy_rain_probability": 11.0, "heavy_rain_warning": True},   # predicts day 1
        {"heavy_rain_probability": 22.0, "heavy_rain_warning": False},  # predicts day 2
        {"heavy_rain_probability": 33.0, "heavy_rain_warning": True},   # predicts day 3 (not in output)
    ]

    with patch("services.weather_service.get_forecast") as mock_get_forecast, \
         patch("services.weather_service.build_features", return_value=features), \
         patch("services.weather_service.get_predictor", return_value=_FakePredictor(predictions)):
        mock_get_forecast.return_value = {
            "utc_offset_seconds": 0,
            "hourly": {"time": [], "uv_index": []},
        }
        results = _get_forecast_days(1.0, 1.0, date.today().isoformat(), (date.today() + timedelta(days=2)).isoformat())

    assert len(results) == 3
    # Day 0 (today) has no prior day's features to have derived a
    # prediction from — neutral default, not its own next-day prediction.
    assert results[0]["heavy_rain_probability"] == 0.0
    assert results[0]["heavy_rain_warning"] is False
    # Day 1 gets predictions[0] (computed from day 0's features).
    assert results[1]["heavy_rain_probability"] == 11.0
    assert results[1]["heavy_rain_warning"] is True
    # Day 2 gets predictions[1] (computed from day 1's features) — NOT
    # predictions[2], which describes a day beyond this range.
    assert results[2]["heavy_rain_probability"] == 22.0
    assert results[2]["heavy_rain_warning"] is False

