# Climatology fallback for trip days beyond Open-Meteo's forecast horizon
# (see FORECAST_HORIZON_DAYS in weather_service.py).
#
# STATUS: skeleton only. The historical fetch and day-of-year filtering below
# are real and handle failures gracefully — the actual averaging math (mean
# high/low, mode condition, rain-frequency) is an intentional placeholder.
# See docs/TICKET-climatology-fallback.md for the open decisions (sample
# years, day window, condition tie-breaking, hiking safety) before filling in
# _summarize_climatology_rows() for real.

from datetime import date

from services.openmeteo import get_historical_forecast

HISTORICAL_YEARS = 10   # TODO: confirm with team (ticket open question)
DAY_WINDOW_DAYS = 3     # +/- days around the target's month/day to sample
RAIN_THRESHOLD_MM = 1.0  # TODO: confirm whether 1 mm defines a historically rainy day


def get_climatology_days(lat: float, lon: float, dates: list[date]) -> list[dict]:
    """One day-dict per date in `dates`, shaped like a normal forecast day
    (see ForecastDayOut) but with is_climatology=True and forecast-only
    fields (uv/wind/visibility/heavy_rain_probability) left out. Each date
    is handled independently — a bad historical fetch for one date doesn't
    take out the others."""
    return [_climatology_day(lat, lon, target) for target in dates]


def _climatology_day(lat: float, lon: float, target: date) -> dict:
    try:
        rows = _historical_rows_near(lat, lon, target)
    except Exception:
        # Archive API unreachable/erroring for this date — fall through to
        # the same placeholder a "no historical data" result would produce,
        # rather than taking out the whole /prediction response.
        rows = []

    return _summarize_climatology_rows(target, rows)


def _historical_rows_near(lat: float, lon: float, target: date) -> list[dict]:
    """Real, working fetch: one archive-api call spanning HISTORICAL_YEARS
    years ending the year before `target`, filtered down to just the rows
    within DAY_WINDOW_DAYS of `target`'s month/day in each of those years.
    Returns a list of {date, temp_max, temp_min, weather_code, rain_mm}."""
    end = _safe_replace_year(target, target.year - 1)
    start = _safe_replace_year(end, end.year - HISTORICAL_YEARS + 1)

    historical = get_historical_forecast(lat, lon, start.isoformat(), end.isoformat())
    daily = historical["daily"]

    rows = []
    for i, iso_date in enumerate(daily["time"]):
        d = date.fromisoformat(iso_date)
        if _within_day_window(d, target):
            rows.append({
                "date": d,
                "temp_max": daily["temperature_2m_max"][i],
                "temp_min": daily["temperature_2m_min"][i],
                "weather_code": daily["weather_code"][i],
                "rain_mm": daily["precipitation_sum"][i],
            })
    return rows


def _within_day_window(d: date, target: date) -> bool:
    """True if `d` falls within +/- DAY_WINDOW_DAYS of target's month/day,
    in whatever year `d` happens to be in. Checks target's month/day shifted
    into the year before/at/after `d`'s year too, so dates just before Jan 1
    or just after Dec 31 still match a target near the turn of the year."""
    candidates = (
        _safe_replace_year(target, d.year - 1),
        _safe_replace_year(target, d.year),
        _safe_replace_year(target, d.year + 1),
    )
    return min(abs((d - c).days) for c in candidates) <= DAY_WINDOW_DAYS


def _safe_replace_year(d: date, year: int) -> date:
    try:
        return d.replace(year=year)
    except ValueError:
        # Feb 29 doesn't exist in a non-leap `year` — nearest real date instead
        return d.replace(year=year, day=28)


def _summarize_climatology_rows(target: date, rows: list[dict]) -> dict:
    """TODO(teammate): this is the placeholder. `rows` already has real
    historical daily data (temp_max/temp_min/weather_code/rain_mm) sampled
    from the +/- DAY_WINDOW_DAYS window across HISTORICAL_YEARS years — the
    fetch and filtering above are real and working, not stubbed. What still
    needs to be implemented here:
      - mean of temp_max / temp_min across `rows`
      - mode of weather_code across `rows` (most frequent), reused through
        weather_service.weather_condition() for the label — same dict,
        no new mapping needed
      - a rain-frequency proxy (e.g. % of `rows` with rain_mm over some
        threshold) — this becomes both its own "rain chance" metric AND
        the input `flood_risk()`/`beach_safety()` (ml/risk_calculator.py)
        expect as heavy_rain_probability. Real forecast days get that from
        the ML model, which can't run on a date that already happened
        (nothing left to predict) — feed the historical frequency into
        those same functions instead, they don't need to change.
      - hiking_safety(...) once ml/risk_calculator.py has it

    Deliberately NOT calling flood_risk()/beach_safety()/snow_probability()
    with fake zero inputs here — that produces confident-looking-but-fake
    numbers (e.g. snow_probability(rain=0, temp=0) -> 40%, not 0%, because
    the function treats temp<=1 as freezing) which is exactly the
    "fake-but-realistic data" placeholder anti-pattern this project's
    conventions call out. None is the honest placeholder until this
    function actually aggregates `rows` for real."""
    day = {
        "date": target.isoformat(),
        "is_climatology": True,
        "weather_code": 0,
        "condition": "Unknown",
        "temp_min": None,
        "temp_max": None,
        "rain_mm": None,
        "rain_chance": None,
        "flood_score": None,
        "flood_risk": "Unknown",
        "beach_safety_score": None,
        "beach_safety_level": "Unknown",
        "snow_probability": None,
    }
    return day


if __name__ == "__main__":
    from datetime import timedelta

    result = get_climatology_days(
        lat=51.5074, lon=-0.1278,
        dates=[date.today() + timedelta(days=60)],
    )
    print(result)
