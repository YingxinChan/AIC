# Run: python ml/risk_calculator.py

# Heavy rain probability + accumulated rainfall
def flood_risk(
    heavy_rain_probability: float,
    rain_today: float,
    rain_tomorrow: float,
):
    score = 0
    score += (heavy_rain_probability/100) * 60 # 100% heavy_rain -> 60 flood points

    if rain_today >= 20:
        score += 25
    elif rain_today >= 10:
        score += 15
    elif rain_today >= 5:
        score += 5

    if rain_tomorrow >= 20:
        score += 15
    elif rain_tomorrow >= 10:
        score += 8

    score = min(score, 100) # Not letting score > 100

    # Risk level
    if score < 30:
        level = "Low"
    elif score < 60:
        level = "Moderate"
    else:
        level = "High"
    
    return {
        "flood_score": round(score, 2),
        "flood_risk": level,
    }

# Heavy rain probability + wind + temp
def beach_safety(
    heavy_rain_probability: float,
    wind: float,
    temp: float,
):
    score = 100
    score -= (heavy_rain_probability/100) * 40

    if wind > 30:
        score -= 30
    elif wind > 20:
        score += 15
    elif wind >= 5:
        score += 5

    if temp < 18:
        score -= 15

    score = max(min(score, 100), 0)

    # Risk level
    if 80 <= score <= 100:
        level = "Excellent"
    elif 60 <= score < 80:
        level = "Good"
    elif 40 <= score < 60:
        level = "Moderate"
    else:
        level = "Poor"

    return {
        "beach_safety_score": round(score, 2),
        "beach_safety_level": level,
    }

# Rainfall + wind + temperature
def snow_probability(
    rain: float,
    temp: float,
):

    if temp > 3:
        probability = 0
    elif temp > 1:
        probability = min(rain / 30, 0.4)
    else:
        probability = min(
            0.4 + rain / 20,
            1.0
        )

    return {
        "snow_probability": round(probability * 100, 2)
    }


# For testing
if __name__ == "__main__":

    result = flood_risk(
        heavy_rain_probability=0.82,
        rain_today=18.5,
        rain_tomorrow=12.3
    )

    print(result)