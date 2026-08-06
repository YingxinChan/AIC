"""Send every currently-ongoing trip's owner one email with an AI-generated
summary of that day's weather — meant to run once daily (see
.github/workflows/daily-weather-summary.yml), separate from
trigger_weather_check.py's every-3-hours swap check.

Usage: python scripts/send_daily_weather_summary.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import AsyncSessionLocal
from services.daily_summary_service import send_daily_summaries


async def main():
    async with AsyncSessionLocal() as db:
        results = await send_daily_summaries(db)

    if not results:
        print("No ongoing trips today — no daily weather summaries sent.")
        return

    print(f"Sent {len(results)} daily weather summar{'y' if len(results) == 1 else 'ies'}:")
    for r in results:
        print(f"  trip {r['trip_id']}, user {r['user_id']}: {r['status']}")


if __name__ == "__main__":
    asyncio.run(main())
