# Run: python -m pytest tests/test_climatology_service.py
from datetime import date
from unittest.mock import patch

from services.climatology_service import (
    get_climatology_days,
    _historical_rows_near,
    _within_day_window,
    _safe_replace_year,
)


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


def test_historical_rows_near_filters_to_the_day_window(monkeypatch):
    # A fake archive response spanning a wide range — only the rows within
    # DAY_WINDOW_DAYS of the target's month/day (in any of the sampled
    # years) should survive the filter.
    fake_daily = {
        "time": ["2016-08-10", "2016-08-12", "2016-09-01", "2017-08-13"],
        "temperature_2m_max": [20.0, 22.0, 25.0, 21.0],
        "temperature_2m_min": [12.0, 13.0, 15.0, 12.5],
        "weather_code": [1, 2, 0, 3],
        "precipitation_sum": [0.0, 5.0, 0.0, 1.2],
    }

    with patch(
        "services.climatology_service.get_historical_forecast",
        return_value={"daily": fake_daily},
    ) as mocked:
        rows = _historical_rows_near(51.5074, -0.1278, date(2026, 8, 12))

    mocked.assert_called_once()
    matched_dates = {row["date"] for row in rows}
    assert matched_dates == {date(2016, 8, 10), date(2016, 8, 12), date(2017, 8, 13)}
    assert date(2016, 9, 1) not in matched_dates  # outside the +/- day window


def test_get_climatology_days_returns_a_safe_placeholder_per_date():
    dates = [date(2026, 9, 25), date(2026, 9, 26)]

    with patch("services.climatology_service.get_historical_forecast", return_value={
        "daily": {"time": [], "temperature_2m_max": [], "temperature_2m_min": [],
                  "weather_code": [], "precipitation_sum": []},
    }):
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
    ):
        results = get_climatology_days(51.5074, -0.1278, dates)

    assert len(results) == 2
    assert all(r["is_climatology"] for r in results)
    assert all(r["flood_score"] is None for r in results)
