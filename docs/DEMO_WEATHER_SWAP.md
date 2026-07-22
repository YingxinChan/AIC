# Demo: Weather-Triggered Activity Swap

This is the step-by-step for showing the "itinerary reacts to weather" feature live — the swap happening on screen, plus the notification email arriving.

## What you're demonstrating

The backend periodically re-checks the forecast for every upcoming trip. When a day is forecast heavy rain, any **outdoor** activity still scheduled that day gets automatically swapped to a real indoor alternative (via Claude), and the trip owner gets an email. In production this runs on a schedule (every 3 hours); for a demo, you trigger it on demand instead of waiting.

**One thing to know before you set up a demo trip:** since itinerary *generation* is now weather-aware (it already avoids planning outdoor activities on days the forecast already flags as rainy), a freshly generated itinerary for a day that's *already* known to be rainy will just come back indoor-only — there'll be nothing left to swap. To reliably show the swap itself, you need an outdoor activity that exists on a day *before* it was known to be rainy. The setup below handles that.

---

## Prerequisites

- Backend running: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
- `backend/.env` already has `GMAIL_USER`/`GMAIL_APP_PASSWORD` set — same shared credentials as the rest of the team, nothing to set up per demo.
- You don't need the Celery worker running for this — the trigger script below calls the same code the scheduled task does, directly.

---

## Step 1 — Find a currently rainy day

```bash
cd backend && source venv/bin/activate
python -c "
from services.weather_service import get_weather_prediction
for d in get_weather_prediction(51.5074, -0.1278):  # London
    print(d['date'], 'RAINY' if d['heavy_rain_warning'] else '', d['heavy_rain_probability'], '%', d['condition'])
"
```

Pick a date with `RAINY` next to it (`heavy_rain_warning: true`). If nothing looks rainy right now, try a different city, or just proceed anyway — Step 3 works regardless, since you're seeding the activity directly rather than relying on what Claude happened to generate.

## Step 2 — Create a trip + generate its itinerary (via the app, as normal)

In the browser: create a trip whose dates span the rainy day you picked, then click **Generate Itinerary** as usual. This gives you a realistic-looking itinerary for the surrounding days.

## Step 3 — Seed one outdoor activity on the rainy day

This is the step that guarantees there's something to swap, rather than hoping Claude happened to leave something outdoor on that specific day. Replace `TRIP_ID` and the date with your trip's real ID and the rainy date from Step 1:

```bash
cd backend && source venv/bin/activate
python -c "
import asyncio
from datetime import date
from core.database import AsyncSessionLocal
from models.activity import Activity

TRIP_ID = 123          # <-- your trip's id
RAINY_DATE = date(2026, 7, 26)   # <-- the rainy date from Step 1

async def seed():
    async with AsyncSessionLocal() as db:
        db.add(Activity(
            trip_id=TRIP_ID, day_date=RAINY_DATE, name='Hyde Park Picnic',
            type='outdoor', time_slot='12:00 - 14:00', location='Hyde Park, London',
            description='Relax with a picnic in Hyde Park.',
        ))
        await db.commit()
        print('Seeded.')

asyncio.run(seed())
"
```

Refresh the itinerary page and check that day's tab — you should see the picnic listed as a normal outdoor activity, not yet swapped.

## Step 4 — Trigger the check, live

```bash
cd backend && source venv/bin/activate
python scripts/trigger_weather_check.py
```

This prints exactly what got swapped (before → after) and whether the digest email sent. It's the same code path as the real scheduled job — nothing is faked.

If you only want to show the swap without sending an email (e.g. rehearsing repeatedly), use `python scripts/run_auto_swap_once.py` instead — same swap logic, no email side effect.

## Step 5 — Show the result

- **In the app:** refresh the itinerary page, click that day's tab — the activity now shows struck-through with the original name, the new indoor alternative, and an amber "Swapped — Heavy rain expected (…% chance)" note.
- **In the inbox:** the trip owner's email shows the day, the original activity, the new one, and the reason — same before/after layout as the app.

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

- `trigger_weather_check.py` prints `No swaps triggered` if there's no un-swapped outdoor activity on a day the forecast currently flags as rainy. Re-check Step 1 — forecasts shift day to day, so a date that was rainy earlier may have cleared.
- Make sure the seeded activity's `type` is exactly `'outdoor'` and `day_date` matches a date within the trip's own date range.
- The forecast horizon is ~15 days out — a trip dated further in the future won't have a forecast yet, so nothing will trigger no matter what.
