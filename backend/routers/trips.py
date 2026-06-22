from fastapi import APIRouter, Depends
from core.security import get_current_user
from schemas.trips import CreateTripRequest
from services import trips_service

router = APIRouter(prefix="/api/trips", tags=["trips"])

@router.get("/")
async def list_trips(current_user: dict = Depends(get_current_user)):
    return trips_service.list_trips(current_user["id"])

@router.post("/")
async def create_trip(body: CreateTripRequest, current_user: dict = Depends(get_current_user)):
    return trips_service.create_trip(current_user["id"], body.name, body.start_date, body.end_date)

@router.get("/{trip_id}")
async def get_trip(trip_id: int, current_user: dict = Depends(get_current_user)):
    return trips_service.get_trip(trip_id, current_user["id"])

@router.delete("/{trip_id}", status_code=204)
async def delete_trip(trip_id: int, current_user: dict = Depends(get_current_user)):
    trips_service.delete_trip(trip_id, current_user["id"])
