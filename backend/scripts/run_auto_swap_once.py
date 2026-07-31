import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import AsyncSessionLocal
from services.auto_swap_service import run_auto_swap


async def main():
    async with AsyncSessionLocal() as db:
        result = await run_auto_swap(db)
    swapped, tips = result["swapped"], result["tips"]

    if not swapped and not tips:
        print("No swaps or tips triggered — no un-swapped/fixed outdoor activity is currently affected by any active weather condition.")
        return

    if swapped:
        print(f"Swapped {len(swapped)} activit{'y' if len(swapped) == 1 else 'ies'}:")
        for s in swapped:
            print(f"  trip {s['trip_id']}, activity {s['activity_id']}: {s['reason']}")

    if tips:
        print(f"Generated {len(tips)} tip{'s' if len(tips) != 1 else ''} for fixed activities:")
        for t in tips:
            print(f"  trip {t['trip_id']}, activity {t['activity_id']}: {t['name']} — {t['reason']} — {t['tip']}")


if __name__ == "__main__":
    asyncio.run(main())
