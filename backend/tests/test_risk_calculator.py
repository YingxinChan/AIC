# Run: python -m pytest tests/test_risk_calculator.py
import math

from ml.risk_calculator import (
    flood_risk,
    beach_safety,
    snow_probability,
    uv_level,
    uv_advice,
    wind_level
)

# Flood Risk Tests
def test_flood_risk_low():
    result = flood_risk(
        heavy_rain_probability=5,
        rain_today=0,
        rain_tomorrow=0,
    )

    assert result["flood_risk"] == "Low"
    assert result["flood_score"] < 30


def test_flood_risk_moderate():
    result = flood_risk(
        heavy_rain_probability=50,
        rain_today=10,
        rain_tomorrow=5,
    )

    assert result["flood_risk"] == "Moderate"
    assert 30 <= result["flood_score"] < 60


def test_flood_risk_high():
    result = flood_risk(
        heavy_rain_probability=100,
        rain_today=25,
        rain_tomorrow=25,
    )

    assert result["flood_risk"] == "High"
    assert result["flood_score"] == 100


# Beach Safety Tests
def test_beach_safety_excellent():
    result = beach_safety(
        heavy_rain_probability=0,
        wind=10,
        temp=28,
    )

    assert result["beach_safety_level"] == "Excellent"
    assert result["beach_safety_score"] == 100


def test_beach_safety_good():
    result = beach_safety(
        heavy_rain_probability=50,
        wind=25,
        temp=25,
    )

    assert result["beach_safety_level"] == "Good"
    assert result["beach_safety_score"] == 65


def test_beach_safety_moderate():
    result = beach_safety(
        heavy_rain_probability=75,
        wind=25,
        temp=25,
    )

    assert result["beach_safety_level"] == "Moderate"
    assert result["beach_safety_score"] == 40


def test_beach_safety_poor():
    result = beach_safety(
        heavy_rain_probability=100,
        wind=40,
        temp=10,
    )

    assert result["beach_safety_level"] == "Poor"
    assert result["beach_safety_score"] == 0


# Snow Probability Tests
def test_snow_probability_zero():
    result = snow_probability(
        rain=0,
        temp=20,
    )

    assert result["snow_probability"] == 0


def test_snow_probability_cold_light_rain():
    result = snow_probability(
        rain=6,
        temp=2,
    )

    # min(6/30, 0.4) = 0.2
    assert result["snow_probability"] == 20


def test_snow_probability_freezing():
    result = snow_probability(
        rain=10,
        temp=0,
    )

    # 0.4 + 10/20 = 0.9
    assert result["snow_probability"] == 90


def test_snow_probability_heavy_snow():
    result = snow_probability(
        rain=20,
        temp=0,
    )

    # capped at 100%
    assert result["snow_probability"] == 100

# UV level test
def test_uv_level_low():
    assert uv_level(2) == "Low"


def test_uv_level_moderate():
    assert uv_level(5) == "Moderate"


def test_uv_level_high():
    assert uv_level(7) == "High"


def test_uv_level_very_high():
    assert uv_level(9) == "Very High"


def test_uv_level_extreme():
    assert uv_level(12) == "Extreme"

def test_uv_boundary():
    assert uv_level(3) == "Moderate"
    assert uv_level(6) == "High"
    assert uv_level(8) == "Very High"
    assert uv_level(11) == "Extreme"

def test_uv_level_unknown():
    assert uv_level(math.nan) == "Unknown"


# UV advice
def test_uv_always_low():
    """Test when UV never reaches 3 throughout the day."""
    hourly_uv = [0.1, 0.5, 1.2, 2.8, 2.0, 1.0, 0.2]
    hourly_time = [
        "2026-07-26T08:00",
        "2026-07-26T09:00",
        "2026-07-26T10:00",
        "2026-07-26T11:00",
        "2026-07-26T12:00",
        "2026-07-26T13:00",
        "2026-07-26T14:00"
    ]
    
    result = uv_advice(hourly_uv, hourly_time)
    assert result == "Low UV. No special sun protection is needed."


def test_moderate_uv_advice():
    """Test when UV reaches between 3 and 5.9 (Moderate)."""
    hourly_uv = [1.0, 3.2, 5.5, 4.0, 2.0]
    hourly_time = [
        "2026-07-26T10:00",
        "2026-07-26T11:00",
        "2026-07-26T12:00", # Max UV = 5.5
        "2026-07-26T13:00", # Last time UV >= 3 (4.0) -> 01:00 PM
        "2026-07-26T14:00"
    ]
    
    result = uv_advice(hourly_uv, hourly_time)
    assert result == "Use sun protection until 01:00 PM."


def test_high_uv_advice():
    """Test when UV reaches between 6 and 7.9 (High)."""
    hourly_uv = [1.0, 3.5, 7.2, 4.1, 1.5]
    hourly_time = [
        "2026-07-26T10:00",
        "2026-07-26T11:00",
        "2026-07-26T12:00", # Max UV = 7.2
        "2026-07-26T13:00", # Last time UV >= 3 -> 01:00 PM
        "2026-07-26T14:00"
    ]
    
    result = uv_advice(hourly_uv, hourly_time)
    assert result == "High UV. Wear sunscreen and sunglasses until 01:00 PM."


def test_very_high_uv_advice():
    """Test when UV reaches between 8 and 10.9 (Very High)."""
    hourly_uv = [1.0, 4.0, 9.5, 3.1, 1.0]
    hourly_time = [
        "2026-07-26T10:00",
        "2026-07-26T11:00",
        "2026-07-26T12:00", # Max UV = 9.5
        "2026-07-26T13:00", # Last time UV >= 3 -> 01:00 PM
        "2026-07-26T14:00"
    ]
    
    result = uv_advice(hourly_uv, hourly_time)
    assert result == "Very high UV. Limit direct sun exposure until 01:00 PM."


def test_extreme_uv_advice():
    """Test when UV reaches 11 or higher (Extreme)."""
    hourly_uv = [1.0, 5.0, 11.5, 3.8, 0.5]
    hourly_time = [
        "2026-07-26T10:00",
        "2026-07-26T11:00",
        "2026-07-26T12:00", # Max UV = 11.5
        "2026-07-26T13:00", # Last time UV >= 3 -> 01:00 PM
        "2026-07-26T14:00"
    ]
    
    result = uv_advice(hourly_uv, hourly_time)
    assert result == "Extreme UV. Avoid prolonged sun exposure until 01:00 PM."


def test_uv_with_none_values():
    """Test edge case where Open-Meteo returns None for some night/early morning hours."""
    hourly_uv = [None, None, 1.0, 4.5, 6.2, None]
    hourly_time = [
        "2026-07-26T04:00",
        "2026-07-26T05:00",
        "2026-07-26T06:00",
        "2026-07-26T12:00",
        "2026-07-26T14:00", # Last time UV >= 3 -> 02:00 PM
        "2026-07-26T22:00"
    ]
    
    result = uv_advice(hourly_uv, hourly_time)
    assert result == "High UV. Wear sunscreen and sunglasses until 02:00 PM."


# Wind level test
def test_wind_level_calm():
    assert wind_level(5) == "Calm"

def test_wind_level_moderate():
    assert wind_level(15) == "Moderate"

def test_wind_level_strong():
    assert wind_level(25) == "Strong"

def test_wind_level_very_strong():
    assert wind_level(40) == "Very Strong"

def test_wind_level_boundary():
    assert wind_level(10) == "Moderate"
    assert wind_level(20) == "Strong"
    assert wind_level(35) == "Very Strong"

def test_wind_level_unknown():
    assert wind_level(math.nan) == "Unknown"