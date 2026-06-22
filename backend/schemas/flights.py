from pydantic import BaseModel

class FlightOut(BaseModel):
    flight_number: str
    airline: str
    origin: str
    destination: str
    departure: str
    arrival: str
    price_gbp: float
