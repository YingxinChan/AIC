# SmartTrip AI — Session Notes (2026-06-22)

## What we did

### 1. Brainstormed + designed the skeleton
Agreed on the full structure via Q&A:
- **Auth:** Light accounts (email + password login, trips saved per user)
- **Trip flow:** AI-generated itineraries (auto, not user-curated)
- **Flights:** Separate page, independent of trip planning
- **Map:** Real Leaflet map on the Itinerary page (changed from "cut" to "include")
- **Styling:** Tailwind CSS
- **Structure:** Feature-based (`features/<domain>/`) for both frontend and backend

### 2. Wrote the spec
`docs/superpowers/specs/2026-06-22-skeleton-design.md`
Full design document covering screens, API routes, data models, auth behaviour, ML placement, placeholder conventions.

### 3. Wrote the implementation plan
`docs/superpowers/plans/2026-06-22-skeleton.md`
13 tasks with complete code for every step. TDD throughout.

### 4. Built everything (subagent-driven, all reviewed)
Each task was implemented by a subagent, reviewed by a reviewer subagent, fixed if needed, then marked done.

| Task | What |
|---|---|
| 1 | Backend scaffolding (FastAPI app, requirements.txt, health check) |
| 2 | Core modules (config, database, security/auth stub, celery) |
| 3 | SQLAlchemy models (User, Trip, Activity) + all Pydantic schemas |
| 4 | Auth router (register, login, logout, me) — cookie auth stub active |
| 5 | Trips + itinerary routers (all stubbed, auth-guarded) |
| 6 | Weather, flights, notifications routers (all stubbed, auth-guarded) |
| 7 | `backend/ml/predictor.py` — CatBoost + LightGBM stubs returning 0.0 |
| 8 | Frontend setup (Vite + Tailwind + Vitest) |
| 9 | Shared components (Nav, Placeholder, ErrorMessage, MapView, ProtectedRoute, layouts) |
| 10 | Auth context (useAuth + AuthProvider), LoginPage, RegisterPage, full App.jsx routing |
| 11 | Trip pages (Dashboard, NewTrip, ItineraryPage with Leaflet map) + API callers |
| 12 | Flights + Notifications pages + API callers |
| 13 | `ml/` directory (offline training scripts, gitkeeps for data/models/notebooks) |

### 5. Fixed post-review issues
- Duplicate `httpx` in requirements.txt removed
- `POST /api/notifications/test` stub shape corrected
- `test_flights.py` query param `return=` → `return_date=` consistency fix
- Root-level `.gitignore` added
- `api.js` 401 interceptor fixed to skip redirect on `/auth/me` (was causing login page jump)

---

## How to run locally

```bash
# Backend (from backend/)
cd backend && uvicorn main:app --reload

# Frontend (from frontend/)
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs (auto): http://localhost:8000/docs
- Login: any email + any password (stub — no real validation yet)

---

## Current state of everything

### Backend skeleton auth behaviour
- Cookie absent → 401
- Cookie present (any value) → returns dummy user `{"id": 1, "email": "stub@example.com"}`
- All routes return `{"status": "not_implemented"}` — no real logic yet

### Frontend skeleton behaviour
- All pages exist and are navigable
- Unbuilt sections show `<Placeholder label="..." />` with honest text
- Leaflet map on Itinerary page — centred on London, no pins yet
- Auth context (useAuth) calls `/api/auth/me` on load to check session

### Tests
- Backend: 24 passing (`cd backend && python -m pytest tests/ -v`)
- Frontend: 20 passing (`cd frontend && npm test`)

### NOT committed yet
All 107 files are staged (`git status` will show them). Ask Claude to commit when ready.

---

## What teammates build next (parallel tracks)

| Track | Where to work | What to fill in |
|---|---|---|
| **ML** | `ml/scripts/` | Replace `NotImplementedError` stubs with real training logic; copy `.cbm`/`.txt` artifacts to `backend/ml/` |
| **Backend** | `backend/services/` | Replace `{"status": "not_implemented"}` stubs with real DB + API logic |
| **Frontend** | `backend/features/` | Wire up real API calls, forms, state management into the page shells |
| **Proposal** | `docs/` | Write proposal — all research data is in CLAUDE.md |

The **API contract** (what routes exist, what they take/return) is defined in `docs/superpowers/plans/2026-06-22-skeleton.md` Task 1–7 — frontend and backend can build independently against it.

---

## Key files to know

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project context, tech decisions, scope |
| `docs/superpowers/specs/2026-06-22-skeleton-design.md` | Full design spec |
| `docs/superpowers/plans/2026-06-22-skeleton.md` | Implementation plan (with all code) |
| `backend/core/security.py` | Auth stub — replace `get_current_user` with real JWT validation |
| `backend/ml/predictor.py` | ML stub — replace with real model loading |
| `frontend/src/features/auth/useAuth.jsx` | Auth context — replace stub login/logout with real API calls |
