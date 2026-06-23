import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from main import app
from core.database import get_db
from core.config import settings


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
