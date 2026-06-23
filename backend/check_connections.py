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
        r = redis.from_url(os.getenv("REDIS_URL", ""))
        await r.ping()
        await r.aclose()
        print("✓ Redis (Upstash) — connected")
    except Exception as e:
        print(f"✗ Redis (Upstash) — FAILED: {e}")

async def check_openweather():
    try:
        key = os.getenv("OPENWEATHER_API_KEY", "")
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": "London", "appid": key},
                timeout=10,
            )
        if r.status_code == 200:
            print("✓ OpenWeatherMap — connected")
        elif r.status_code == 401:
            print("✗ OpenWeatherMap — FAILED: invalid API key")
        else:
            print(f"✗ OpenWeatherMap — FAILED: status {r.status_code}")
    except Exception as e:
        print(f"✗ OpenWeatherMap — FAILED: {e}")

async def main():
    print("Checking connections...\n")
    await check_db()
    await check_redis()
    await check_openweather()

asyncio.run(main())
