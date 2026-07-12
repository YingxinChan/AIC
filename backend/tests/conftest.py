import asyncio
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from main import app
from core.database import get_db
from core.config import settings
from models.user import User
from models.trip import Trip


# NullPool + statement_cache_size=0 is required for Supabase (pgbouncer in
# transaction mode). NullPool prevents asyncpg "operation in progress" errors
# when TestClient makes multiple sequential requests in one test function.
# statement_cache_size=0 prevents DuplicatePreparedStatementError from
# pgbouncer reusing connections that already have named prepared statements.
_test_engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0},
)
_TestSessionLocal = async_sessionmaker(_test_engine, expire_on_commit=False)


async def _override_get_db():
    async with _TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_client():
    c = TestClient(app)
    email = f"test+{uuid.uuid4()}@example.com"
    response = c.post("/api/auth/register", json={"email": email, "password": "testpass123"})
    token = response.cookies.get("access_token")
    c.cookies.set("access_token", token)
    return c


def pytest_sessionfinish(session, exitstatus):
    """Tests run against the real shared Supabase DB (see engine setup above),
    so every user/trip/activity they create is a permanent row unless we clean
    it up. All test-created users follow the `test+<uuid>@example.com` pattern
    (see this file and test_auth.py) — delete them and their trips (activities
    cascade automatically) once the whole run finishes."""

    async def cleanup():
        async with _TestSessionLocal() as db:
            result = await db.execute(
                select(User.id).where(User.email.like("test+%@example.com"))
            )
            user_ids = [uid for (uid,) in result]
            if not user_ids:
                return
            await db.execute(delete(Trip).where(Trip.user_id.in_(user_ids)))
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()

    asyncio.run(cleanup())
