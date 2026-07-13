# SmartTrip AI — How It Works

This doc explains the technology behind the project for teammates who are new to this stack. You don't need to know all of this to start contributing — but reading it will help you understand why things are set up the way they are.

---

## Big picture

The app has two separate programs that talk to each other:

```
Your browser
     ↕  (HTTP requests)
Frontend (React) — runs at localhost:5173
     ↕  (HTTP requests)
Backend (FastAPI) — runs at localhost:8000
     ↕  (SQL queries)
Database (PostgreSQL on Supabase) — cloud, shared by the whole team
```

The frontend is what the user sees. The backend is the brain — it handles business logic, talks to the database, and will eventually call the ML models and weather APIs. The database stores everything permanently.

---

## Backend

### FastAPI — the web framework

FastAPI is a Python library for building APIs. An API is just a program that accepts HTTP requests (like a web browser does) and returns data, usually as JSON.

When you start the backend with `uvicorn main:app --reload`, FastAPI starts listening for requests. Every URL the frontend calls (like `POST /api/auth/login`) is handled by a function called a **route handler**.

```python
@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_service.login_user(db, body.email, body.password)
    ...
```

The `@router.post("/login")` line says "when someone sends a POST request to this URL, call this function". FastAPI automatically reads the request body, validates it, calls your function, and sends back the response.

**Why `async`?** Python can only do one thing at a time normally. `async` functions let Python pause and work on something else while waiting for a slow operation (like a database query) to finish. This means the server can handle many requests at once without slowing down.

---

### SQLAlchemy — talking to the database

SQLAlchemy is a Python library for reading and writing to a database without writing raw SQL. Instead of writing `SELECT * FROM trips WHERE user_id = 5`, you write Python:

```python
result = await db.execute(select(Trip).where(Trip.user_id == user_id))
trips = result.scalars().all()
```

**Models** are Python classes that represent database tables. Each class attribute is a column:

```python
class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
```

This tells SQLAlchemy: "there is a table called `trips`, it has these columns, and `user_id` links to the `users` table". The `ForeignKey` is how you connect two tables — every trip belongs to a user.

**The `db` session** is how you send queries. It's injected into your function by FastAPI automatically via `Depends(get_db)`. Think of it as your connection to the database for that one request. You always `await` database calls because they're slow (going to the cloud and back).

---

### Alembic — database migrations

A **migration** is a script that changes the database schema — adding a table, adding a column, removing something. You need this because you can't just edit Python model files and expect the real database to update automatically. The database doesn't know Python changed — you have to tell it explicitly.

**Alembic** is the tool that manages these migration scripts for this project.

**How migrations work:**

1. You change a model in Python (e.g. add a new column to `Activity`)
2. You run `alembic revision --autogenerate -m "add_my_column"` — Alembic compares your Python model to the current database and generates a migration script
3. You run `alembic upgrade head` — this actually applies the script to the database

The migration scripts live in `backend/alembic/versions/`. Each one has an `upgrade()` function (apply the change) and a `downgrade()` function (undo it).

**Important:** The database for this project is already set up with all the right tables. You only need to run a migration if you're adding or changing a table yourself. When that happens, let the team know so everyone can apply the migration.

---

### Pydantic schemas — request and response shapes

**Pydantic** is a library for validating data. In this project, schemas define what a request body must look like and what the response will contain.

```python
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
```

When FastAPI receives a `POST /api/auth/login` request, it automatically checks that the body has an `email` field (that looks like an email) and a `password` field. If anything is missing or wrong, FastAPI rejects the request with a 422 error before your code even runs.

Schemas are in `backend/schemas/`. They are separate from models — models describe the database, schemas describe what goes in/out of the API.

---

### Auth — JWT cookies

When you log in, the server creates a **JWT (JSON Web Token)** — a small signed string that encodes who you are. It gets stored in a **cookie** in your browser.

```
JWT looks like: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1In0.abc123
```

Every subsequent request your browser makes automatically includes this cookie. The server reads it, verifies the signature (to make sure it hasn't been tampered with), and decodes your user ID from it.

This is what `Depends(get_current_user)` does on protected routes — it reads the cookie, verifies it, and gives your function the logged-in user's details. If the cookie is missing or invalid, the request is rejected with a 401.

**Why cookies and not localStorage?** Cookies with `httponly=True` can't be read by JavaScript — only sent automatically by the browser. This protects the token from being stolen by XSS attacks (malicious scripts running in the page).

Tokens expire after 7 days. After that, the user has to log in again.

---

### Celery + Redis — background jobs (set up, not currently used by itinerary generation)

Some things take too long to do while a user is waiting for a response. The original plan was to run itinerary generation as a background job:

**Celery** is a task queue — you hand it a job, it runs it in the background, and you check back later for the result.

**Redis** is an in-memory database that Celery uses as a message broker — it's the "queue" that holds pending jobs.

**What's actually implemented instead:** `itinerary_service.py` calls Claude Haiku directly and synchronously inside the request handler for `POST /api/trips/{id}/itinerary/generate` — no job queue, no polling. A single Haiku call for a few days' worth of activities is fast enough that this didn't need the extra moving parts, so the flow is just:
1. User clicks "Generate" → frontend sends `POST /api/trips/1/itinerary/generate`
2. Backend calls Claude Haiku, waits for the response, saves the activities to the DB
3. Backend returns the generated itinerary in the same response

The Celery/Redis setup in `core/celery.py` is still there and still works — it's just unused for this feature. If a future feature genuinely needs a background job (e.g. something slower, or the ML pipeline), it's already wired up and ready.

---

## Frontend

### React — the UI framework

React is a JavaScript library for building user interfaces. Instead of writing HTML directly, you write **components** — reusable pieces of UI that are just JavaScript functions returning HTML-like syntax called JSX:

```jsx
function LoginPage() {
    return (
        <div>
            <h1>Log in</h1>
            <input type="email" />
        </div>
    )
}
```

React updates only the parts of the page that changed, which makes it fast.

---

### How the frontend is structured

```
frontend/src/
  features/         ← one folder per feature
    auth/           ← login, register pages + API calls + auth hook
    trips/          ← dashboard, new trip, itinerary pages + API calls
    flights/        ← flights page + API calls
    notifications/  ← notifications page + API calls
    weather/        ← weather API calls
  components/       ← shared UI pieces (Nav, Layout, etc.)
  lib/
    api.js          ← the Axios instance — all HTTP calls go through here
```

Each feature folder has the page component(s), the API call functions, and any custom hooks.

---

### Axios — making HTTP requests

Axios is a JavaScript library for making HTTP requests to the backend. All API calls go through the single configured instance in `src/lib/api.js`:

```js
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    withCredentials: true,   // sends cookies automatically
})
```

`withCredentials: true` is important — without it, the browser won't send the JWT cookie with requests, and every route will return 401.

To call the backend from any component:

```js
import api from '../../lib/api'

const response = await api.get('/api/trips/')
const trips = response.data
```

---

### useAuth — the auth hook

`src/features/auth/useAuth.jsx` is a React hook that manages login state for the whole app. It checks on startup whether you're already logged in (by calling `GET /api/auth/me`), and exposes `login`, `logout`, and `user` to any component that needs them.

Protected pages use `<ProtectedRoute>` — if you're not logged in, it redirects you to `/login`.

---

### Routing

React Router handles navigation between pages. All routes are defined in `src/App.jsx`. When you click a link, React swaps the component being rendered without doing a full page reload.

---

## How a request flows end to end

Here's what happens when a logged-in user loads their dashboard:

```
1. Browser loads /dashboard
2. React renders DashboardPage component
3. Component calls api.get('/api/trips/')
4. Browser sends: GET http://localhost:8000/api/trips/ (with JWT cookie)
5. FastAPI receives it → calls get_current_user → decodes JWT → user_id = 5
6. Calls trips_service.list_trips(db, user_id=5)
7. SQLAlchemy: SELECT * FROM trips WHERE user_id = 5
8. Supabase returns rows → SQLAlchemy returns Python objects
9. FastAPI serialises to JSON → returns [{id:1, name:"London", ...}, ...]
10. React receives the data → renders the trip cards
```

---

## What's still a stub

Several services return placeholder responses right now. This is intentional — the skeleton is built so teammates can fill in the real logic without setting up the whole project from scratch.

| Feature | File to edit | Status |
|---|---|---|
| Trip CRUD | `services/trips_service.py` | **Done** |
| Flight selection → trip timing | `services/trips_service.py` (`select_flight`) | **Done** |
| Itinerary generation (Claude Haiku) | `services/itinerary_service.py` | **Done** |
| Activity swap (weather-triggered) | `services/itinerary_service.py` (`swap_activity`) | Stub |
| Weather forecast | `services/weather_service.py` | Stub |
| Flight search | `services/flights_service.py` | **Done** (mock data — real API integration is future work) |
| Email notifications | `services/notifications_service.py` | Stub |
| ML models | `ml/predictor.py` | Stub |
| Auth | `services/auth_service.py` | **Done** |

See `docs/CONTRIBUTING.md` for the exact patterns to follow when filling in a stub.
