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
        "hotel_lat": trip.hotel_lat,
        "hotel_lng": trip.hotel_lng,
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
    hotel_lat: float | None = None,
    hotel_lng: float | None = None,
) -> dict:
    trip = Trip(
        user_id=user_id, name=name, start_date=start_date, end_date=end_date,
        destination=destination, origin=origin, original_plan=original_plan, hotel_address=hotel_address,
        hotel_lat=hotel_lat, hotel_lng=hotel_lng,
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


async def update_trip_details(
    db: AsyncSession,
    trip_id: int,
    user_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    hotel_address: str | None = None,
    hotel_lat: float | None = None,
    hotel_lng: float | None = None,
) -> dict:
    trip = await _get_owned_trip(db, trip_id, user_id)

    # Validate the resulting range, not just whichever field is being patched
    # — a partial patch (e.g. only start_date) can otherwise push it past the
    # trip's existing end_date with no check at all, since the frontend's
    # datesInvalid guard is the only other thing enforcing this.
    new_start = start_date if start_date is not None else trip.start_date
    new_end = end_date if end_date is not None else trip.end_date
    if new_start is not None and new_end is not None and new_end <= new_start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    if start_date is not None:
        trip.start_date = start_date
    if end_date is not None:
        trip.end_date = end_date
    if hotel_address is not None:
        trip.hotel_address = hotel_address
        # Coordinates only ever accompany a hotel_address edit (see
        # HotelSearchInput/ItineraryPage) — a dropdown pick sends real
        # numbers, freehand typing sends neither, which correctly clears any
        # stale coordinates left over from a previous selection that no
        # longer matches the (now-edited) address string.
        trip.hotel_lat = hotel_lat
        trip.hotel_lng = hotel_lng
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
