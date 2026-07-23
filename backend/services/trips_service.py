import asyncio
from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.trip import Trip
from services import geocoding_service

VALID_LEGS = ("arrival", "departure")


def _trip_dict(trip: Trip) -> dict:
    return {
        "id": trip.id,
        "user_id": trip.user_id,
        "name": trip.name,
        "destination": trip.destination,
        "origin": trip.origin,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "created_at": trip.created_at,
        "arrival_flight_number": trip.arrival_flight_number,
        "arrival_airline": trip.arrival_airline,
        "arrival_time": trip.arrival_time,
        "arrival_other_time": trip.arrival_other_time,
        "departure_flight_number": trip.departure_flight_number,
        "departure_airline": trip.departure_airline,
        "departure_time": trip.departure_time,
        "departure_other_time": trip.departure_other_time,
        "original_plan": trip.original_plan,
        "hotel_address": trip.hotel_address,
    }


async def list_trips(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(select(Trip).where(Trip.user_id == user_id))
    trips = result.scalars().all()
    return [_trip_dict(trip) for trip in trips]


async def create_trip(
    db: AsyncSession,
    user_id: int,
    name: str,
    start_date: date,
    end_date: date,
    destination: str = "London",
    origin: str = "",
    original_plan: str = "",
    hotel_address: str = "",
) -> dict:
    trip = Trip(
        user_id=user_id, name=name, start_date=start_date, end_date=end_date,
        destination=destination, origin=origin, original_plan=original_plan, hotel_address=hotel_address,
    )

    # Geocoded server-side so the weather auto-swap background job can fetch
    # forecasts without depending on the browser's client-side geocode call.
    # Best-effort: a failure here doesn't block trip creation, since
    # auto_swap_service self-heals by retrying the geocode on its next run.
    coords = await asyncio.to_thread(geocoding_service.geocode, destination)
    if coords:
        trip.lat, trip.lng = coords

    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return {"id": trip.id}


async def get_trip(db: AsyncSession, trip_id: int, user_id: int) -> dict:
    trip = await _get_owned_trip(db, trip_id, user_id)
    return _trip_dict(trip)


async def delete_trip(db: AsyncSession, trip_id: int, user_id: int) -> None:
    trip = await _get_owned_trip(db, trip_id, user_id)
    await db.delete(trip)
    await db.commit()


async def select_flight(
    db: AsyncSession,
    trip_id: int,
    user_id: int,
    leg: str,
    flight_number: str,
    airline: str,
    time: str,
    other_time: str = "",
) -> dict:
    if leg not in VALID_LEGS:
        raise HTTPException(status_code=400, detail=f"leg must be one of {VALID_LEGS}")

    trip = await _get_owned_trip(db, trip_id, user_id)
    setattr(trip, f"{leg}_flight_number", flight_number)
    setattr(trip, f"{leg}_airline", airline)
    setattr(trip, f"{leg}_time", time)
    setattr(trip, f"{leg}_other_time", other_time)
    await db.commit()
    await db.refresh(trip)
    return _trip_dict(trip)


async def _get_owned_trip(db: AsyncSession, trip_id: int, user_id: int) -> Trip:
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
    )
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip
