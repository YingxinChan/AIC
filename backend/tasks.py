import asyncio

from core.celery import celery_app
from core.database import AsyncSessionLocal
from services.auto_swap_service import run_auto_swap
from services.notifications_service import send_swap_digest_emails


@celery_app.task(name="tasks.check_weather_swaps")
def check_weather_swaps():
    return asyncio.run(_check_weather_swaps())


async def _check_weather_swaps():
    async with AsyncSessionLocal() as db:
        result = await run_auto_swap(db)
        if result["swapped"] or result["tips"] or result["reverted"]:
            await send_swap_digest_emails(db, result["swapped"], result["tips"], result["reverted"])
        return result
