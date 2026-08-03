# Run: python services/openmeteo.py

import requests
from datetime import date, datetime, timedelta


def resolve_date_range(start_date: str = None, end_date: str = None) -> tuple[date, date]:
    """Same defaulting rules get_forecast() has always used (today if no
    start_date, +6 days if no end_date — inclusive on both ends, so a 7-day
    range), pulled out as real date objects so callers that need to reason
    about the range (e.g. splitting it at the forecast horizon) don't have
    to re-parse strings themselves."""
    start = date.fromisoformat(start_date) if start_date else date.today()
    end = date.fromisoformat(end_date) if end_date else start + timedelta(days=6)
    return start, end


def get_forecast(lat: float, lon: float, start_date: str = None, end_date: str = None):
    start, end = resolve_date_range(start_date, end_date)
    start_date = start.isoformat()
    end_date = end.isoformat()

    # Hourly forecasted variables
    hourly = ",".join([
        "pressure_msl",
        "shortwave_radiation",
        "precipitation",
        "precipitation_probability",
        "snowfall",
        "temperature_2m",
        "weather_code",
        "visibility",
        "wind_speed_10m",
        "uv_index",
        "apparent_temperature",
    ])

    # Daily forecasted variables
    daily = ",".join([
        "weather_code",
        "precipitation_sum",
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "wind_speed_10m_mean",
        "wind_direction_10m_dominant",
        "relative_humidity_2m_mean",
        "uv_index_max",
        "sunrise",
        "sunset",
    ])

    # Build the URL with the date parameters
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}"
        f"&longitude={lon}"
        f"&hourly={hourly}"
        f"&daily={daily}"
        f"&start_date={start_date}"
        f"&end_date={end_date}"
        # auto: Open-Meteo resolves the destination's real local timezone from
        # lat/lon, instead of returning every timestamp in GMT regardless of
        # where the destination actually is.
        f"&timezone=auto"
    )

    response = requests.get(url)
    if response.status_code != 200:
        raise Exception(f"Request failed with status code {response.status_code}")

    data = response.json()
    return {
        "latitude": lat,
        "longitude": lon,
        "hourly": data["hourly"],
        "daily": data["daily"],
        # Seconds offset from UTC for the destination's resolved local
        # timezone — callers need this to know what the "local" timestamps
        # above actually mean in absolute (UTC) terms.
        "utc_offset_seconds": data.get("utc_offset_seconds", 0),
    }


def get_historical_forecast(lat: float, lon: float, start_date: str, end_date: str):
    """Daily historical observations from Open-Meteo's free Archive API —
    same provider as get_forecast(), no key needed. Used for climatology
    (long-run averages) on trip days too far out for a real forecast; unlike
    get_forecast(), start_date/end_date here are required and must already
    be in the past, so there's no "default to today" behavior to replicate."""
    daily = ",".join([
        "weather_code",
        "precipitation_sum",
        "temperature_2m_max",
        "temperature_2m_min",
        "wind_speed_10m_mean",
    ])

    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}"
        f"&longitude={lon}"
        f"&daily={daily}"
        f"&start_date={start_date}"
        f"&end_date={end_date}"
        f"&timezone=GMT"
    )

    response = requests.get(url,timeout=10,)
    if response.status_code != 200:
        raise Exception(f"Historical request failed with status code {response.status_code}")

    data = response.json()
    return {
        "latitude": lat,
        "longitude": lon,
        "daily": data["daily"],
    }