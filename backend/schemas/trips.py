from datetime import date
from pydantic import BaseModel

class CreateTripRequest(BaseModel):
    name: str
    destination: str = "London"
    origin: str = ""
    start_date: date
    end_date: date
    original_plan: str = ""
    hotel_address: str = ""

class TripOut(BaseModel):
    id: int
    name: str
    destination: str = "London"
    origin: str = ""
    start_date: date
    end_date: date
    arrival_flight_number: str = ""
    arrival_airline: str = ""
    arrival_time: str = ""
    arrival_other_time: str = ""
    departure_flight_number: str = ""
    departure_airline: str = ""
    departure_time: str = ""
    departure_other_time: str = ""
    original_plan: str = ""
    hotel_address: str = ""


class SelectFlightRequest(BaseModel):
    leg: str  # "arrival" | "departure"
    flight_number: str
    airline: str
    time: str
    other_time: str = ""
