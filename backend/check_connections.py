import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    try:
        import asyncpg
        url = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(url)
        await conn.close()
        print("✓ Database (Supabase) — connected")
    except Exception as e:
        print(f"✗ Database (Supabase) — FAILED: {e}")

async def check_redis():
    try:
        import redis.asyncio as redis
        r = redis.from_url(os.getenv("REDIS_URL", ""), ssl_cert_reqs=None)
        await r.ping()
        await r.aclose()
        print("✓ Redis (Upstash) — connected")
    except Exception as e:
        print(f"✗ Redis (Upstash) — FAILED: {e}")

async def check_openmeteo():
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": 51.5, "longitude": -0.12, "hourly": "temperature_2m"},
                timeout=10,
            )
        if r.status_code == 200:
            print("✓ Open-Meteo — connected")
        else:
            print(f"✗ Open-Meteo — FAILED: status {r.status_code}")
    except Exception as e:
        print(f"✗ Open-Meteo — FAILED: {e}")

async def main():
    print("Checking connections...\n")
    await check_db()
    await check_redis()
    await check_openmeteo()

asyncio.run(main())
