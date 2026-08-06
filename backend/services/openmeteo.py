# Run: python services/openmeteo.py

import threading
import time

import requests
from datetime import date, datetime, timedelta

# Render's free tier (and other shared-IP hosts) can share Open-Meteo's rate
# limit with unrelated traffic on the same outbound IP, so a 429 there isn't
# necessarily this app's own call volume — a short retry-with-backoff rides
# out that kind of transient throttling instead of failing the request outright.
# A plain timeout/connection error gets the same treatment: Open-Meteo's free
# tier has no latency SLA, so a slow response is at least as likely as an
# outright rejection, and both are equally worth one more attempt.
MAX_RETRIES = 3
BACKOFF_SECONDS = 1

# get_weather_prediction() and get_hourly_weather() both call get_forecast()
# for the same lat/lon/date range on every itinerary page load (one for the
# ML prediction, one for the raw hourly data), doubling Open-Meteo call
# volume for identical data. A short-TTL cache collapses that pair into one
# real request. Correctness-wise a race just costs an extra call, never
# stale/wrong data, so a simple lock (not per-key) is enough.
_forecast_cache: dict[tuple, tuple[float, dict]] = {}
_forecast_cache_lock = threading.Lock()
FORECAST_CACHE_TTL_SECONDS = 30


def _get_with_retry(url: str, timeout: float | None = None) -> requests.Response:
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=timeout)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(BACKOFF_SECONDS * (2 ** attempt))
            continue
        if response.status_code != 429 or attempt == MAX_RETRIES - 1:
            return response
        retry_after = response.headers.get("Retry-After")
        delay = float(retry_after) if retry_after else BACKOFF_SECONDS * (2 ** attempt)
        time.sleep(delay)
    return response


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

    cache_key = (lat, lon, start_date, end_date)
    with _forecast_cache_lock:
        cached = _forecast_cache.get(cache_key)
        if cached is not None:
            cached_at, cached_data = cached
            if time.monotonic() - cached_at < FORECAST_CACHE_TTL_SECONDS:
                return cached_data

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

    # No timeout here would let a slow/stalled Open-Meteo response hang this
    # call (and everything waiting on it — a live API request, or the
    # scheduled weather-check job) indefinitely, since requests has no
    # default timeout of its own.
    response = _get_with_retry(url, timeout=10)
    if response.status_code != 200:
        raise Exception(f"Request failed with status code {response.status_code}")

    data = response.json()
    result = {
        "latitude": lat,
        "longitude": lon,
        "hourly": data["hourly"],
        "daily": data["daily"],
        # Seconds offset from UTC for the destination's resolved local
        # timezone — callers need this to know what the "local" timestamps
        # above actually mean in absolute (UTC) terms.
        "utc_offset_seconds": data.get("utc_offset_seconds", 0),
    }

    with _forecast_cache_lock:
        _forecast_cache[cache_key] = (time.monotonic(), result)

    return result


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

    response = _get_with_retry(url, timeout=10)
    if response.status_code != 200:
        raise Exception(f"Historical request failed with status code {response.status_code}")

    data = response.json()
    return {
        "latitude": lat,
        "longitude": lon,
        "daily": data["daily"],
    }
