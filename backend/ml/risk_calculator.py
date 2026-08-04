# Run: python ml/risk_calculator.py
from datetime import datetime
import math

# Flood
def flood_risk(
    heavy_rain_probability: float,
    rain_today: float,
    rain_tomorrow: float,
    max_hourly_rain: float,
):
    score = 0
    breakdown = []

    # Heavy rain probability (max 40)
    impact = (heavy_rain_probability / 100) * 40
    score += impact

    breakdown.append({
        "factor": "Heavy Rain Probability",
        "value": heavy_rain_probability,
        "unit": "%",
        "impact": round(impact, 2),
    })

    # Today's rainfall (max 25)
    impact = 0

    if rain_today >= 50:
        impact = 25
    elif rain_today >= 20:
        impact = 15
    elif rain_today >= 10:
        impact = 5
    score += impact

    breakdown.append({
        "factor": "Today's Rainfall",
        "value": rain_today,
        "unit": "mm",
        "impact": round(impact, 2),
    })

    # Tomorrow rainfall (max 15)
    impact = 0

    if rain_tomorrow >= 50:
        impact = 15
    elif rain_tomorrow >= 20:
        impact = 10
    elif rain_tomorrow >= 10:
        impact = 5
    score += impact

    breakdown.append({
        "factor": "Tomorrow Rainfall",
        "value": rain_tomorrow,
        "unit": "mm",
        "impact": round(impact, 2),
    })

    # Maximum hourly rainfall (max 20)
    impact = 0

    if max_hourly_rain >= 30:
        impact = 20
    elif max_hourly_rain >= 15:
        impact = 10
    elif max_hourly_rain >= 5:
        impact = 5
    score += round(impact, 2)

    breakdown.append({
        "factor": "Peak Hourly Rainfall",
        "value": max_hourly_rain,
        "unit": "mm/h",
        "impact": round(impact, 2),
    })

    score = min(score, 100)

    if score < 30:
        level = "Low"
    elif score < 60:
        level = "Moderate"
    else:
        level = "High"

    return {
        "flood_score": round(score, 2),
        "flood_risk": level,
        "flood_breakdown": breakdown,
    }

# Beach safety
def beach_safety(
    heavy_rain_probability: float,
    rain: float,
    wind: float,
    feels_like_temp: float,
):
    score = 100
    breakdown = []

    # Heavy rain probability
    impact = 0

    if heavy_rain_probability >= 80:
        impact = -40
    elif heavy_rain_probability >= 50:
        impact = -25
    elif heavy_rain_probability >= 20:
        impact = -10

    score += impact

    breakdown.append({
        "factor": "Heavy Rain Probability",
        "value": heavy_rain_probability,
        "unit": "%",
        "impact": impact,
    })

    # Daily rainfall amount
    impact = 0

    if rain >= 30:
        impact = -25
    elif rain >= 10:
        impact = -15
    elif rain >= 5:
        impact = -5

    score += impact

    breakdown.append({
        "factor": "Rainfall",
        "value": rain,
        "unit": "mm",
        "impact": impact,
    })

    # Wind
    impact = 0

    if wind >= 50:
        impact = -30
    elif wind >= 35:
        impact = -15
    elif wind >= 20:
        impact = -5

    score += impact

    breakdown.append({
        "factor": "Wind Speed",
        "value": wind,
        "unit": "km/h",
        "impact": impact,
    })

    # Feels-like temperature
    impact = 0

    if feels_like_temp >= 40:
        impact = -25
    elif feels_like_temp >= 35:
        impact = -15
    elif feels_like_temp <= 10:
        impact = -15

    score += impact

    breakdown.append({
        "factor": "Feels Like Temperature",
        "value": feels_like_temp,
        "unit": "°C",
        "impact": impact,
    })

    score = max(0, score)

    if score >= 80:
        level = "Excellent"
    elif score >= 60:
        level = "Good"
    elif score >= 40:
        level = "Moderate"
    else:
        level = "Poor"

    return {
        "beach_safety_score": round(score, 2),
        "beach_safety_level": level,
        "beach_safety_breakdown": breakdown,
    }

# Snow prob
def snow_probability(
    rain: float,
    snowfall: float,
    temp: float,
):
    impact = 0
    breakdown = []

    # Actual snowfall predicted
    if snowfall > 0:
        impact = min(
            snowfall / 5,
            1.0
        )
        breakdown.append({
            "factor": "Forecast Snowfall",
            "value": snowfall,
            "unit": "mm",
            "impact": round(impact * 100, 2),
        })

    # Cold enough + precipitation but no snowfall prediction
    elif temp <= 1 and rain > 0:
        impact = min(rain / 20, 0.8)
        breakdown.append({
            "factor": "Temperature",
            "value": temp,
            "unit": "°C",
            "impact": 0,
        })
        breakdown.append({
            "factor": "Rainfall",
            "value": rain,
            "unit": "mm",
            "impact": round(impact * 100, 2),
        })

    # Too warm or no precipitation
    else:
        impact = 0
        breakdown.append({
            "factor": "Temperature",
            "value": temp,
            "unit": "°C",
            "impact": 0,
        })
        breakdown.append({
            "factor": "Precipitation",
            "value": rain,
            "unit": "mm",
            "impact": 0,
        })

    return {
        "snow_probability": round(impact * 100, 2),
        "snow_breakdown": breakdown,
    }

# UV level
def uv_level(uv: float):
    if uv is None or math.isnan(uv):
        return "Unknown"

    if uv < 3:
        return "Low"
    elif uv < 6:
        return "Moderate"
    elif uv < 8:
        return "High"
    elif uv < 11:
        return "Very High"
    else:
        return "Extreme"

# UV advice (hourly)
def uv_advice(hourly_uv, hourly_time):
    # Find the last hour where UV is 3 or above
    last_protection_time = None

    for uv, time in zip(hourly_uv, hourly_time):
        if uv is not None and uv >= 3:
            last_protection_time = time

    # UV never reaches 3
    if last_protection_time is None:
        return "Low UV. No special sun protection is needed."

    # Convert time format
    end_time = datetime.fromisoformat(last_protection_time).strftime("%I:%M %p")

    max_uv = max((u for u in hourly_uv if u is not None), default=0)

    if max_uv < 6:
        return f"Use sun protection until {end_time}."
    elif max_uv < 8:
        return f"High UV. Wear sunscreen and sunglasses until {end_time}."
    elif max_uv < 11:
        return f"Very high UV. Limit direct sun exposure until {end_time}."
    else:
        return f"Extreme UV. Avoid prolonged sun exposure until {end_time}."

# Wind level
def wind_level(wind: float):
    if wind is None or math.isnan(wind):
        return "Unknown"
    
    if wind < 10:
        return "Calm"
    elif wind < 20:
        return "Moderate"
    elif wind < 35:
        return "Strong"
    else:
        return "Very Strong"

# temp level
def temp_level(feels_like_temp: float):
    if feels_like_temp >= 35:
        impact = -20
        level = "Extreme Heat"

    elif feels_like_temp >= 30:
        impact = -10
        level = "High Heat"

    elif feels_like_temp <= -10:
        impact = -20
        level = "Extreme Cold"

    elif feels_like_temp <= 0:
        impact = -5
        level = "Cold Conditions"

    else:
        impact = 0
        level = "Safe"

    return {
        "temperature_level": level,
        "temperature_breakdown": [
            {
                "factor": "Feels Like Temperature",
                "value": feels_like_temp,
                "unit": "°C",
                "impact": impact,
            }
        ]
    }

# temp advice
def temp_advice(temp_level: str):
    advice = {
        "Extreme Heat": 
            "Avoid prolonged outdoor activities. Stay hydrated and seek shade.",

        "High Heat":
            "Limit intense outdoor activities, especially during midday.",

        "Extreme Cold":
            "Wear protective layers and avoid long exposure outdoors.",

        "Cold Conditions":
            "Dress warmly and prepare for cold outdoor conditions.",

        "Safe":
            "Temperature conditions are comfortable for outdoor activities."
    }
    return advice.get(
        temp_level,
        "Check local conditions before travelling."
    )

# hiking safety
def hiking_safety(
    heavy_rain_probability: float,
    wind: float,
    visibility: float,
    temp_risk: str,
    snow_probability: float,
):
    score = 100
    breakdown = []

    # Heavy rain probability
    impact = 0

    if heavy_rain_probability >= 80:
        impact = -30
    elif heavy_rain_probability >= 50:
        impact = -20
    elif heavy_rain_probability >= 20:
        impact = -10
    score += impact

    breakdown.append({
        "factor": "Heavy Rain Probability",
        "value": heavy_rain_probability,
        "unit": "%",
        "impact": impact,
    })

    # Wind
    impact = 0

    if wind >= 50:
        impact = -25
    elif wind >= 35:
        impact = -15
    elif wind >= 20:
        impact = -5
    score += impact

    breakdown.append({
        "factor": "Wind Speed",
        "value": wind,
        "unit": "km/h",
        "impact": impact,
    })

    # Visibility
    impact = 0

    if visibility < 500:
        impact = -20
    elif visibility < 1000:
        impact = -10
    elif visibility < 3000:
        impact = -5
    score += impact

    breakdown.append({
        "factor": "Visibility",
        "value": round(visibility / 1000, 2),
        "unit": "km",
        "impact": impact,
    })

    # Temperature risk
    impact = 0

    if temp_risk == "Extreme Heat":
        impact = -20
    elif temp_risk == "Extreme Cold":
        impact = -20
    elif temp_risk == "High Heat":
        impact = -10
    elif temp_risk == "Cold Conditions":
        impact = -5
    score += impact

    breakdown.append({
        "factor": "Extreme Temperature",
        "value": temp_risk,
        "impact": impact,
    })

    # Snow probability
    impact = 0

    if snow_probability >= 80:
        impact = -20
    elif snow_probability >= 50:
        impact = -10
    elif snow_probability >= 20:
        impact = -5
    score += impact

    breakdown.append({
        "factor": "Snow Probability",
        "value": snow_probability,
        "unit": "%",
        "impact": impact,
    })

    score = max(0, score)

    if score >= 80:
        level = "Safe"
    elif score >= 60:
        level = "Caution"
    elif score >= 40:
        level = "Unsafe"
    else:
        level = "Dangerous"

    return {
        "hiking_safety_score": round(score, 2),
        "hiking_safety_level": level,
        "hiking_safety_breakdown": breakdown,
    }


# For testing
if __name__ == "__main__":

    result = flood_risk(
        heavy_rain_probability=82,
        rain_today=18.5,
        rain_tomorrow=12.3,
        max_hourly_rain=5.2
    )

    print(result)