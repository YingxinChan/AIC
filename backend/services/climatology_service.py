# Climatology fallback for trip days beyond Open-Meteo's forecast horizon
# (see FORECAST_HORIZON_DAYS in weather_service.py).
#
# STATUS: skeleton only. The historical fetch and day-of-year filtering below
# are real and handle failures gracefully — the actual averaging math (mean
# high/low, mode condition, rain-frequency) is an intentional placeholder.
# See docs/TICKET-climatology-fallback.md for the open decisions (sample
# years, day window, condition tie-breaking, hiking safety) before filling in
# _summarize_climatology_rows() for real.
from collections import Counter
from datetime import date
import statistics

from ml.risk_calculator import beach_safety, flood_risk, snow_probability
from services.openmeteo import get_historical_forecast


HISTORICAL_YEARS = 10
DAY_WINDOW_DAYS = 3
RAIN_THRESHOLD_MM = 1.0  # TODO: confirm with team whether 1 mm should define a historically rainy day


def get_climatology_days(
    lat: float,
    lon: float,
    dates: list[date],
) -> list[dict]:
    """Return one climatology day dictionary for every requested date."""
    if not dates:
        return []

    try:
        historical_rows = _fetch_historical_rows(
            lat,
            lon,
            dates,
        )
    except Exception:
        historical_rows = []

    return [
        _climatology_day(
            target,
            historical_rows,
        )
        for target in dates
    ]


def _climatology_day(
    target: date,
    historical_rows: list[dict],
) -> dict:
    rows = _rows_near_target(
        historical_rows,
        target,
    )

    try:
        return _summarize_climatology_rows(
            target,
            rows,
        )
    except Exception:
        return _summarize_climatology_rows(
            target,
            [],
        )


def _fetch_historical_rows(
    lat: float,
    lon: float,
    targets: list[date],
) -> list[dict]:
    """Fetch one historical range covering all requested target dates."""
    earliest_target = min(targets)
    latest_target = max(targets)

    end = _safe_replace_year(
        latest_target,
        latest_target.year - 1,
    )

    start = _safe_replace_year(
        earliest_target,
        earliest_target.year - HISTORICAL_YEARS,
    )

    historical = get_historical_forecast(
        lat,
        lon,
        start.isoformat(),
        end.isoformat(),
    )

    daily = historical["daily"]

    rows = []

    for i, iso_date in enumerate(daily["time"]):
        rows.append({
            "date": date.fromisoformat(iso_date),
            "temp_max": daily["temperature_2m_max"][i],
            "temp_min": daily["temperature_2m_min"][i],
            "weather_code": daily["weather_code"][i],
            "rain_mm": daily["precipitation_sum"][i],
            "wind": daily["wind_speed_10m_mean"][i],
        })

    return rows


def _rows_near_target(
    historical_rows: list[dict],
    target: date,
) -> list[dict]:
    """Filter shared historical rows for one target month and day."""
    return [
        row
        for row in historical_rows
        if _within_day_window(
            row["date"],
            target,
        )
    ]

def _within_day_window(
    historical_date: date,
    target: date,
) -> bool:
    """Return True when a date is close to the target month and day.

    The previous, current and following year are checked so dates around
    New Year are handled correctly.
    """
    candidates = (
        _safe_replace_year(
            target,
            historical_date.year - 1,
        ),
        _safe_replace_year(
            target,
            historical_date.year,
        ),
        _safe_replace_year(
            target,
            historical_date.year + 1,
        ),
    )

    nearest_difference = min(
        abs((historical_date - candidate).days)
        for candidate in candidates
    )

    return nearest_difference <= DAY_WINDOW_DAYS


def _safe_replace_year(
    value: date,
    year: int,
) -> date:
    """Replace a date's year, safely handling 29 February."""
    try:
        return value.replace(year=year)
    except ValueError:
        return value.replace(
            year=year,
            day=28,
        )


def _summarize_climatology_rows(
    target: date,
    rows: list[dict],
) -> dict:
    if not rows:
        return {
            "date": target.isoformat(),
            "is_climatology": True,
            "weather_code": None,
            "condition": "Unknown",
            "temp_min": None,
            "temp_max": None,
            "rain_mm": None,
            "rain_chance": None,
            "heavy_rain_probability": None,
            "heavy_rain_warning": None,
            "flood_score": None,
            "flood_risk": "Unknown",
            "beach_safety_score": None,
            "beach_safety_level": "Unknown",
            "snow_probability": None,
            "hiking_safety_score": None,
            "hiking_safety_level": "Unknown",
        }

    # Local import prevents a circular import during application startup.
    from services.weather_service import weather_condition

    temp_max = statistics.mean(
        row["temp_max"]
        for row in rows
    )

    temp_min = statistics.mean(
        row["temp_min"]
        for row in rows
    )

    wind = statistics.mean(
        row["wind"]
        for row in rows
    )

    average_rain = statistics.mean(
        row["rain_mm"]
        for row in rows
    )

    weather_code = Counter(
        row["weather_code"]
        for row in rows
    ).most_common(1)[0][0]

    condition = weather_condition(weather_code)

    rainy_days = sum(
        1
        for row in rows
        if row["rain_mm"] >= RAIN_THRESHOLD_MM
    )

    rain_chance = round(
        100 * rainy_days / len(rows),
        1,
    )

    flood = flood_risk(
        heavy_rain_probability=rain_chance,
        rain_today=0,
        rain_tomorrow=0,
        max_hourly_rain=0,
    )

    beach = beach_safety(
        heavy_rain_probability=rain_chance,
        rain=average_rain,
        wind=wind,
        feels_like_temp=temp_max,
    )

    snow = snow_probability(
        rain=average_rain,
        snowfall=0,
        temp=temp_max,
    )

    day = {
        "date": target.isoformat(),
        "is_climatology": True,
        "weather_code": weather_code,
        "condition": condition,
        "temp_min": round(temp_min, 1),
        "temp_max": round(temp_max, 1),
        "rain_mm": None,
        "rain_chance": rain_chance,
        "heavy_rain_probability": None,
        "heavy_rain_warning": None,
        "hiking_safety_score": None,
        "hiking_safety_level": "Unknown",
    }

    day.update(flood)
    day.update(beach)
    day.update(snow)

    return day


if __name__ == "__main__":
    from datetime import timedelta

    result = get_climatology_days(
        lat=51.5074,
        lon=-0.1278,
        dates=[
            date.today() + timedelta(days=60),
        ],
    )

    print(result)