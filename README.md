# Navia

A travel itinerary planner that adapts to weather forecasts — automatically swapping indoor/outdoor activities when conditions change, with flight recommendations included. MVP scope covers **25 European cities** (expanded from the original London-only MVP).

---

## What it does

- Generates a day-by-day itinerary for any of 25 European cities, based on the weather forecast
- Automatically swaps activities (indoor ↔ outdoor) when the forecast changes — checked every 3 hours
- Shows the itinerary on an interactive map (Leaflet)
- Includes flight search (realistic mock data — no live flight API for the prototype)
- Sends a daily AI-generated weather-summary email for ongoing trips, plus notifications when the itinerary changes
- Lets users manually edit/add/delete activities, with AI-assisted weather-sensitivity tagging

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS, Leaflet / react-leaflet for the map |
| Backend | Python FastAPI (async) |
| Database | PostgreSQL (Supabase), SQLAlchemy + Alembic |
| Scheduling | GitHub Actions cron (weather re-checks every 3h, daily summary email at 9am UTC) |
| Weather data | Open-Meteo (live forecasts + historical archive for ML training) |
| ML | LightGBM classifier for heavy-rain risk, with SHAP explainability |
| AI summaries | Anthropic API (daily weather-summary email text) |
| Notifications | Gmail SMTP |

> Celery + Redis are still listed in `requirements.txt` but aren't used for scheduling — GitHub Actions replaced the originally-planned Celery Beat setup, since an always-on worker isn't free to run. PostGIS was part of the original plan but isn't implemented; activity/trip locations use plain lat/lng columns.

## Getting started

See **[docs/SETUP.md](docs/SETUP.md)** for full setup instructions (Mac and Windows).

Quick start:
```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Project structure

```
AIC/
├── backend/        # FastAPI app
│   ├── routers/    # API endpoints (auth, trips, itinerary, flights, weather, notifications)
│   ├── services/   # Business logic (itinerary generation, auto-swap, mock flights, daily summaries)
│   ├── models/     # SQLAlchemy models
│   ├── schemas/    # Pydantic schemas
│   ├── ml/         # Runtime ML model loader (LightGBM heavy-rain classifier)
│   └── scripts/    # Scheduled-job entry points, run by GitHub Actions
├── frontend/       # React app
│   └── src/
│       ├── features/   # Auth, trips, itinerary, flights, account, landing
│       └── components/ # Shared components (incl. MapView)
├── ml/             # Offline ML training (data fetch, feature engineering, training)
│   └── models/     # Trained model artifacts + SHAP plots
├── .github/workflows/  # Scheduled jobs (weather-check, daily-weather-summary)
└── docs/           # Setup guide, how-it-works, demo notes
```

## Docs

- [docs/SETUP.md](docs/SETUP.md) — environment setup
- [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) — how the weather-adaptive itinerary logic works
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — contributing guide for the team

## Team

4 people working in parallel tracks: ML, Backend, Frontend.

See [docs/SETUP.md](docs/SETUP.md) to get your environment running.
