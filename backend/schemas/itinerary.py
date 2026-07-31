from datetime import date
from pydantic import BaseModel

class ActivityOut(BaseModel):
    id: int
    day_date: date
    name: str
    type: str
    time_slot: str
    location: str
    description: str
    lat: float
    lng: float
    is_swapped: bool
    alternate_name: str
    alternate_location: str
    swap_reason: str
    weather_sensitivity: str
    is_fixed: bool

class ItineraryDayOut(BaseModel):
    date: date
    activities: list[ActivityOut]

class ItineraryOut(BaseModel):
    days: list[ItineraryDayOut]

class SwapRequest(BaseModel):
    swap_to: str  # "indoor" | "outdoor"

class UpdateActivityRequest(BaseModel):
    day_date: date | None = None
    time_slot: str | None = None
    name: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    is_fixed: bool | None = None
