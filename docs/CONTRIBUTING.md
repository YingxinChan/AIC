# SmartTrip AI — Developer Guide

This guide is for teammates implementing features. It covers the project patterns, API contract, and how to write tests.

---

## Project structure

```
backend/
  routers/        ← DO NOT EDIT — routes are already wired up
  services/       ← YOUR WORK GOES HERE — replace the stubs
  models/         ← SQLAlchemy DB models (User, Trip, Activity)
  schemas/        ← Pydantic request/response shapes
  tests/          ← Write tests here
  core/
    database.py   ← DB session (get_db)
    security.py   ← JWT auth (get_current_user)

frontend/
  src/features/   ← One folder per feature (auth, trips, flights, etc.)
  src/lib/api.js  ← Axios instance — use this for all API calls
```

**Rule:** Only edit files in `services/` and `tests/`. Routes and schemas are already defined — do not change them unless you have a good reason.

---

## The pattern: router calls service

Every route already calls a service function. Your job is to replace the stub in the service with real logic.

Example — the trips router calls `trips_service.list_trips`:

```python
# routers/trips.py (already written — don't touch)
@router.get("/")
async def list_trips(current_user: dict = Depends(get_current_user)):
    return trips_service.list_trips(current_user["id"])
```

```python
# services/trips_service.py (your work)
async def list_trips(db: AsyncSession, user_id: int) -> list:
    result = await db.execute(select(Trip).where(Trip.user_id == user_id))
    return result.scalars().all()
```

> **Note:** The router stubs are sync — you will need to make them async and inject `db: AsyncSession = Depends(get_db)` when you implement. See the auth router for a working example.

---

## Async SQLAlchemy pattern

All DB calls use async SQLAlchemy. Follow this pattern exactly:

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, Depends
from core.database import get_db
from models.trip import Trip

async def get_trip(db: AsyncSession, trip_id: int, user_id: int) -> Trip:
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user_id:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

async def create_trip(db: AsyncSession, user_id: int, name: str, start_date, end_date) -> Trip:
    trip = Trip(user_id=user_id, name=name, start_date=start_date, end_date=end_date)
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip
```

See `services/auth_service.py` for a complete working example.

---

## Security rule: always filter by user_id

Every query that touches trips or activities **must** include a `user_id` filter. A user must never be able to read or modify another user's data.

```python
# CORRECT
select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)

# WRONG — never do this
select(Trip).where(Trip.id == trip_id)
```

---

## API contract

All endpoints require authentication (JWT cookie). Call `POST /api/auth/login` first.

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{email, password}` | `{user: {id, email}}` + sets cookie |
| POST | `/api/auth/login` | `{email, password}` | `{user: {id, email}}` + sets cookie |
| GET | `/api/auth/me` | — | `{user: {id, email}}` |
| POST | `/api/auth/logout` | — | 204 |

### Trips

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/trips/` | — | list of `{id, name, start_date, end_date}` |
| POST | `/api/trips/` | `{name, start_date, end_date}` | `{id, name, start_date, end_date}` |
| GET | `/api/trips/{id}` | — | `{id, name, start_date, end_date}` or 404 |
| DELETE | `/api/trips/{id}` | — | 204 or 403 |

### Flights

| Method | Path | Query params | Response |
|--------|------|-------------|----------|
| GET | `/api/flights/search` | `origin`, `departure`, `return_date` | list of flight objects |

Each flight object: `{airline, flight_number, departure_city, departure_time, arrival_time, duration, price_gbp}`

### Weather

| Method | Path | Query params | Response |
|--------|------|-------------|----------|
| GET | `/api/weather/forecast` | `start`, `end` | forecast data |

### Itinerary

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/trips/{id}/itinerary/` | — | list of activities |
| POST | `/api/trips/{id}/itinerary/generate` | — | generated itinerary |
| PATCH | `/api/trips/{id}/itinerary/activities/{aid}/swap` | `{swap_to}` | updated activity |

### Notifications

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/notifications/preferences` | — | `{email_enabled, rain_threshold_mm}` |
| PUT | `/api/notifications/preferences` | `{email_enabled, rain_threshold_mm}` | updated prefs |
| POST | `/api/notifications/test` | — | sends test email |

---

## Writing tests

Tests hit the real Supabase database. The test setup is already in `tests/conftest.py` — you just write the test functions.

### Two fixtures available

```python
def test_something(client):
    # client — unauthenticated
    pass

def test_something_else(auth_client):
    # auth_client — already logged in with a real JWT cookie
    pass
```

### Always use unique emails

Tests run against the real DB. Use `uuid` to avoid email collisions between runs:

```python
import uuid

def test_register(client):
    email = f"test+{uuid.uuid4()}@example.com"
    response = client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    assert response.status_code == 200
```

### Example: testing a CRUD endpoint

```python
import uuid

def test_create_trip_returns_trip_with_id(auth_client):
    response = auth_client.post("/api/trips/", json={
        "name": "London Trip",
        "start_date": "2026-08-01",
        "end_date": "2026-08-05"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "London Trip"
    assert "id" in data

def test_get_trip_returns_404_for_nonexistent(auth_client):
    response = auth_client.get("/api/trips/999999")
    assert response.status_code == 404

def test_user_cannot_see_another_users_trip(client):
    # Create user A and their trip
    email_a = f"test+{uuid.uuid4()}@example.com"
    reg_a = client.post("/api/auth/register", json={"email": email_a, "password": "pass123"})
    client.cookies.set("access_token", reg_a.cookies["access_token"])
    trip = client.post("/api/trips/", json={"name": "A's trip", "start_date": "2026-08-01", "end_date": "2026-08-05"})
    trip_id = trip.json()["id"]

    # Create user B and try to access A's trip
    email_b = f"test+{uuid.uuid4()}@example.com"
    reg_b = client.post("/api/auth/register", json={"email": email_b, "password": "pass123"})
    client.cookies.set("access_token", reg_b.cookies["access_token"])
    response = client.get(f"/api/trips/{trip_id}")
    assert response.status_code == 404
```

### Run tests

```bash
cd backend
source venv/bin/activate   # Mac/Linux
python -m pytest tests/ -v
```

Run a single test file:
```bash
python -m pytest tests/test_trips.py -v
```

Expected: all tests pass. If something fails, check the error message — it usually tells you exactly what's wrong.

---

## Dev login

A shared dev account exists for manual testing:

| Field | Value |
|-------|-------|
| Email | `dev@smarttrip.ai` |
| Password | `devpass123` |

Create it by running (safe to run multiple times):
```bash
python scripts/seed_dev_user.py
```

---

## Error handling

Since features are being built incrementally, always raise proper HTTP exceptions instead of letting errors crash silently. This makes it obvious what's not implemented yet vs. what's genuinely broken.

**Use `HTTPException` for expected errors:**

```python
from fastapi import HTTPException

# Not found
raise HTTPException(status_code=404, detail="Trip not found")

# Wrong user
raise HTTPException(status_code=403, detail="Not your trip")

# Feature not ready yet — use 501 so it's obvious it's a stub
raise HTTPException(status_code=501, detail="Not implemented yet")
```

**Wrap external calls in try/except:**

```python
# Good — teammates know exactly what failed
try:
    result = await some_external_api_call()
except Exception as e:
    raise HTTPException(status_code=503, detail=f"External service error: {e}")
```

**Never silently return empty data for an error.** If something fails, raise an exception — don't return `{}` or `[]`. The global exception handler in `main.py` will catch anything unexpected and return a readable error response.

---

## Common mistakes

**Forgetting `await`**
All DB calls must be awaited: `await db.execute(...)`, `await db.commit()`, etc.

**Not filtering by user_id**
Every trips/activities query must include `.where(Trip.user_id == user_id)`.

**Editing the router instead of the service**
Routes are already wired. Only edit files in `services/`.

**Using the same email in multiple tests**
Use `f"test+{uuid.uuid4()}@example.com"` to generate unique emails per test.
