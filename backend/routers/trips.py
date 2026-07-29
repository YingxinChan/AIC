from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from schemas.trips import CreateTripRequest, SelectFlightRequest, UpdateTripRequest
from services import trips_service

router = APIRouter(prefix="/api/trips", tags=["trips"])

@router.get("/")
async def list_trips(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trips_service.list_trips(db, current_user["id"])

@router.post("/")
async def create_trip(
    body: CreateTripRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trips_service.create_trip(
        db, current_user["id"], body.name, body.start_date, body.end_date,
        body.destination, body.origin, body.original_plan, body.hotel_address,
    )

@router.get("/{trip_id}")
async def get_trip(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trips_service.get_trip(db, trip_id, current_user["id"])

@router.delete("/{trip_id}", status_code=204)
async def delete_trip(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await trips_service.delete_trip(db, trip_id, current_user["id"])

@router.patch("/{trip_id}/flight")
async def select_flight(
    trip_id: int,
    body: SelectFlightRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Flight times, dates, and hotel address are all baked into itinerary
    # generation together (day-1/last-day scheduling, routing anchor), so
    # this deliberately does NOT auto-regenerate — the frontend batches edits
    # across Dates/Hotel/Flight and triggers one explicit regenerate call
    # (POST /{trip_id}/itinerary/generate) once the user is done editing,
    # rather than regenerating after every single field save.
    return await trips_service.select_flight(
        db, trip_id, current_user["id"], body.leg, body.flight_number, body.airline, body.time, body.other_time
    )

@router.patch("/{trip_id}")
async def update_trip(
    trip_id: int,
    body: UpdateTripRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # See select_flight above — same batched-edit rationale.
    return await trips_service.update_trip_details(
        db, trip_id, current_user["id"],
        body.start_date, body.end_date, body.hotel_address,
    )

