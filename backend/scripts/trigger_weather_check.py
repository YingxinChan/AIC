"""Run the full weather-check pipeline once: swap rained-out activities, then
send the digest email — exactly what the scheduled Celery task does every 3
hours, but on demand. Calls the same code directly (no Celery/Redis needed),
so this works standalone for a demo even if the worker isn't running.

Usage: python scripts/trigger_weather_check.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import AsyncSessionLocal
from services.auto_swap_service import run_auto_swap
from services.notifications_service import send_swap_digest_emails


async def main():
    async with AsyncSessionLocal() as db:
        result = await run_auto_swap(db)
        swapped, tips, reverted = result["swapped"], result["tips"], result["reverted"]

        if not swapped and not tips and not reverted:
            print("No swaps or tips triggered — no un-swapped/fixed outdoor activity is currently affected by any active weather condition.")
            return

        if swapped:
            print(f"Swapped {len(swapped)} activit{'y' if len(swapped) == 1 else 'ies'}:")
            for s in swapped:
                print(f"  trip {s['trip_id']}, activity {s['activity_id']}: {s['original_name']} -> {s['alternate_name']} ({s['reason']})")

        if tips:
            print(f"Generated {len(tips)} tip{'s' if len(tips) != 1 else ''} for fixed activities:")
            for t in tips:
                print(f"  trip {t['trip_id']}, activity {t['activity_id']}: {t['name']} — {t['reason']} — {t['tip']}")

        if reverted:
            print(f"Reverted {len(reverted)} activit{'y' if len(reverted) == 1 else 'ies'}:")
            for r in reverted:
                print(f"  trip {r['trip_id']}, activity {r['activity_id']}: {r['previous_alternate_name']} -> {r['restored_name']}")

        email_results = await send_swap_digest_emails(db, swapped, tips, reverted)

    if not email_results:
        print("No digest emails sent (affected users have email notifications turned off, or below their rain threshold).")
        return

    print(f"Sent {len(email_results)} digest email{'s' if len(email_results) != 1 else ''}:")
    for r in email_results:
        print(f"  user {r['user_id']}: {r['status']}")


if __name__ == "__main__":
    asyncio.run(main())
