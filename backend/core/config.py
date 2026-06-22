from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/smarttrip"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key"
    gmail_user: str = ""
    gmail_app_password: str = ""
    amadeus_client_id: str = ""
    amadeus_client_secret: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
