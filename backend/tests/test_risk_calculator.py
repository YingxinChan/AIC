# Run: python -m pytest tests/test_risk_calculator.py
import math

from ml.risk_calculator import (
    flood_risk,
    beach_safety,
    snow_probability,
    uv_level,
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