from datetime import date
from pydantic import BaseModel

class ActivityOut(BaseModel):
    id: int
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

class ItineraryDayOut(BaseModel):
    date: date
    activities: list[ActivityOut]

class ItineraryOut(BaseModel):
    days: list[ItineraryDayOut]

class SwapRequest(BaseModel):
    swap_to: str  # "indoor" | "outdoor"
