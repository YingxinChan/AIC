from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/smarttrip"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key"
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


settings = Settings()
