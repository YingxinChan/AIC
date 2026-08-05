import pytest

from core.config import DEFAULT_SECRET_KEY, Settings, _validate_production_secret

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

def test_cors_origins_list_splits_and_strips():
    s = Settings(secret_key="test", cors_origins="http://a.com, http://b.com ,http://c.com")
    assert s.cors_origins_list == ["http://a.com", "http://b.com", "http://c.com"]

def test_cors_origins_list_empty_string_yields_empty_list():
    s = Settings(secret_key="test", cors_origins="")
    assert s.cors_origins_list == []

def test_production_with_default_secret_key_raises():
    s = Settings(secret_key=DEFAULT_SECRET_KEY, environment="production")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        _validate_production_secret(s)

def test_production_with_real_secret_key_does_not_raise():
    s = Settings(secret_key="a-real-random-secret", environment="production")
    _validate_production_secret(s)  # should not raise

def test_development_with_default_secret_key_does_not_raise():
    s = Settings(secret_key=DEFAULT_SECRET_KEY, environment="development")
    _validate_production_secret(s)  # should not raise
