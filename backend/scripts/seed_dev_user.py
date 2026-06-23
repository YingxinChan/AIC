import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.user import User
from core.security import hash_password

DEV_EMAIL = "dev@smarttrip.ai"
DEV_PASSWORD = "devpass123"


async def seed():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == DEV_EMAIL))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Dev user already exists (id={existing.id}). Skipping.")
            return
        user = User(email=DEV_EMAIL, hashed_password=hash_password(DEV_PASSWORD))
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Dev user created: {DEV_EMAIL} / {DEV_PASSWORD} (id={user.id})")


if __name__ == "__main__":
    asyncio.run(seed())
