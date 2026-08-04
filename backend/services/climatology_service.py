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
from datetime import date, timedelta, timezone as tz_class
import statistics

from astral import Observer
from astral.sun import sun as astral_sun

from ml.risk_calculator import beach_safety, temp_advice, temp_level, wind_level
from services.openmeteo import get_forecast, get_historical_forecast


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

    utc_offset_seconds = _location_utc_offset_seconds(lat, lon)

    return [
        _climatology_day(
            target,
            historical_rows,
            lat,
            lon,
            utc_offset_seconds,
        )
        for target in dates
    ]


def _location_utc_offset_seconds(lat: float, lon: float) -> int:
    """A quick live-forecast call just for the location's current UTC
    offset — sunrise/sunset needs a timezone to report local time in, and
    _fetch_historical_rows's own archive call uses a fixed GMT timezone
    (see its `timezone=GMT` param), not the location's real one. Reused
    across every requested date rather than fetched per-date, since a
    location's UTC offset is stable enough for this purpose (the DST
    transition dates themselves may differ by a day from one year to the
    next, but the offset magnitude doesn't)."""
    try:
        return get_forecast(lat, lon)["utc_offset_seconds"]
    except Exception:
        return 0


def _sunrise_sunset(
    target: date,
    lat: float,
    lon: float,
    utc_offset_seconds: int,
) -> tuple[str | None, str | None]:
    """Sunrise/sunset for a future date is pure astronomy (date + lat/lon) —
    unlike every other field in this file, it needs no historical weather
    data at all, just the standard solar-position formulas (declination +
    hour angle) astral implements; Open-Meteo's own sunrise/sunset uses the
    same family of equations internally. See
    docs/CLIMATOLOGY_SUNRISE_SUNSET.md for the full writeup. Returns
    (None, None) for locations experiencing polar day/night on this date,
    where "sunrise"/"sunset" aren't meaningful concepts."""
    try:
        times = astral_sun(
            Observer(latitude=lat, longitude=lon, elevation=0),
            date=target,
            tzinfo=tz_class(timedelta(seconds=utc_offset_seconds)),
        )
    except ValueError:
        return None, None

    return (
        times["sunrise"].strftime("%I:%M %p"),
        times["sunset"].strftime("%I:%M %p"),
    )


def _climatology_day(
    target: date,
    historical_rows: list[dict],
    lat: float,
    lon: float,
    utc_offset_seconds: int,
) -> dict:
    rows = _rows_near_target(
        historical_rows,
        target,
    )

    try:
        return _summarize_climatology_rows(
            target,
            rows,
            lat,
            lon,
            utc_offset_seconds,
        )
    except Exception:
        return _summarize_climatology_rows(
            target,
            [],
            lat,
            lon,
            utc_offset_seconds,
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
    lat: float,
    lon: float,
    utc_offset_seconds: int,
) -> dict:
    # Computed regardless of whether historical rows exist — sunrise/sunset
    # needs no historical weather data at all (see _sunrise_sunset), unlike
    # everything else below, which genuinely has nothing to report without
    # at least one matching historical row.
    sunrise, sunset = _sunrise_sunset(target, lat, lon, utc_offset_seconds)

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
            "temperature_level": None,
            "temperature_advice": None,
            "wind_speed": None,
            "wind_level": "Unknown",
            "hiking_safety_score": None,
            "hiking_safety_level": "Unknown",
            "sunrise": sunrise,
            "sunset": sunset,
            "utc_offset_seconds": utc_offset_seconds,
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

    # Flood and Snow are deliberately left as Unknown here, not computed —
    # flood_risk() needs rain_today/rain_tomorrow/max_hourly_rain (60 of its
    # 100 scoring points) and snow_probability() needs snowfall, none of
    # which climatology has a real or even approximate substitute for
    # (rain_tomorrow/max_hourly_rain need a single continuous timeline,
    # which a multi-year pooled window can't provide — see the discussion
    # that landed this). Scoring them anyway would silently cap Flood at
    # "Moderate" (max reachable score 40/100) and Snow's primary path is
    # unreachable, in a way that isn't obvious from the number shown. Beach
    # Safety keeps its real value below — all 4 of its inputs (rain_chance,
    # average_rain, wind, temp_max) are genuine historical substitutes, no
    # hardcoded gaps.
    beach = beach_safety(
        heavy_rain_probability=rain_chance,
        rain=average_rain,
        wind=wind,
        feels_like_temp=temp_max,
    )

    # No historical feels_like_temp either — temp_max stands in here the
    # same way it already does for beach_safety above. temp_level() returns
    # a dict (temperature_level + temperature_breakdown), same shape
    # weather_service.py's real-forecast path already handles.
    temperature_level = temp_level(feels_like_temp=temp_max)
    temperature_advice = temp_advice(temp_level=temperature_level["temperature_level"])

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
        "flood_score": None,
        "flood_risk": "Unknown",
        "snow_probability": None,
        "temperature_advice": temperature_advice,
        "wind_speed": round(wind, 1),
        "wind_level": wind_level(wind),
        "hiking_safety_score": None,
        "hiking_safety_level": "Unknown",
        "sunrise": sunrise,
        "sunset": sunset,
        "utc_offset_seconds": utc_offset_seconds,
    }

    day.update(beach)
    day.update(temperature_level)

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