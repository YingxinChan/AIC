from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    # Supabase uses pgbouncer in transaction mode — asyncpg prepared statements are not
    # supported. statement_cache_size=0 disables them; jit=off avoids related pgbouncer bugs.
    connect_args={"server_settings": {"jit": "off"}, "statement_cache_size": 0}
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
