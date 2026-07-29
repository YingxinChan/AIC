# Run: python -m pytest tests/test_risk_calculator.py
import math
from ml.risk_calculator import (
    flood_risk,
    beach_safety,
    snow_probability,
    uv_level,
    uv_advice,
    wind_level,
    temp_level,
    temp_advice,
    hiking_safety,
)

# Flood Risk Tests
def test_low_flood_risk(): 
    # Little rain and low heavy rain probability should give low flood risk.
    result = flood_risk(
        heavy_rain_probability=10,
        rain_today=2,
        rain_tomorrow=0,
        max_hourly_rain=0,
    )
    assert result["flood_risk"] == "Low"
    assert result["flood_score"] < 30


def test_moderate_flood_risk(): 
    # Moderate rainfall should produce moderate flood risk.
    result = flood_risk(
        heavy_rain_probability=50,
        rain_today=20,
        rain_tomorrow=10,
        max_hourly_rain=10,
    )
    assert result["flood_risk"] == "Moderate"
    assert 30 <= result["flood_score"] < 60


def test_high_flood_risk(): 
    # Severe rainfall conditions should produce high flood risk.
    result = flood_risk(
        heavy_rain_probability=90,
        rain_today=60,
        rain_tomorrow=50,
        max_hourly_rain=30,
    )
    assert result["flood_risk"] == "High"
    assert result["flood_score"] >= 60


def test_flash_flood_risk(): 
    # Intense hourly rainfall should increase flood risk
    low_intensity = flood_risk(
        heavy_rain_probability=50,
        rain_today=20,
        rain_tomorrow=0,
        max_hourly_rain=2,
    )

    high_intensity = flood_risk(
        heavy_rain_probability=50,
        rain_today=20,
        rain_tomorrow=0,
        max_hourly_rain=30,
    )
    assert high_intensity["flood_score"] > low_intensity["flood_score"]


def test_flood_score_cannot_exceed_100(): 
    # Extreme rainfall should be capped at 100.
    result = flood_risk(
        heavy_rain_probability=100,
        rain_today=100,
        rain_tomorrow=100,
        max_hourly_rain=100,
    )
    assert result["flood_score"] == 100
    assert result["flood_risk"] == "High"


def test_flood_probability_boundary(): 
    #Check the boundary between Low and Moderate risk.
    result = flood_risk(
        heavy_rain_probability=75,
        rain_today=20,
        rain_tomorrow=20,
        max_hourly_rain=15,
    )

    assert result["flood_score"] >= 30


# Beach Safety Tests
def test_excellent_beach_conditions():
    # Clear weather, calm wind, comfortable temperature.
    result = beach_safety(
        heavy_rain_probability=0,
        rain=0,
        wind=10,
        feels_like_temp=28,
    )
    assert result["beach_safety_level"] == "Excellent"
    assert result["beach_safety_score"] >= 80

def test_good_beach_conditions():
    # Some minor weather concerns, but still suitable.
    result = beach_safety(
        heavy_rain_probability=40,
        rain=10,
        wind=20,
        feels_like_temp=34,
    )
    assert result["beach_safety_level"] == "Good"
    assert 60 <= result["beach_safety_score"] < 80

def test_moderate_beach_conditions():
    # Noticeable weather risks reduce beach suitability.
    result = beach_safety(
        heavy_rain_probability=60,
        rain=15,
        wind=35,
        feels_like_temp=32,
    )
    assert result["beach_safety_level"] == "Moderate"
    assert 40 <= result["beach_safety_score"] < 60

def test_poor_beach_conditions():
    # Heavy rain, strong wind, and extreme heat.
    result = beach_safety(
        heavy_rain_probability=90,
        rain=50,
        wind=60,
        feels_like_temp=42,
    )
    assert result["beach_safety_level"] == "Poor"
    assert result["beach_safety_score"] < 40

def test_high_rainfall_reduces_beach_score():
    # Same weather except rainfall amount.
    dry_day = beach_safety(
        heavy_rain_probability=20,
        rain=0,
        wind=10,
        feels_like_temp=28,
    )

    rainy_day = beach_safety(
        heavy_rain_probability=20,
        rain=30,
        wind=10,
        feels_like_temp=28,
    )
    assert rainy_day["beach_safety_score"] < dry_day["beach_safety_score"]

def test_high_feels_like_temperature_reduces_beach_score():
    # Extreme heat should make beach conditions worse.
    comfortable = beach_safety(
        heavy_rain_probability=0,
        rain=0,
        wind=10,
        feels_like_temp=28,
    )

    hot_weather = beach_safety(
        heavy_rain_probability=0,
        rain=0,
        wind=10,
        feels_like_temp=42,
    )
    assert hot_weather["beach_safety_score"] < comfortable["beach_safety_score"]

def test_strong_wind_reduces_beach_score():
    # Strong wind makes beach conditions less safe.
    calm = beach_safety(
        heavy_rain_probability=0,
        rain=0,
        wind=10,
        feels_like_temp=28,
    )

    windy = beach_safety(
        heavy_rain_probability=0,
        rain=0,
        wind=50,
        feels_like_temp=28,
    )
    assert windy["beach_safety_score"] < calm["beach_safety_score"]

# Snow Probability Tests
def test_warm_weather_no_snow():
    result = snow_probability(
        rain=10,
        snowfall=0,
        temp=10
    )
    assert result["snow_probability"] == 0

def test_forecasted_snow():
    result = snow_probability(
        rain=5,
        snowfall=2,
        temp=-2
    )
    assert result["snow_probability"] > 0

def test_cold_rain_possible_snow():
    result = snow_probability(
        rain=10,
        snowfall=0,
        temp=0
    )
    assert result["snow_probability"] > 0

def test_cold_dry_no_snow():
    result = snow_probability(
        rain=0,
        snowfall=0,
        temp=-5
    )
    assert result["snow_probability"] == 0

def test_probability_cannot_exceed_100():
    result = snow_probability(
        rain=100,
        snowfall=20,
        temp=-10
    )
    assert result["snow_probability"] <= 100

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
        "2026-07-26T08:00", # Local destination time
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
        "2026-07-26T10:00", # Local destination time
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
        "2026-07-26T10:00", # Local destination time
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
        "2026-07-26T10:00", # Local destination time
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
        "2026-07-26T10:00", # Local destination time
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
        "2026-07-26T04:00", # Local destination time
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


# Temp risk 
def test_extreme_heat():
    result = temp_level(40)
    assert result == "Extreme Heat"

def test_high_heat():
    result = temp_level(32)
    assert result == "High Heat"

def test_safe_temperature():
    result = temp_level(22)
    assert result == "Safe"

def test_cold_conditions():
    result = temp_level(-2)
    assert result == "Cold Conditions"

def test_extreme_cold():
    result = temp_level(-15)
    assert result == "Extreme Cold"

def test_heat_boundary():
    assert temp_level(35) == "Extreme Heat"
    assert temp_level(34.9) == "High Heat"


def test_cold_boundary():
    assert temp_level(0) == "Cold Conditions"
    assert temp_level(0.1) == "Safe"

# Temp advice
def test_extreme_heat_advice():
    result = temp_advice("Extreme Heat")
    assert result == (
        "Avoid prolonged outdoor activities. "
        "Stay hydrated and seek shade."
    )

def test_high_heat_advice():
    result = temp_advice("High Heat")
    assert result == (
        "Limit intense outdoor activities, "
        "especially during midday."
    )

def test_extreme_cold_advice():
    result = temp_advice("Extreme Cold")
    assert result == (
        "Wear protective layers and "
        "avoid long exposure outdoors."
    )

def test_safe_advice():
    result = temp_advice("Safe")
    assert result == (
        "Temperature conditions are comfortable "
        "for outdoor activities."
    )

def test_unknown_temperature_level():
    result = temp_advice("Unknown")
    assert result == "Check local conditions before travelling."

# Hiking safety test
def test_safe_hiking_conditions():
    result = hiking_safety(
        heavy_rain_probability=0,
        wind=10,
        visibility=10000,
        temp_risk="Safe",
        snow_probability=0,
    )

    assert result["hiking_safety_score"] == 100
    assert result["hiking_safety_level"] == "Safe"


def test_caution_hiking_conditions():
    result = hiking_safety(
        heavy_rain_probability=50,
        wind=25,
        visibility=2500,
        temp_risk="Safe",
        snow_probability=0,
    )

    assert result["hiking_safety_level"] == "Caution"
    assert 60 <= result["hiking_safety_score"] < 80


def test_unsafe_hiking_conditions():
    result = hiking_safety(
        heavy_rain_probability=60,
        wind=40,
        visibility=800,
        temp_risk="High Heat",
        snow_probability=0,
    )

    assert result["hiking_safety_level"] == "Unsafe"
    assert 40 <= result["hiking_safety_score"] < 60


def test_dangerous_hiking_conditions():
    result = hiking_safety(
        heavy_rain_probability=90,
        wind=60,
        visibility=300,
        temp_risk="Extreme Cold",
        snow_probability=90,
    )

    assert result["hiking_safety_level"] == "Dangerous"
    assert result["hiking_safety_score"] < 40


def test_extreme_temperature_affects_score():
    safe_weather = hiking_safety(
        heavy_rain_probability=0,
        wind=10,
        visibility=10000,
        temp_risk="Safe",
        snow_probability=0,
    )

    extreme_weather = hiking_safety(
        heavy_rain_probability=0,
        wind=10,
        visibility=10000,
        temp_risk="Extreme Heat",
        snow_probability=0,
    )

    assert extreme_weather["hiking_safety_score"] < safe_weather["hiking_safety_score"]


def test_high_snow_probability_affects_score():
    result = hiking_safety(
        heavy_rain_probability=0,
        wind=10,
        visibility=10000,
        temp_risk="Safe",
        snow_probability=90,
    )

    assert result["hiking_safety_score"] < 100