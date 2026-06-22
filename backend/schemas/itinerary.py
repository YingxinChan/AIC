from datetime import date
from pydantic import BaseModel

class ActivityOut(BaseModel):
    id: int
    name: str
    type: str
    time_slot: str
    location: str
    description: str
    is_swapped: bool

class ItineraryDayOut(BaseModel):
    date: date
    activities: list[ActivityOut]

class ItineraryOut(BaseModel):
    days: list[ItineraryDayOut]

class SwapRequest(BaseModel):
    swap_to: str  # "indoor" | "outdoor"
