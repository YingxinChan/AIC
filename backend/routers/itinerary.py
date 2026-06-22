from fastapi import APIRouter, Depends
from core.security import get_current_user
from schemas.itinerary import SwapRequest
from services import itinerary_service

router = APIRouter(prefix="/api/trips/{trip_id}/itinerary", tags=["itinerary"])

@router.get("/")
async def get_itinerary(trip_id: int, current_user: dict = Depends(get_current_user)):
    return itinerary_service.get_itinerary(trip_id)

@router.post("/generate")
async def generate_itinerary(trip_id: int, current_user: dict = Depends(get_current_user)):
    return itinerary_service.generate_itinerary(trip_id)

@router.patch("/activities/{activity_id}/swap")
async def swap_activity(
    trip_id: int,
    activity_id: int,
    body: SwapRequest,
    current_user: dict = Depends(get_current_user),
):
    return itinerary_service.swap_activity(trip_id, activity_id, body.swap_to)
