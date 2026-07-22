import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import AsyncSessionLocal
from services.auto_swap_service import run_auto_swap


async def main():
    async with AsyncSessionLocal() as db:
        swapped = await run_auto_swap(db)

    if not swapped:
        print("No swaps triggered — no un-swapped outdoor activity is currently forecast to have heavy rain.")
        return

    print(f"Swapped {len(swapped)} activit{'y' if len(swapped) == 1 else 'ies'}:")
    for s in swapped:
        print(f"  trip {s['trip_id']}, activity {s['activity_id']}: {s['reason']}")


if __name__ == "__main__":
    asyncio.run(main())
