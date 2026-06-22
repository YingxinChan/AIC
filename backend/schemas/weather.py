from datetime import date
from pydantic import BaseModel

class ForecastDayOut(BaseModel):
    date: date
    condition: str
    temp_min: float
    temp_max: float
    rain_mm: float
    flash_storm_prob: float
