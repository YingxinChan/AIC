# Run: python -m pytest tests/test_climatology_service.py
from datetime import date
from unittest.mock import MagicMock, patch

from services.climatology_service import (
    _climatology_day,
    _fetch_historical_rows,
    _rows_near_target,
    get_climatology_days,
    _within_day_window,
    _safe_replace_year,
    _summarize_climatology_rows,
)


def test_get_historical_forecast_requests_every_field_fetch_historical_rows_reads():
    """Regression test: _fetch_historical_rows() reads temp_max, temp_min,
    weather_code, rain_mm, and wind off get_historical_forecast()'s daily
    response — but every other test in this file mocks get_historical_forecast()
    itself with a hand-built dict that already includes all of those fields,
    so none of them would catch it if the *real* function stopped actually
    requesting one from the Archive API. That's exactly what happened:
    "wind_speed_10m_mean" was missing from get_historical_forecast()'s own
    requested daily fields (openmeteo.py) while _fetch_historical_rows()
    read it anyway — every mocked test stayed green, and it only surfaced as
    a KeyError against the real Archive API (i.e. in production, not here).

    This test instead mocks only the raw HTTP call (services.openmeteo.
    requests.get), so it exercises get_historical_forecast()'s actual query
    construction and would have caught the mismatch directly."""
    mock_response = MagicMock(status_code=200)
    mock_response.json.return_value = {
        "daily": {
            "time": ["2020-07-01"],
            "weather_code": [1],
            "precipitation_sum": [0.0],
            "temperature_2m_max": [20.0],
            "temperature_2m_min": [10.0],
            "wind_speed_10m_mean": [8.0],
        },
    }

    with patch("services.openmeteo.requests.get", return_value=mock_response) as mock_get:
        rows = _fetch_historical_rows(48.8566, 2.3522, [date(2026, 7, 1)])

    requested_url = mock_get.call_args.args[0]
    assert "wind_speed_10m_mean" in requested_url
    assert rows[0]["wind"] == 8.0

def test_one_bad_climatology_date_does_not_drop_the_batch():
    dates = [
        date(2026, 7, 1),
        date(2026, 7, 2),
        date(2026, 7, 3),
    ]

    historical_response = {
        "daily": {
            "time": [
                "2023-07-01",
                "2023-07-02",
                "2023-07-03",
            ],
            "temperature_2m_max": [20.0, 21.0, 22.0],
            "temperature_2m_min": [10.0, 11.0, 12.0],
            "weather_code": [1, 2, 3],
            "precipitation_sum": [0.0, 1.0, 2.0],
            "wind_speed_10m_mean": [8.0, 9.0, 10.0],
        },
    }

    real_summarize = _summarize_climatology_rows

    def summarize_with_one_failure(target, rows, lat, lon, utc_offset_seconds):
        if target == date(2026, 7, 2) and rows:
            raise TypeError("unexpected archive value")

        return real_summarize(target, rows, lat, lon, utc_offset_seconds)

    with patch(
        "services.climatology_service.get_historical_forecast",
        return_value=historical_response,
    ), patch(
        "services.climatology_service.get_forecast",
        return_value={"utc_offset_seconds": 0},
    ), patch(
        "services.climatology_service._summarize_climatology_rows",
        side_effect=summarize_with_one_failure,
    ):
        results = get_climatology_days(
            51.5074,
            -0.1278,
            dates,
        )

    assert len(results) == 3

    assert results[0]["date"] == "2026-07-01"
    assert results[1]["date"] == "2026-07-02"
    assert results[2]["date"] == "2026-07-03"

    assert results[1]["condition"] == "Unknown"
    assert results[1]["weather_code"] is None
    assert results[1]["temp_max"] is None
    assert results[1]["temp_min"] is None
    
def test_safe_replace_year_handles_leap_day_into_non_leap_year():
    feb_29_2024 = date(2024, 2, 29)
    assert _safe_replace_year(feb_29_2024, 2023) == date(2023, 2, 28)


def test_safe_replace_year_normal_case():
    assert _safe_replace_year(date(2026, 8, 12), 2020) == date(2020, 8, 12)


def test_within_day_window_matches_close_dates():
    target = date(2026, 8, 12)
    assert _within_day_window(date(2019, 8, 10), target)  # 2 days before, different year
    assert _within_day_window(date(2019, 8, 15), target)  # 3 days after, at the edge
    assert not _within_day_window(date(2019, 8, 20), target)  # too far


def test_within_day_window_handles_year_wraparound():
    # Target near the turn of the year should still match late-Dec dates
    # from the "previous" year and early-Jan dates from the "next" year.
    target = date(2026, 1, 2)
    assert _within_day_window(date(2019, 12, 31), target)
    assert _within_day_window(date(2020, 1, 4), target)
    assert not _within_day_window(date(2019, 6, 15), target)


def test_rows_near_target_filters_to_the_day_window():
    # A fake archive response spanning a wide range — only the rows within
    # DAY_WINDOW_DAYS of the target's month/day (in any of the sampled
    # years) should survive the filter.
    fake_daily = {
        "time": ["2016-08-10", "2016-08-12", "2016-09-01", "2017-08-13"],
        "temperature_2m_max": [20.0, 22.0, 25.0, 21.0],
        "temperature_2m_min": [12.0, 13.0, 15.0, 12.5],
        "weather_code": [1, 2, 0, 3],
        "precipitation_sum": [0.0, 5.0, 0.0, 1.2],
        "wind_speed_10m_mean": [10.0, 12.0, 11.0, 13.0],
    }

    with patch(
        "services.climatology_service.get_historical_forecast",
        return_value={"daily": fake_daily},
    ) as mocked:
        historical_rows = _fetch_historical_rows(
            51.5074,
            -0.1278,
            [date(2026, 8, 12)],
        )

        rows = _rows_near_target(
            historical_rows,
            date(2026, 8, 12),
        )

        mocked.assert_called_once()
        matched_dates = {row["date"] for row in rows}

        assert matched_dates == {
            date(2016, 8, 10),
            date(2016, 8, 12),
            date(2017, 8, 13),
        }
        assert date(2016, 9, 1) not in matched_dates


def test_get_climatology_days_returns_a_safe_placeholder_per_date():
    dates = [date(2026, 9, 25), date(2026, 9, 26)]

    with patch("services.climatology_service.get_historical_forecast", return_value={
        "daily": {
        "time": [],
        "temperature_2m_max": [],
        "temperature_2m_min": [],
        "weather_code": [],
        "precipitation_sum": [],
        "wind_speed_10m_mean": [],
    },}), patch(
        "services.climatology_service.get_forecast",
        return_value={"utc_offset_seconds": 0},
    ):
        results = get_climatology_days(51.5074, -0.1278, dates)

    assert [r["date"] for r in results] == ["2026-09-25", "2026-09-26"]
    for day in results:
        assert day["is_climatology"] is True
        # No fake-but-realistic numbers — honest "not computed yet" placeholders.
        assert day["flood_score"] is None
        assert day["flood_risk"] == "Unknown"
        assert day["beach_safety_score"] is None
        assert day["snow_probability"] is None


def test_get_climatology_days_survives_a_failed_historical_fetch():
    """The archive API being down for one date shouldn't crash the whole
    batch — every date still gets a placeholder day back."""
    dates = [date(2026, 9, 25), date(2026, 9, 26)]

    with patch(
        "services.climatology_service.get_historical_forecast",
        side_effect=Exception("archive API is down"),
    ), patch(
        "services.climatology_service.get_forecast",
        return_value={"utc_offset_seconds": 0},
    ):
        results = get_climatology_days(51.5074, -0.1278, dates)

    assert len(results) == 2
    assert all(r["is_climatology"] for r in results)
    assert all(r["flood_score"] is None for r in results)


def test_get_climatology_days_calculates_values_from_historical_api_data():
    dates = [date(2026, 7, 1)]

    historical_response = {
        "daily": {
            "time": [
                "2023-07-01",
                "2024-07-01",
                "2025-07-01",
                "2025-08-01",
            ],
            "temperature_2m_max": [20.0, 24.0, 22.0, 99.0],
            "temperature_2m_min": [10.0, 12.0, 11.0, 99.0],
            "weather_code": [3, 3, 1, 99],
            "precipitation_sum": [0.0, 2.0, 3.0, 99.0],
            "wind_speed_10m_mean": [10.0, 12.0, 11.0, 13.0],
        },
    }

    with patch(
        "services.climatology_service.get_historical_forecast",
        return_value=historical_response,
    ) as mocked, patch(
        "services.climatology_service.get_forecast",
        return_value={"utc_offset_seconds": 0},
    ):
        results = get_climatology_days(
            51.5074,
            -0.1278,
            dates,
        )

    assert len(results) == 1

    result = results[0]

    assert result["date"] == "2026-07-01"
    assert result["is_climatology"] is True
    assert result["temp_max"] == 22.0
    assert result["temp_min"] == 11.0
    assert result["weather_code"] == 3
    assert result["rain_chance"] == 66.7

    mocked.assert_called_once_with(
        51.5074,
        -0.1278,
        "2016-07-01",
        "2025-07-01",
    )

def test_summarize_climatology_rows_calculates_averages():

    rows = [
        {
            "date": date(2023, 7, 1),
            "temp_max": 20.0,
            "temp_min": 10.0,
            "weather_code": 3,
            "rain_mm": 0.0,
            "wind": 10.0,
        },
        {
            "date": date(2024, 7, 1),
            "temp_max": 24.0,
            "temp_min": 12.0,
            "weather_code": 3,
            "rain_mm": 2.0,
            "wind": 14.0,
        },
        {
            "date": date(2025, 7, 1),
            "temp_max": 22.0,
            "temp_min": 11.0,
            "weather_code": 1,
            "rain_mm": 3.0,
            "wind": 12.0,
        },
    ]

    result = _summarize_climatology_rows(
        date(2026, 7, 1),
        rows,
        51.5074,
        -0.1278,
        0,
    )

    assert result["is_climatology"] is True
    assert result["temp_max"] == 22.0
    assert result["temp_min"] == 11.0
    assert result["weather_code"] == 3
    assert result["rain_chance"] == 66.7
    # Regression test: sunrise/sunset are pure astronomy (date + lat/lon,
    # see _sunrise_sunset in climatology_service.py) — real values either way,
    # not blanked out just because this is a climatology day.
    assert result["sunrise"] is not None
    assert result["sunset"] is not None
    assert result["utc_offset_seconds"] == 0

def test_summarize_climatology_rows_empty_rows():

    result = _summarize_climatology_rows(
        date(2026, 7, 1),
        [],
        51.5074,
        -0.1278,
        0,
    )

    assert result["is_climatology"] is True
    assert result["condition"] == "Unknown"
    assert result["temp_max"] is None
    assert result["temp_min"] is None
    assert result["rain_chance"] is None
    # Sunrise/sunset don't depend on historical rows at all — still real
    # even when there's no historical weather data to compute anything else.
    assert result["sunrise"] is not None
    assert result["sunset"] is not None

def test_get_climatology_days_fetches_archive_once_for_multiple_dates():
    dates = [
        date(2026, 7, 1),
        date(2026, 7, 2),
        date(2026, 7, 3),
    ]

    historical_response = {
        "daily": {
            "time": [
                "2023-06-28",
                "2023-07-01",
                "2023-07-02",
                "2023-07-03",
                "2023-07-06",
            ],
            "temperature_2m_max": [20.0, 21.0, 22.0, 23.0, 24.0],
            "temperature_2m_min": [10.0, 11.0, 12.0, 13.0, 14.0],
            "weather_code": [1, 1, 2, 2, 3],
            "precipitation_sum": [0.0, 1.0, 2.0, 0.0, 3.0],
            "wind_speed_10m_mean": [8.0, 9.0, 10.0, 11.0, 12.0],
        },
    }

    with patch(
        "services.climatology_service.get_historical_forecast",
        return_value=historical_response,
    ) as mocked, patch(
        "services.climatology_service.get_forecast",
        return_value={"utc_offset_seconds": 0},
    ):
        results = get_climatology_days(
            51.5074,
            -0.1278,
            dates,
        )

    assert len(results) == 3
    mocked.assert_called_once_with(
        51.5074,
        -0.1278,
        "2016-07-01",
        "2025-07-03",
    )
