from datetime import date, time
from pydantic import BaseModel

class ForecastDayOut(BaseModel):
    date: date

    # Weather
    weather_code: int
    condition: str
    
    temp_min: float
    temp_max: float
    rain_mm: float

    uv_index: float
    uv_level: str

    wind_speed: float
    wind_level: str
    
    visibility_m: float

    # lgbm prediction
    heavy_rain_probability: float
    heavy_rain_warning: bool

    # Rule-based risks
    flood_score: float
    flood_risk: str

    beach_safety_score: float
    beach_safety_level: str

    snow_probability: float

class HourlyWeatherOut(BaseModel):
    time: str
    temperature: float
    rain_mm: float
    rain_probability: float | None = None
    condition: str
