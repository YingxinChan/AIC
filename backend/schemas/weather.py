from datetime import date

from pydantic import BaseModel
from typing import List, Union


class RiskBreakdown(BaseModel):
    factor: str
    value: Union[str, float, int]
    unit: str | None = None
    impact: float


class ForecastDayOut(BaseModel):
    date: date
    is_climatology: bool = False

    # Core weather
    weather_code: int | None = None
    condition: str

    temp_min: float | None = None
    temp_max: float | None = None
    rain_mm: float | None = None

    # Forecast-only fields
    uv_index: float | None = None
    uv_level: str | None = None
    uv_advice: str | None = None

    wind_speed: float | None = None
    wind_level: str | None = None

    visibility_km: float | None = None
    visibility_m: float | None = None

    # Optional: climatology-fallback days (see is_climatology) have no real
    # Open-Meteo response to read these from — climatology_service.py never
    # sets them. The frontend's "Sunrise / Sunset not available" fallback
    # (ItineraryPage.jsx) exists specifically for this case, not dead code.
    sunrise: str | None = None
    sunset: str | None = None

    # Temperature risk
    temperature_level: str | None = None
    temperature_advice: str | None = None
    temperature_breakdown: List[RiskBreakdown] = []

    # Forecast model output
    heavy_rain_probability: float | None = None
    heavy_rain_warning: bool | None = None

    # Climatology-only historical rain frequency
    rain_chance: float | None = None

    # Risk scores
    flood_score: float | None = None
    flood_risk: str = "Unknown"
    flood_breakdown: List[RiskBreakdown] = []

    beach_safety_score: float | None = None
    beach_safety_level: str = "Unknown"
    beach_safety_breakdown: List[RiskBreakdown] = []

    snow_probability: float | None = None
    snow_breakdown: List[RiskBreakdown] = []

    temperature_level: str
    temperature_advice: str
    temperature_breakdown: List[RiskBreakdown]

    hiking_safety_score: float
    hiking_safety_level: str
    hiking_safety_breakdown: List[RiskBreakdown]

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
