from fastapi import APIRouter, Depends
from core.security import get_current_user
from services import weather_service

router = APIRouter(prefix="/api/weather", tags=["weather"])

@router.get("/forecast")
async def get_forecast(
    start: str,
    end: str,
    current_user: dict = Depends(get_current_user),
):
    return weather_service.get_forecast(start, end)
