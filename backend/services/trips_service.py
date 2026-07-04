from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.trip import Trip


async def list_trips(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(select(Trip).where(Trip.user_id == user_id))
    trips = result.scalars().all()

    return [
        {
            "id": trip.id,
            "user_id": trip.user_id,
            "name": trip.name,
            "start_date": trip.start_date,
            "end_date": trip.end_date,
            "created_at": trip.created_at,
        }
        for trip in trips
    ]


async def create_trip(
    db: AsyncSession,
    user_id: int,
    name: str,
    start_date: date,
    end_date: date,
) -> dict:
    trip = Trip(user_id=user_id, name=name, start_date=start_date, end_date=end_date)
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return {"id": trip.id}


async def get_trip(db: AsyncSession, trip_id: int, user_id: int) -> dict:
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
    )
    trip = result.scalar_one_or_none()

    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    return {
        "id": trip.id,
        "user_id": trip.user_id,
        "name": trip.name,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "created_at": trip.created_at,
    }


async def delete_trip(db: AsyncSession, trip_id: int, user_id: int) -> None:
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
    )
    trip = result.scalar_one_or_none()

    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    await db.delete(trip)
    await db.commit()