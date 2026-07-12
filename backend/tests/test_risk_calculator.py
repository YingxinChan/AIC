# Run: python -m pytest backend/tests/test_risk_calculator.py

from ml.risk_calculator import (
    flood_risk,
    beach_safety,
    snow_probability,
)

# Flood risk test
def test_flood_risk_low():
    result = flood_risk(
        heavy_rain_probability=5,
        rain_today=0,
        rain_tomorrow=0,
    )

    assert result["flood_risk"] == "Low"
    assert result["flood_score"] < 30

def test_flood_risk_high():
    result = flood_risk(
        heavy_rain_probability=100,
        rain_today=25,
        rain_tomorrow=25,
    )

    assert result["flood_risk"] == "High"
    assert result["flood_score"] == 100

# Beach safety test
def test_beach_safety_excellent():
    result = beach_safety(
        heavy_rain_probability=0,
        wind=10,
        temp=28,
    )

    assert result["beach_safety_level"] == "Excellent"
    assert result["beach_safety_score"] == 100

def test_beach_safety_poor():
    result = beach_safety(
        heavy_rain_probability=100,
        wind=40,
        temp=10,
    )

    assert result["beach_safety_level"] == "Poor"
    assert result["beach_safety_score"] == 15

# Snow probability test
def test_snow_probability_zero():
    result = snow_probability(
        rain=0,
        temp=20,
    )

    assert result["snow_probability"] == 0

def test_snow_probability_positive():
    result = snow_probability(
        rain=20,
        temp=0,
    )

    assert result["snow_probability"] == 100