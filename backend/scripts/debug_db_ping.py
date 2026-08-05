"""Standalone DB reachability check — isolates whether a hang is at the DB
connection step itself vs. somewhere later in trigger_weather_check.py's
pipeline. Prints progress as it goes (flush=True) since GitHub Actions only
shows output once it's actually written, not buffered till the process exits.

Usage: python scripts/debug_db_ping.py
"""

import asyncio
import time

from core.database import AsyncSessionLocal
from sqlalchemy import text


async def main():
    print("Connecting...", flush=True)
    start = time.time()
    async with AsyncSessionLocal() as db:
        print(f"Session opened after {time.time() - start:.2f}s, running query...", flush=True)
        result = await db.execute(text("select 1"))
        print(f"Query returned {result.scalar()} after {time.time() - start:.2f}s total", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
