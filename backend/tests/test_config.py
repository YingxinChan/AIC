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
