# Demo: Weather-Triggered Activity Swap

This is the step-by-step for showing the "itinerary reacts to weather" feature live — the swap happening on screen, plus the notification email arriving. Works the same way for any of the 7 conditions the app checks (rain, fog, wind, extreme heat, extreme cold, extreme UV, poor beach safety) — only Steps 1 and 3 differ by condition; everything else is identical.

## What you're demonstrating

The backend periodically re-checks the forecast for every upcoming trip. When a day is forecast to trigger any of the 7 weather conditions below, any **outdoor** activity still scheduled that day — and, for the 6 non-rain conditions, only if it's specifically tagged as vulnerable to that condition — gets automatically swapped for a real alternative nearby (via Claude), and the trip owner gets an email. In production this runs on a schedule (every 3 hours); for a demo, you trigger it on demand instead of waiting.

The swap is an **in-place substitution, not a day-swap**: the same activity row keeps its `day_date` and `time_slot`, only its name/location/coordinates change. A rained-out picnic on Day 3 becomes a museum visit still on Day 3, same time slot — nothing ever moves to a different day.

**One thing to know before you set up a demo trip:** since itinerary *generation* is now weather-aware (it already avoids planning a vulnerable activity on a day the forecast already flags), a freshly generated itinerary for a day that's *already* known to be bad will just come back without anything vulnerable to swap. To reliably show the swap itself, you need a vulnerable activity that exists on a day *before* it was known to be affected. The setup below handles that by seeding the activity directly.

---

## The 7 conditions

| Condition | `id` | Signal checked | Threshold | Blanket or targeted? |
|---|---|---|---|---|
| Rain / thunderstorm | `rain` | `heavy_rain_warning`, `weather_code` | heavy rain forecast, or thunderstorm code | **Blanket** — affects any outdoor activity, no tag needed |
| Fog / poor visibility | `fog` | `visibility_km` | < 2km | Targeted — needs `view_dependent` |
| Wind | `wind` | `wind_level` | "Strong" or "Very Strong" | Targeted — needs `wind_exposed` |
| Extreme heat | `extreme_heat` | `temp_max` | ≥ 35°C | Targeted — needs `strenuous_outdoor` |
| Extreme cold | `extreme_cold` | `temp_min` | ≤ -5°C | Targeted — needs `strenuous_outdoor` |
| Extreme UV | `extreme_uv` | `uv_level` | "Very High" or "Extreme" | Targeted — needs `strenuous_outdoor` |
| Poor beach safety | `beach_safety` | `beach_safety_level` | "Poor" | Targeted — needs `beach` |

"Blanket" rules fire for any outdoor activity regardless of tags (rain works exactly as it always has). "Targeted" rules only fire for an activity whose `weather_sensitivity` includes that specific tag — an untagged outdoor activity on the same bad-fog day is left alone, only the tagged viewpoint activity gets swapped.

Rain has one extra refinement: if hourly forecast data is available and the activity's `time_slot` parses cleanly, it only swaps when a rainy hour actually overlaps that specific time slot (a 9am activity on a rainy morning is affected; a 2pm activity the same day, if the afternoon is clear, is not). Falls back to the whole-day blanket check when hourly data or a parseable time slot isn't available, so this can only narrow swaps relative to the simple version, never miss a genuinely rainy day.

---

## Prerequisites

- Backend running: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
- `backend/.env` already has `GMAIL_USER`/`GMAIL_APP_PASSWORD` set — same shared credentials as the rest of the team, nothing to set up per demo.
- You don't need the Celery worker running for this — the trigger script below calls the same code the scheduled task does, directly.

---

## Step 1 — Find a real day matching your chosen condition

```bash
cd backend && source venv/bin/activate
python -c "
from services.weather_service import get_weather_prediction

LAT, LON = 51.5074, -0.1278  # swap in whichever of the 25 MVP cities you're demoing

for d in get_weather_prediction(LAT, LON):
    print(
        d['date'],
        '| rain:', d['heavy_rain_warning'], f\"({d['heavy_rain_probability']}%)\",
        '| fog:', d['visibility_km'], 'km',
        '| wind:', d['wind_level'],
        '| heat:', d['temp_max'], '°C max',
        '| cold:', d['temp_min'], '°C min',
        '| uv:', d['uv_level'],
        '| beach:', d['beach_safety_level'],
    )
"
```

Pick the date matching whichever condition you want to demo, using the thresholds table above. If nothing in the current 7-day forecast matches, try a different city — the 25 MVP cities span a wide enough climate range that extreme heat/cold/UV/beach conditions are more likely to show up somewhere (e.g. Athens or Istanbul for heat/UV, Oslo or Edinburgh for cold, Barcelona or Lisbon for beach) even when London doesn't have anything extreme that week. If genuinely nothing matches anywhere (this is common for extreme heat/cold outside their season), proceed anyway — Step 3 seeds the activity directly, so the swap logic itself doesn't depend on what Claude happened to generate, only on picking a date the live forecast actually flags.

## Step 2 — Create a trip + generate its itinerary (via the app, as normal)

In the browser: create a trip whose dates span the date you picked, then click **Generate Itinerary** as usual. This gives you a realistic-looking itinerary for the surrounding days.

## Step 3 — Seed one matching outdoor activity on that day

This is the step that guarantees there's something to swap, rather than hoping Claude happened to leave something vulnerable on that specific day. Replace `TRIP_ID`, the date, and — for a targeted condition — the `weather_sensitivity` tag from the table above (leave it as `""` for rain, since rain is blanket and doesn't need one):

```bash
cd backend && source venv/bin/activate
python -c "
import asyncio
from datetime import date
from core.database import AsyncSessionLocal
from models.activity import Activity

TRIP_ID = 123                     # <-- your trip's id
TARGET_DATE = date(2026, 8, 4)    # <-- the matching date from Step 1
WEATHER_SENSITIVITY = ''          # <-- '', 'view_dependent', 'wind_exposed', 'strenuous_outdoor', or 'beach'

async def seed():
    async with AsyncSessionLocal() as db:
        db.add(Activity(
            trip_id=TRIP_ID, day_date=TARGET_DATE,
            name='Primrose Hill Viewpoint', type='outdoor', time_slot='12:00 - 14:00',
            location='Primrose Hill, London',
            description='Panoramic view over the city skyline.',
            weather_sensitivity=WEATHER_SENSITIVITY,
        ))
        await db.commit()
        print('Seeded.')

asyncio.run(seed())
"
```

A few example activity/tag pairings if you want something more scenario-fitting than the default above:
- Fog (`view_dependent`): a viewpoint, rooftop bar, or scenic overlook.
- Wind (`wind_exposed`): a boat tour, cable car, or hot air balloon ride.
- Extreme heat/cold/UV (`strenuous_outdoor`): a long hike or all-day walking tour.
- Beach safety (`beach`): a beach day or coastal walk.

Refresh the itinerary page and check that day's tab — you should see the activity listed normally, not yet swapped.

## Step 4 — Trigger the check, live

```bash
cd backend && source venv/bin/activate
python scripts/trigger_weather_check.py
```

This prints exactly what got swapped (before → after, with the specific reason) and whether the digest email sent. It's the same code path as the real scheduled job — nothing is faked.

If you only want to show the swap without sending an email (e.g. rehearsing repeatedly), use `python scripts/run_auto_swap_once.py` instead — same swap logic, no email side effect.

## Step 5 — Show the result

- **In the app:** refresh the itinerary page, click that day's tab — the activity now shows struck-through with the original name, the new alternative, and an amber note with the specific reason (e.g. "Swapped — Reduced visibility expected (0.8km) — the view would be ruined").
- **In the inbox:** the trip owner's email shows the day, the original activity, the new one, and the reason — same before/after layout regardless of which condition triggered it.

---

## Cleaning up after a rehearsal

If you seeded a demo trip/activity just for practice, remove it afterward so it doesn't clutter the shared dev database:

```bash
cd backend && source venv/bin/activate
python -c "
import asyncio
from sqlalchemy import delete
from core.database import AsyncSessionLocal
from models.trip import Trip

async def cleanup():
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Trip).where(Trip.id == 123))  # <-- your demo trip's id
        await db.commit()
        print('Removed.')

asyncio.run(cleanup())
"
```

(Deleting the `Trip` row cascades to its activities automatically.) Only delete a trip you created for this rehearsal — never a teammate's real trip.

---

## If nothing swaps

- `trigger_weather_check.py` prints `No swaps triggered` if there's no un-swapped outdoor activity on a day the forecast currently flags for any active condition. Re-check Step 1 — forecasts shift day to day, so a date that matched earlier may have cleared.
- Make sure the seeded activity's `type` is exactly `'outdoor'` and `day_date` matches a date within the trip's own date range.
- For a **targeted** condition (everything except rain), double-check `weather_sensitivity` on the seeded activity actually contains the matching tag — an untagged outdoor activity is correctly left alone even on a day that triggers the condition.
- For rain specifically: if the seeded activity's `time_slot` doesn't overlap the hourly-rainy window, it won't swap even on a heavy-rain day — either pick a time slot inside the rainy hours, or skip that refinement by not worrying about it (it only kicks in when hourly data is available).
- The forecast horizon is ~14 days out — a trip dated further in the future won't have a live forecast yet, so nothing will trigger no matter what.
