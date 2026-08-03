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

from services.weather_service import get_weather_prediction, FORECAST_HORIZON_DAYS


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
    
