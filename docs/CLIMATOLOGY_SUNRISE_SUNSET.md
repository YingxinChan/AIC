# Sunrise/Sunset for climatology (>14-day) trip days

Research + implementation notes for why sunrise/sunset used to show "not
available" for trip days beyond `FORECAST_HORIZON_DAYS` (14 days), and why
it's now computed for real (see `climatology_service.py`:
`_sunrise_sunset()` / `_location_utc_offset_seconds()`).

## Short version

Unlike every other weather field in the climatology fallback, sunrise/sunset
isn't weather at all — it's pure astronomy (date + latitude/longitude, no
atmospheric data). It used to be missing only because Open-Meteo's forecast
API caps sunrise/sunset requests at the same ~14-16 day window as its actual
weather variables, not because the underlying calculation has any horizon
limit. Now computed directly via Python's `astral` library, which gives an
**exact** answer for any future date — not an approximation standing in for
a real forecast, unlike `rain_chance`/`temp_max`/historical `wind`, which are
genuine trade-offs. This was new work (a library dependency + a small
integration), not reusing already-computed climatology data the way the
Heavy Rain/Extreme Temp/Wind fixes were.

## Why sunrise/sunset is a different kind of problem

Every other climatology gap in this app exists because weather is a chaotic
atmospheric system — genuinely unpredictable with any real accuracy beyond
~14-16 days, which is exactly why Open-Meteo's forecast API cuts off there.
The climatology fallback's only honest option for those fields is "what has
this date typically looked like historically" (an average of the past), not
a real prediction for the specific date.

Sunrise/sunset has no such uncertainty. It's governed entirely by
deterministic orbital mechanics — Earth's rotation, axial tilt, and position
in its orbit around the sun. Astronomers already publish exact sunrise/sunset
times decades into the future (that's what almanacs and calendars have done
for centuries); it's solvable to sub-second precision with closed-form
trigonometric equations, no historical data collection or averaging required.

Confirmed empirically: Open-Meteo's *forecast* API errors when asked for
`sunrise,sunset` outside its normal window —

```
$ curl "https://api.open-meteo.com/v1/forecast?...&daily=sunrise,sunset&start_date=<60 days out>..."
{"error":true,"reason":"Parameter 'start_date' is out of allowed range from 2026-05-03 to 2026-08-19"}
```

— which is Open-Meteo's own API policy, not a limitation of the calculation
itself.

## The calculation, in four steps

1. **Day of year → solar declination**: the sun's angle relative to the
   equator swings smoothly from about +23.4° at the June solstice to -23.4°
   at the December solstice. Given the day of year, this angle is computed
   via a short Fourier-series approximation (a handful of sine/cosine terms).

2. **Equation of time**: clock-noon and solar-noon drift apart slightly
   through the year (up to ~±16 minutes) because of Earth's elliptical orbit
   and axial tilt. Another short trig formula corrects for this.

3. **Hour angle at sunrise/sunset**: given latitude and the sun's
   declination, there's an angle (the "hour angle") at which the sun sits
   exactly at the horizon. One `acos()` formula, using a reference angle of
   ~90.833° — 90° for the true horizon, plus ~0.833° for atmospheric
   refraction bending light and the sun's disk having actual width (not being
   a point source).

4. **Hour angle → clock time**: convert the angle to minutes (15°/hour = 4
   minutes per degree), adjust for longitude and the equation-of-time
   correction from step 2, giving sunrise/sunset in UTC — then shift by the
   location's UTC offset for local time.

No iteration, no external data fetch, closed-form the whole way. Given a date
and lat/lon, this works identically whether the date is tomorrow or 50 years
out.

## Open-Meteo uses the same approach internally

Open-Meteo is open source. Its own sunrise/sunset code
(`Sources/App/Helper/Solar/Zensun.swift` and `SunRiseSet.swift`) implements
exactly this — solar declination, hour angle, the same ~0.833° refraction/
disk-radius correction — refined against NREL's SPA (Solar Position
Algorithm), a higher-precision reference implementation of the same
underlying physics:

```swift
// Zensun.swift
/// Solar position calculations based on zensun
/// Revised using NREL Solar Posiition Altorithm SPA
public enum Zensun { ... }
```

```swift
// SunRiseSet.swift — calculateDaylightDuration()
let t1 = date.add(12 * 3600).getSunDeclination().degreesToRadians
let alpha = Float(0.83333).degreesToRadians   // <- the refraction/disk-radius correction
let t0 = lat.degreesToRadians
let arg = -(sin(alpha) + sin(t0) * sin(t1)) / (cos(t0) * cos(t1))
let dtime = acos(arg) / (Float(15).degreesToRadians)
```

## Python's `astral` library uses the same family of formulas

`astral` (`sun.py`) independently implements the same lineage of equations —
solar declination via Julian-century orbital elements (the standard Jean
Meeus "Astronomical Algorithms" approach), then the identical hour-angle
formula shape, with the same 0.833° correction constant:

```python
# astral/sun.py
def sun_declination(juliancentury: float) -> float: ...

def hour_angle(latitude, declination, zenith, direction) -> float:
    ...
    h = (cos(zenith_rad) - sin(latitude_rad) * sin(declination_rad)) / (
        cos(latitude_rad) * cos(declination_rad)
    )
    hour_angle = acos(h)
    ...
```

NOAA's solar calculator, NREL's SPA, Open-Meteo's Zensun, and `astral` all
converge on the same handful of textbook equations — different
implementations of the same physics, not competing approaches. Using
`astral` would give the same answer (well within any practically meaningful
precision) as what Open-Meteo computes internally.

## Implementation

- `astral>=3.2` added to `backend/requirements.txt`.
- `climatology_service.py`:
  - `_sunrise_sunset(target, lat, lon, utc_offset_seconds)` — computes
    sunrise/sunset directly from `(target_date, lat, lon)` via
    `astral.sun.sun()`, formatted `"%I:%M %p"` to match the real-forecast
    path (`feature_builder.py`). No historical fetch involved, unlike
    everything else in this file. Returns `(None, None)` for polar
    day/night, where `astral` raises `ValueError`.
  - `_location_utc_offset_seconds(lat, lon)` — a quick live call to
    `get_forecast()` (the real Open-Meteo forecast endpoint, always within
    its normal window regardless of how far out the actual trip day is)
    just to read `utc_offset_seconds`, since `_fetch_historical_rows`'s own
    archive call uses a fixed GMT timezone, not the location's real one.
    Computed once per `get_climatology_days()` call, reused across every
    requested date.
  - Both are computed unconditionally in `_summarize_climatology_rows()`,
    including the empty-rows branch — sunrise/sunset don't depend on
    whether the historical archive fetch succeeded.
- No caveat added in the risk-info modal the way Heavy Rain/Extreme
  Temp/Wind/Beach Safety got one — this isn't an approximation standing in
  for a real forecast, it's an exact value either way. No frontend changes
  were needed at all: `ItineraryPage.jsx`'s sunrise/sunset display already
  branched on `forecastDay.sunrise && forecastDay.sunset` being present,
  independent of `is_climatology`.
- Tests: `tests/test_climatology_service.py` (`_summarize_climatology_rows`
  unit tests, both empty and populated rows) and
  `tests/test_weather.py::test_prediction_beyond_horizon_falls_back_to_climatology_with_real_historical_data`
  (full `/api/weather/prediction` round-trip) assert `sunrise`/`sunset` are
  non-null on a climatology day.

## Sources

- [open-meteo/open-meteo — Zensun.swift](https://github.com/open-meteo/open-meteo/blob/main/Sources/App/Helper/Solar/Zensun.swift)
- [open-meteo/open-meteo — SunRiseSet.swift](https://github.com/open-meteo/open-meteo/blob/main/Sources/App/Helper/Solar/SunRiseSet.swift)
- [Sunrise and sunset times half hour off · Issue #655](https://github.com/open-meteo/open-meteo/issues/655)
- [sffjunkie/astral — sun.py](https://github.com/sffjunkie/astral/blob/master/src/astral/sun.py)
- [Astral 3.0 documentation](https://astral.readthedocs.io/en/latest/)
