from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    # pool_pre_ping checks each pooled connection with a lightweight SELECT before
    # handing it out, transparently discarding ones Supabase's pgbouncer closed server-side
    # while idle — without this, requests intermittently fail with
    # "connection was closed in the middle of operation". pool_recycle forces a refresh
    # before connections get old enough to be closed server-side in the first place.
    pool_pre_ping=True,
    pool_recycle=300,
    # Supabase uses pgbouncer in transaction mode — asyncpg prepared statements are not
    # supported. statement_cache_size=0 disables them; jit=off avoids related pgbouncer bugs.
    connect_args={"server_settings": {"jit": "off"}, "statement_cache_size": 0}
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
