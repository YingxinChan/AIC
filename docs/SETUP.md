# SmartTrip AI — Local Setup Guide

Follow this guide to get the project running on your machine. The backend and frontend can be set up independently — do whichever track you're working on.

Commands are shown for **Mac/Linux** and **Windows** where they differ.

---

## Prerequisites (everyone)

### 1. Git
**Mac:** Should already be installed. Check: `git --version`
**Windows:** Download from [git-scm.com](https://git-scm.com) and install.

### 2. Python 3.10+
**Mac:**
```bash
brew install python
```
If you don't have Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

**Windows:** Download from [python.org](https://python.org) → install with "Add Python to PATH" ticked.

Check it works: `python3 --version` (Mac) or `python --version` (Windows)

### 3. Node.js (18+)
**Mac:**
```bash
brew install node
```
**Windows:** Download from [nodejs.org](https://nodejs.org) and install the LTS version.

Check: `node --version`

### 4. Clone the repo
```bash
git clone <repo-url>
cd AIC
```

---

## Backend setup

### 1. Get the shared database credentials
The team uses shared cloud databases — you do **not** need to install PostgreSQL or Redis locally.

Ask Stella for the `.env` file. Drop it into the `backend/` folder as-is — no need to edit anything. (should be in github)

> **Never commit `.env` to the repo.** It's in `.gitignore` for this reason.

### 2. Create a Python virtual environment

**Mac/Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

> You'll need to run the activate command every time you open a new terminal before starting the backend.

### 3. Install Python packages
```bash
pip install -r requirements.txt
```

### 4. Set the Python interpreter in VS Code

VS Code won't auto-detect the venv since it's inside a subfolder. If you see yellow squiggles on imports, fix it by selecting the right interpreter:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
2. Type **Python: Select Interpreter**
3. Click **Enter interpreter path...** and paste:
   - **Mac/Linux:** `/path/to/AIC/backend/venv/bin/python`
   - **Windows:** `C:\path\to\AIC\backend\venv\Scripts\python.exe`

Replace the path with wherever you cloned the repo. The squiggles will disappear once selected.

### 5. Apply database migrations

```bash
alembic upgrade head
```

This creates the `users`, `trips`, and `activities` tables in the shared Supabase database. Safe to run multiple times — it skips migrations that are already applied.

### 5a. Create the dev login (optional but recommended)

```bash
python scripts/seed_dev_user.py
```

Creates a shared development account you can use to log in without registering:

| Field    | Value               |
|----------|---------------------|
| Email    | `dev@smarttrip.ai`  |
| Password | `devpass123`        |

Safe to run multiple times — it skips creation if the user already exists.

### 6. Verify all connections

Before starting the backend, run this to confirm everything is reachable:

**Mac/Linux:**
```bash
source venv/bin/activate
python check_connections.py
```

**Windows:**
```bash
venv\Scripts\activate
python check_connections.py
```

You should see:
```
✓ Database (Supabase) — connected
✓ Redis (Upstash) — connected
✓ OpenWeatherMap — connected
```

If anything shows ✗, check that your `.env` file is in the `backend/` folder and the values are correct.

### 6. Start the backend

**Mac/Linux:**
```bash
source venv/bin/activate   # if not already activated
uvicorn main:app --reload
```

**Windows:**
```bash
venv\Scripts\activate
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
API docs (auto-generated): http://localhost:8000/docs
Health check: http://localhost:8000/api/health

### 8. Run backend tests

**Mac/Linux:**
```bash
source venv/bin/activate
python -m pytest tests/ -v
```

**Windows:**
```bash
venv\Scripts\activate
python -m pytest tests/ -v
```
Expected: 33 tests passing.

---

## Frontend setup

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Start the frontend
```bash
npm run dev
```

Frontend runs at: http://localhost:5173 (or `5174` if 5173 is already in use — check the terminal output)

### 3. Run frontend tests
```bash
npm test
```
Expected: 20 tests passing.

---

## Current state

Auth is real — all other features are stubs:

- **Register / Login:** fully working, backed by Supabase. Use `dev@smarttrip.ai` / `devpass123` for dev login.
- **All other API routes** return `{"status": "not_implemented"}` — teammates fill these in
- **Unbuilt sections** show placeholder text explaining what goes there
- **Map:** shows London, no pins yet
- **Itinerary page:** navigate directly to `http://localhost:5173/trips/1`

---

## Common issues

**`source venv/bin/activate` not found (Mac)**
Make sure you're inside the `backend/` folder when you run it.

**`venv\Scripts\activate` not recognized (Windows)**
Make sure you're inside the `backend/` folder. Also try `.\venv\Scripts\activate` with the leading `.\`.

**`uvicorn: command not found`**
You forgot to activate the venv first.

**Backend starts but crashes with a DB connection error**
Check that your `.env` file is in the `backend/` folder and the `DATABASE_URL` is correct.

**Port 8000 already in use**

Mac/Linux:
```bash
lsof -i :8000
kill -9 <PID>
```
Windows:
```bash
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Port 5173 already in use**

Mac/Linux:
```bash
lsof -i :5173
kill -9 <PID>
```
Windows:
```bash
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```
