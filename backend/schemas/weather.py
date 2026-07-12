from datetime import date
from pydantic import BaseModel

class ForecastDayOut(BaseModel):
    date: date

    # Weather
    condition: str
    
    temp_min: float
    temp_max: float
    rain_mm: float

    # lgbm prediction
    heavy_rain_probability: float
    heavy_rain_warning: bool

    # Rule-based risks
    flood_score: float
    flood_risk: str

    beach_safety_score: float
    beach_safety_level: str

    snow_probability: float
