from fastapi import APIRouter, Depends
from core.security import get_current_user
from services import flights_service

router = APIRouter(prefix="/api/flights", tags=["flights"])

@router.get("/search")
async def search_flights(
    origin: str,
    departure: str,
    return_date: str,
    current_user: dict = Depends(get_current_user),
):
    return flights_service.search_flights(origin, departure, return_date)
