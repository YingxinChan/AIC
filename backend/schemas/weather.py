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
    uv_advice: str

    wind_speed: float
    wind_level: str
    
    visibility_km: float

    sunrise: str
    sunset: str

    # lgbm prediction
    heavy_rain_probability: float
    heavy_rain_warning: bool

    # Rule-based risks
    flood_score: float
    flood_risk: str

    beach_safety_score: float
    beach_safety_level: str

    snow_probability: float

    # Seconds offset from UTC for the destination's resolved local timezone
    # (Open-Meteo's &timezone=auto) — `date`/`time` fields above are in this
    # local timezone, not GMT/UTC.
    utc_offset_seconds: int

    temperature_level: str
    temperature_advice: str

    hiking_safety_score: float
    hiking_safety_level: str

class HourlyWeatherOut(BaseModel):
    time: str
    temperature: float
    feels_like_temp: float
    rain_mm: float
    rain_probability: float | None = None
    condition: str
    utc_offset_seconds: int
    uv_index: float
    wind_speed: float
    visibility_km: float
