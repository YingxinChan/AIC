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
    hotel_lat: float | None = None
    hotel_lng: float | None = None

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
    hotel_lat: float | None = None
    hotel_lng: float | None = None


class SelectFlightRequest(BaseModel):
    leg: str  # "arrival" | "departure"
    flight_number: str
    airline: str
    time: str
    other_time: str = ""


class UpdateTripRequest(BaseModel):
    # Partial update — all fields optional. Destination and origin are
    # deliberately excluded, this endpoint never touches them (both are
    # permanently locked once a trip is created).
    start_date: date | None = None
    end_date: date | None = None
    hotel_address: str | None = None
    # Only meaningful alongside hotel_address (see trips_service.update_trip_details)
    # — a dropdown pick sends real coordinates, freehand typing sends neither,
    # which correctly clears any stale coordinates from a prior selection.
    hotel_lat: float | None = None
    hotel_lng: float | None = None
