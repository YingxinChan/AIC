from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/smarttrip"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key"
    gmail_user: str = ""
    gmail_app_password: str = ""
    openweather_api_key: str = ""
    anthropic_api_key: str = ""
    ors_api_key: str = ""


    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = ".env"

settings = Settings()
