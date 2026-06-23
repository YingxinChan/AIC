# SmartTrip AI

A travel itinerary planner that adapts to weather forecasts — suggesting indoor/outdoor activity swaps when conditions change, with flight recommendations included. MVP scope is London only.

Built for a competition/grant submission.

---

## What it does

- Generates a day-by-day London itinerary based on the weather forecast
- Swaps activities (indoor ↔ outdoor) automatically when the forecast changes
- Includes flight search (mock data for prototype)
- Sends email notifications when itinerary changes

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Python FastAPI + Celery |
| Database | PostgreSQL (Supabase) + PostGIS |
| Cache / Queue | Redis (Upstash) |
| Weather | OpenWeatherMap API |
| ML | CatBoost (rain prediction) + LightGBM (storm detection) |
| Notifications | Gmail SMTP |

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
│   ├── routers/    # API endpoints
│   ├── services/   # Business logic
│   ├── models/     # SQLAlchemy models
│   ├── schemas/    # Pydantic schemas
│   └── ml/         # ML model loader
├── frontend/       # React app
│   └── src/
│       ├── features/   # Auth, trips, flights, notifications
│       └── components/ # Shared components
├── ml/             # Offline ML training
│   └── scripts/    # Training scripts
└── docs/           # Setup guide, specs, plans
```

## Team

4 people working in parallel tracks: ML, Backend, Frontend, Proposal.

See [docs/SETUP.md](docs/SETUP.md) to get your environment running.
