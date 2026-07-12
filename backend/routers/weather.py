from typing import List
from fastapi import APIRouter, Depends
from schemas.weather import ForecastDayOut
from core.security import get_current_user
from services.weather_service import get_weather_prediction, get_hourly_weather

router = APIRouter(
    prefix="/api/weather",
    tags=["Weather"]
)

# ML daily risk
@router.get("/prediction", response_model=list[ForecastDayOut])
def prediction(
    lat: float,
    lon: float,
    current_user: dict = Depends(get_current_user),
):
    return get_weather_prediction(lat, lon)

# Hourly weather
@router.get("/hourly")
def hourly(
    lat: float,
    lon: float,
    current_user: dict = Depends(get_current_user),
):
    return get_hourly_weather(lat, lon)
