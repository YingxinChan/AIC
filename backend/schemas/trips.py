from datetime import date
from pydantic import BaseModel

class CreateTripRequest(BaseModel):
    name: str
    start_date: date
    end_date: date

class TripOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
