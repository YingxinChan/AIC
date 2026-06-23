# Alembic Migrations Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Alembic with autogenerate support so the team can create and apply PostgreSQL schema migrations from the command line.

**Architecture:** Alembic lives in `backend/alembic/` and reads config from `backend/alembic.ini`. It connects via a sync `postgresql://` URL (psycopg2) derived automatically from the existing `DATABASE_URL` env var by stripping `+asyncpg`. The app runtime is unaffected and continues to use asyncpg.

**Tech Stack:** Alembic 1.13+, psycopg2-binary, SQLAlchemy 2.0, Python 3.11+

## Global Constraints

- All commands run from `backend/` directory
- `alembic.ini`'s `sqlalchemy.url` must remain blank — URL is always injected from `settings.sync_database_url` in `env.py`
- All models must be imported in `models/__init__.py` or autogenerate will miss their tables
- Do not modify the async `engine` in `core/database.py` — it is for app runtime only

---

### Task 1: Add psycopg2 dependency and sync_database_url config

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/core/config.py`
- Create: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `settings.sync_database_url` — a `str` property on the `Settings` class that returns the database URL with `+asyncpg` stripped

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_config.py`:

```python
from core.config import Settings

def test_sync_database_url_strips_asyncpg_driver():
    s = Settings(
        database_url="postgresql+asyncpg://user:pass@localhost:5432/smarttrip",
        secret_key="test",
    )
    assert s.sync_database_url == "postgresql://user:pass@localhost:5432/smarttrip"

def test_sync_database_url_no_asyncpg_unchanged():
    s = Settings(
        database_url="postgresql://user:pass@localhost:5432/smarttrip",
        secret_key="test",
    )
    assert s.sync_database_url == "postgresql://user:pass@localhost:5432/smarttrip"
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && python -m pytest tests/test_config.py -v
```

Expected: `AttributeError: 'Settings' object has no attribute 'sync_database_url'`

- [ ] **Step 3: Add psycopg2-binary to requirements.txt**

Add after the `asyncpg` line:

```
psycopg2-binary>=2.9
```

- [ ] **Step 4: Install the new dependency**

```bash
pip install psycopg2-binary
```

Expected: `Successfully installed psycopg2-binary-...`

- [ ] **Step 5: Add sync_database_url property to Settings**

In `backend/core/config.py`, add the property inside the `Settings` class, after `gmail_app_password`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/smarttrip"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key"
    gmail_user: str = ""
    gmail_app_password: str = ""
    amadeus_client_id: str = ""
    amadeus_client_secret: str = ""

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
python -m pytest tests/test_config.py -v
```

Expected: `2 passed`

- [ ] **Step 7: Commit**

```bash
git add requirements.txt core/config.py tests/test_config.py
git commit -m "feat: add psycopg2 dependency and sync_database_url for alembic"
```

---

### Task 2: Register all models with Base.metadata

**Files:**
- Modify: `backend/models/__init__.py`
- Create: `backend/tests/test_models.py`

**Interfaces:**
- Consumes: `models.base.Base`, `models.user.User`, `models.trip.Trip`, `models.activity.Activity`
- Produces: `from models import Base` — importing Base from the package now guarantees all three tables are registered in `Base.metadata`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_models.py`:

```python
def test_all_model_tables_registered_in_metadata():
    from models import Base
    table_names = set(Base.metadata.tables.keys())
    assert "users" in table_names
    assert "trips" in table_names
    assert "activities" in table_names
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
python -m pytest tests/test_models.py -v
```

Expected: `AssertionError` — one or more tables missing from metadata (because `__init__.py` is empty, models are never imported).

- [ ] **Step 3: Import all models in models/__init__.py**

Replace the empty `backend/models/__init__.py` with:

```python
from models.user import User
from models.trip import Trip
from models.activity import Activity
from models.base import Base

__all__ = ["Base", "User", "Trip", "Activity"]
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
python -m pytest tests/test_models.py -v
```

Expected: `1 passed`

- [ ] **Step 5: Run full test suite to confirm nothing broken**

```bash
python -m pytest -v
```

Expected: all previously passing tests still pass (26+ passing).

- [ ] **Step 6: Commit**

```bash
git add models/__init__.py tests/test_models.py
git commit -m "feat: import all models in __init__ so Base.metadata is complete"
```

---

### Task 3: Initialize Alembic and configure env.py

**Files:**
- Create: `backend/alembic.ini` (via `alembic init`)
- Create: `backend/alembic/env.py` (then overwrite)
- Create: `backend/alembic/script.py.mako` (auto-created, do not modify)
- Create: `backend/alembic/versions/` (auto-created, stays empty for now)

**Interfaces:**
- Consumes: `settings.sync_database_url` from Task 1, `Base` from Task 2
- Produces: working `alembic` CLI — `alembic current` runs without error when DB is reachable

- [ ] **Step 1: Run alembic init**

```bash
alembic init alembic
```

Expected output:
```
Creating directory .../backend/alembic ...  done
Creating directory .../backend/alembic/versions ...  done
Generating .../backend/alembic.ini ...  done
Generating .../backend/alembic/env.py ...  done
Generating .../backend/alembic/README ...  done
Generating .../backend/alembic/script.py.mako ...  done
```

- [ ] **Step 2: Blank out sqlalchemy.url in alembic.ini**

Open `backend/alembic.ini`. Find the line:
```
sqlalchemy.url = driver://user:pass@localhost/dbname
```
Replace it with:
```
sqlalchemy.url =
```
Leave everything else in `alembic.ini` unchanged.

- [ ] **Step 3: Overwrite alembic/env.py**

Replace the entire contents of `backend/alembic/env.py` with:

```python
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from core.config import settings
from models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.sync_database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Verify alembic can import config without errors**

```bash
python -c "from alembic.config import Config; c = Config('alembic.ini'); print('OK')"
```

Expected: `OK` (no import errors)

- [ ] **Step 5: Commit**

```bash
git add alembic.ini alembic/
git commit -m "feat: initialize alembic with sync psycopg2 env.py"
```

---

### Task 4: Generate and apply initial migration

**Files:**
- Create: `backend/alembic/versions/<hash>_initial_schema.py` (autogenerated)

**Interfaces:**
- Consumes: `Base.metadata` with all three tables registered (Task 2), working `env.py` (Task 3)
- Produces: a migration file that creates `users`, `trips`, `activities` tables; `alembic upgrade head` creates the schema in PostgreSQL

> **Prerequisite:** PostgreSQL must be running and the database must exist. Create it if needed:
> ```bash
> createdb smarttrip
> ```
> Or via psql: `CREATE DATABASE smarttrip;`

- [ ] **Step 1: Generate the initial migration**

```bash
alembic revision --autogenerate -m "initial schema"
```

Expected output:
```
INFO  [alembic.runtime.migration] Context impl PostgreSQLImpl.
INFO  [alembic.autogenerate.compare] Detected added table 'users'
INFO  [alembic.autogenerate.compare] Detected added table 'trips'
INFO  [alembic.autogenerate.compare] Detected added table 'activities'
Generating .../backend/alembic/versions/xxxxxxxxxxxx_initial_schema.py ...  done
```

If you see `Detected added table` for all three, the migration is correct.

- [ ] **Step 2: Review the generated migration file**

Open `backend/alembic/versions/<hash>_initial_schema.py`. The `upgrade()` function should contain three `op.create_table(...)` calls — one each for `users`, `trips`, `activities`. The `downgrade()` function should contain three `op.drop_table(...)` calls in reverse order.

If any table is missing, it means the model wasn't imported. Check `models/__init__.py`.

- [ ] **Step 3: Apply the migration**

```bash
alembic upgrade head
```

Expected:
```
INFO  [alembic.runtime.migration] Running upgrade  -> xxxxxxxxxxxx, initial schema
```

- [ ] **Step 4: Verify the schema was created**

```bash
alembic current
```

Expected: prints the migration hash with `(head)` suffix, e.g.:
```
xxxxxxxxxxxx (head)
```

- [ ] **Step 5: Test rollback**

```bash
alembic downgrade -1
```

Expected:
```
INFO  [alembic.runtime.migration] Running downgrade xxxxxxxxxxxx -> , initial schema
```

Then re-apply:

```bash
alembic upgrade head
```

- [ ] **Step 6: Commit**

```bash
git add alembic/versions/
git commit -m "feat: add initial schema migration for users, trips, activities"
```

---

## Quick Reference (for teammates)

```bash
# Apply all pending migrations (run this after pulling new code)
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# See what migration the DB is currently on
alembic current

# Generate a new migration after changing a model
alembic revision --autogenerate -m "describe what changed"
```

All commands run from `backend/`.
