from typing import List
from fastapi import APIRouter
from schemas.weather import ForecastDayOut
from services.weather_service import get_weather_prediction, get_hourly_weather

router = APIRouter(
    prefix="/weather",
    tags=["Weather"]
)

# ML daily risk
@router.get(
    "/prediction",
    response_model=List[ForecastDayOut]
)
def prediction(lat: float, lon: float):
    return get_weather_prediction(lat, lon)

# Hourly weather
@router.get("/hourly")
def hourly(lat: float, lon: float):
    return get_hourly_weather(lat, lon)
