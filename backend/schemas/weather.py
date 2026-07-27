from datetime import date

from pydantic import BaseModel


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

    sunrise: str | None = None
    sunset: str | None = None

    temperature_level: str | None = None
    temperature_advice: str | None = None

    # Forecast model output
    heavy_rain_probability: float | None = None
    heavy_rain_warning: bool | None = None

    # Climatology-only historical rain frequency
    rain_chance: float | None = None

    # Risk scores
    flood_score: float | None = None
    flood_risk: str = "Unknown"

    beach_safety_score: float | None = None
    beach_safety_level: str = "Unknown"

    snow_probability: float | None = None

    hiking_safety_score: float | None = None
    hiking_safety_level: str = "Unknown"


class HourlyWeatherOut(BaseModel):
    time: str
    temperature: float
    feels_like_temp: float
    rain_mm: float
    rain_probability: float | None = None
    condition: str
    uv_index: float
    wind_speed: float
    visibility_km: float