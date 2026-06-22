# SmartTrip AI — Project Skeleton Design

**Date:** 2026-06-22
**Scope:** Full project skeleton — folder structure, all screens stubbed, all API routes stubbed, Tailwind styling, graceful error handling. No real feature logic implemented.

---

## 1. Top-Level Structure

```
AIC/
  frontend/       React app (Vite + Tailwind)
  backend/        Python FastAPI app
  ml/             Offline training scripts and notebooks (separate from backend)
  docs/           Project documentation and specs
```

---

## 2. Frontend

### Tech
- React 18 (Vite)
- React Router v6
- Tailwind CSS
- Axios (HTTP client, single configured instance in `src/lib/api.js`)

### Folder structure

```
frontend/
  src/
    features/
      auth/
        LoginPage.jsx
        RegisterPage.jsx
        authApi.js
        useAuth.js
      trips/
        DashboardPage.jsx
        NewTripPage.jsx
        ItineraryPage.jsx
        tripsApi.js
        useTrips.js
      flights/
        FlightsPage.jsx
        flightsApi.js
      weather/
        weatherApi.js          (no page — weather data renders inside ItineraryPage)
    components/
      MapView.jsx              (react-leaflet map centred on London, no pins yet)
      notifications/
        NotificationsPage.jsx
        notificationsApi.js
    components/
      Nav.jsx                  (persistent nav for protected pages)
      AuthLayout.jsx           (wrapper for login/register — no nav)
      AppLayout.jsx            (wrapper for protected pages — with nav)
      ProtectedRoute.jsx       (redirects to /login if no session)
      ErrorMessage.jsx         (inline error display component)
      Placeholder.jsx          (bordered stub block with label text)
    lib/
      api.js                   (configured Axios instance, base URL, interceptors)
      auth.js                  (JWT cookie helpers)
    App.jsx                    (router setup)
    main.jsx
  index.html
  tailwind.config.js
  vite.config.js
  package.json
```

### Routes

| Path | Component | Auth required |
|---|---|---|
| `/` | Landing (inline in App.jsx) | No |
| `/login` | `auth/LoginPage.jsx` | No |
| `/register` | `auth/RegisterPage.jsx` | No |
| `/dashboard` | `trips/DashboardPage.jsx` | Yes |
| `/trips/new` | `trips/NewTripPage.jsx` | Yes |
| `/trips/:tripId` | `trips/ItineraryPage.jsx` | Yes |
| `/flights` | `flights/FlightsPage.jsx` | Yes |
| `/settings/notifications` | `notifications/NotificationsPage.jsx` | Yes |
| `*` | Redirect → `/dashboard` or `/` | — |

### Auth state (frontend)
JWT is stored as an httpOnly cookie (not readable by JS). `useAuth.js` exposes an `AuthContext` provider that calls `GET /api/auth/me` on mount to determine if the user is logged in. It stores `{ user, loading }` in context. `ProtectedRoute` reads from this context: if `loading` is true it shows a spinner; if `user` is null it redirects to `/login`.

### Placeholder convention
Unbuilt content sections use `<Placeholder label="..." />` — a neutral bordered div with plain label text (e.g. `"Itinerary will appear here once generated"`). No fake realistic data.

### Error handling convention
Every API call wrapped in `try/catch`. On failure, render `<ErrorMessage message="Something went wrong — please try again." />`. Never a blank screen or unhandled console error.

---

## 3. Backend

### Tech
- Python 3.11+
- FastAPI
- SQLAlchemy 2.x (async) + PostgreSQL + PostGIS
- Pydantic v2
- Celery + Redis (task queue for itinerary generation)
- Python-jose (JWT)
- Gmail SMTP (email notifications)

### Folder structure

```
backend/
  routers/
    auth.py
    trips.py
    itinerary.py
    weather.py
    flights.py
    notifications.py
  services/
    auth_service.py
    trips_service.py
    itinerary_service.py
    weather_service.py
    flights_service.py
    notifications_service.py
  schemas/
    auth.py
    trips.py
    itinerary.py
    weather.py
    flights.py
    notifications.py
  models/
    user.py
    trip.py
    activity.py
    base.py
  ml/
    predictor.py             (loads trained model artifacts; stubs during skeleton)
  core/
    config.py                (env vars via pydantic Settings)
    database.py              (async engine + session factory)
    security.py              (JWT issue/verify, password hash)
    celery.py                (Celery app instance)
  main.py                    (FastAPI app, register routers, global exception handler)
  requirements.txt
  .env.example
```

### API routes (all prefixed `/api`)

All stubs return `{"status": "not_implemented"}` (GET/DELETE) or `{"status": "not_implemented", "data": {}}` (POST/PUT/PATCH) so the frontend never crashes.

#### Auth — `/api/auth`
```
POST   /register      → {token, user}
POST   /login         → {token, user}
POST   /logout        → 204
GET    /me            → {user}
```

#### Trips — `/api/trips`
```
GET    /              → [{trip}]
POST   /              → {trip}
GET    /:trip_id      → {trip}
DELETE /:trip_id      → 204
```

#### Itinerary — `/api/trips/:trip_id/itinerary`
```
GET    /                       → {days: [{date, weather, activities}]}
POST   /generate               → {job_id, status: "queued"}   ← Celery stub
PATCH  /activities/:id/swap    → {activity}
```

#### Weather — `/api/weather`
```
GET    /forecast?start=&end=   → [{date, condition, temp_min, temp_max, rain_mm, flash_storm_prob}]
```

#### Flights — `/api/flights`
```
GET    /search?origin=&departure=&return=   → [{flight}]
```

#### Notifications — `/api/notifications`
```
GET    /preferences      → {email_enabled, threshold}
PUT    /preferences      → {email_enabled, threshold}
POST   /test             → {message: "Test email sent"}
```

### Auth
JWT issued on login/register, stored as httpOnly cookie. `get_current_user` FastAPI dependency guards all protected routes. Skeleton behaviour: if the cookie is absent → return 401 immediately (guard is active). If a cookie is present → skip JWT signature validation and return a hardcoded dummy user (e.g. `{"id": 1, "email": "stub@example.com"}`). This means unauthenticated access is blocked from day one, but the real token-validation logic can be dropped in later without changing the route structure.

### Error handling
Global FastAPI exception handler returns `{"error": "<message>", "code": "<ERROR_CODE>"}`. No raw tracebacks to the client.

---

## 4. ML Directory

```
ml/
  data/
    raw/               NASA POWER downloads, OWM exports
    processed/         Feature-engineered CSVs
  notebooks/           Exploration and validation notebooks
  scripts/
    fetch_data.py      Pull historical data from NASA POWER + OWM
    engineer_features.py   Lag features (1d, 3d, 7d); drops same-day rain to prevent leakage
    train_catboost.py  Stage 1: rain volume regressor (target R² ≈ 0.837)
    train_lgbm.py      Stage 2: flash storm classifier (target F1 ≈ 0.752)
  models/              Saved model artifacts (.cbm, .txt) — copied to backend/ml/ when ready
  requirements.txt     ML-specific dependencies (separate from backend)
```

---

## 5. Data Models

### SQLAlchemy (ORM)

**User** — `id`, `email`, `hashed_password`, `created_at`

**Trip** — `id`, `user_id` (FK), `name`, `start_date`, `end_date`, `created_at`

**Activity** — `id`, `trip_id` (FK), `day_date`, `name`, `type` (indoor|outdoor), `time_slot`, `location`, `description`, `is_swapped`

Weather forecasts and flight results are not persisted — fetched fresh per request (or returned as stubs).

---

## 6. ML Inference Stub

`backend/ml/predictor.py` exposes two functions during the skeleton phase:

```python
def predict_rain_volume(features: dict) -> float:
    # STUB — replace with CatBoost model load when ml/models/ artifact is ready
    return 0.0

def predict_flash_storm(features: dict) -> float:
    # STUB — replace with LightGBM model load when ml/models/ artifact is ready
    return 0.0
```

The weather service calls these; they produce valid-shaped output so the rest of the stack works end-to-end before the ML team delivers a trained model.

---

## 7. Key Conventions Summary

| Convention | Rule |
|---|---|
| Placeholder UI | `<Placeholder label="..." />` — bordered div, honest text, no fake data |
| API stubs | Return `{"status": "not_implemented"}` — never crash or 500 |
| ML stubs | Return `0.0` with `# STUB` comment — valid shape for callers |
| Celery stubs | Return `{"job_id": "stub-job-id", "status": "queued"}` |
| Auth guard | `ProtectedRoute` on frontend; `get_current_user` dependency on backend — both active from day one |
| Error display | `<ErrorMessage>` on frontend; `{"error", "code"}` JSON on backend |
| Styling | Tailwind utility classes, neutral palette (grays + one accent colour), no custom CSS unless Tailwind can't do it |
| Map view | Included in skeleton as a real Leaflet map (react-leaflet + OpenStreetMap tiles) inside a panel on the Itinerary page. Centred on London (51.5074, -0.1278), zoom 13. No pins in skeleton — pins added when activity locations are real. |
