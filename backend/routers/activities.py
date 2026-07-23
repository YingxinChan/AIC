from fastapi import APIRouter, Depends, Query
from core.security import get_current_user
from services import routing_service

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("/walking-distance")
async def walking_distance(
    from_lat: float = Query(...),
    from_lng: float = Query(...),
    to_lat: float = Query(...),
    to_lng: float = Query(...),
    current_user: dict = Depends(get_current_user),
):
    result = await routing_service.get_walking_distance(from_lat, from_lng, to_lat, to_lng)
    return result or {"distance_m": None, "duration_min": None}
