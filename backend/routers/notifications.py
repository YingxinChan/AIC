from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from schemas.notifications import UpdatePrefsRequest
from services import notifications_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/preferences")
async def get_preferences(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notifications_service.get_preferences(db, current_user["id"])

@router.put("/preferences")
async def update_preferences(
    body: UpdatePrefsRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notifications_service.update_preferences(
        db, current_user["id"], body.email_enabled, body.rain_threshold_mm
    )

@router.post("/test")
async def send_test(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notifications_service.send_test_email(db, current_user["id"])
