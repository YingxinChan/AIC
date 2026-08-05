from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


DEFAULT_SECRET_KEY = "dev-secret-key"


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/smarttrip"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = DEFAULT_SECRET_KEY
    # Comma-separated list of allowed frontend origins for CORS — the
    # localhost defaults only work for local dev; production must set
    # CORS_ORIGINS to the real deployed frontend origin(s), or every API
    # call from the browser gets silently blocked.
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    gmail_user: str = ""
    gmail_app_password: str = ""
    openweather_api_key: str = ""
    anthropic_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
    )

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def _validate_production_secret(s: "Settings") -> None:
    if s.environment == "production" and s.secret_key == DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is still the default dev value in a production environment "
            "(ENVIRONMENT=production). Set a real, random SECRET_KEY env var before "
            "starting the app — tokens signed with the default key can be forged by "
            "anyone who reads this source file."
        )


settings = Settings()
_validate_production_secret(settings)
