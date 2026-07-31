# Run: python -m services.weather_service

from services.openmeteo import get_forecast
from services.feature_builder import build_features
from ml.predictor import WeatherPredictor
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

# Weather code
WEATHER_CODES = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",

    45: "Fog",
    48: "Fog",

    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",

    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",

    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",

    80: "Rain Showers",
    81: "Heavy Showers",
    82: "Violent Showers",

    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Severe Thunderstorm",
}

# Get weather code
def weather_condition(code: int) -> str:
    return WEATHER_CODES.get(code, "Unknown")

# Loads the lgbm model
predictor = None
def get_predictor():
    global predictor

    if predictor is None:
        predictor = WeatherPredictor()

    return predictor

# ML daily risk
def get_weather_prediction(lat: float, lon: float, start_date: str = None, end_date: str = None) -> dict:
    forecast = get_forecast(lat, lon, start_date, end_date)
    features = build_features(forecast)
    predictor = get_predictor()
    predictions = predictor.predict(features)

    hourly = forecast["hourly"]

    results = [ ]
    for i, prediction in enumerate(predictions):

        day = {
            "date": features.iloc[i]["date"].strftime("%Y-%m-%d"),

            # Add weather icon and description
            "weather_code": int(features.iloc[i]["weather_code"]), # Check code in WEATHER_CODES dict
            "condition": weather_condition( 
                int(features.iloc[i]["weather_code"])
            ), # weather code description

            "temp_min": float(features.iloc[i]["temp_min"]),
            "temp_max": float(features.iloc[i]["temp_max"]),
            "rain_mm": float(features.iloc[i]["rain"]),
            "wind_speed": float(features.iloc[i]["wind"]),
            "wind_level": wind_level(features.iloc[i]["wind"]),
            "visibility_km": round(float(features.iloc[i]["visibility"]) / 1000,2),
            "sunrise": features.iloc[i]["sunrise"],
            "sunset": features.iloc[i]["sunset"],
        }

        # UV advice
        day_str = features.iloc[i]["date"].strftime("%Y-%m-%d")
        day_hours = [t for t in hourly["time"] if t.startswith(day_str)]
        day_uv = [u for u, t in zip(hourly["uv_index"], hourly["time"]) if t.startswith(day_str)]
        advice = uv_advice(day_uv, day_hours)

        day.update({
            "uv_index": float(features.iloc[i]["uv_index"]),
            "uv_level": uv_level(features.iloc[i]["uv_index"]),
            "uv_advice": advice,
        })
    
        # Add ML prediction
        day.update(prediction)

        # Flood risk
        rain_today = features.iloc[i]["rain"]
        if i < len(features) - 1:
            rain_tomorrow = features.iloc[i + 1]["rain"]
        else:
            rain_tomorrow = 0

        max_hourly_rain = features.iloc[i]["max_hourly_rain"]

        flood = flood_risk(
            heavy_rain_probability=prediction["heavy_rain_probability"],
            rain_today=rain_today,
            rain_tomorrow=rain_tomorrow,
            max_hourly_rain=max_hourly_rain
        )

        # Beach safety
        wind = features.iloc[i]["wind"]
        feels_like_temp = features.iloc[i]["feels_like_temp"]
        rain = features.iloc[i]["rain"]

        beach = beach_safety(
            heavy_rain_probability=prediction["heavy_rain_probability"],
            rain=rain,
            wind=wind,
            feels_like_temp=feels_like_temp
        )

        # Snow prob
        rain = features.iloc[i]["rain"]
        temp = features.iloc[i]["temp"]
        snowfall = features.iloc[i]["snowfall"]

        snow = snow_probability(
            rain=rain,
            snowfall=snowfall,
            temp=temp
        )

        # Temp risk
        feels_like_temp = features.iloc[i]["feels_like_temp"]
        temperature_level = temp_level(
            feels_like_temp=feels_like_temp
        )
        temperature_advice = temp_advice(
            temp_level=temperature_level
        )

        # Hiking safety
        wind = features.iloc[i]["wind"]
        visibility = features.iloc[i]["visibility"]

        hiking = hiking_safety(
            heavy_rain_probability=prediction["heavy_rain_probability"],
            wind=wind,
            visibility=visibility,
            temp_risk=temperature_level,
            snow_probability=snow["snow_probability"],
        )

        day.update(flood)
        day.update(beach)
        day.update(snow)
        day.update({
            "temperature_level": temperature_level,
            "temperature_advice": temperature_advice,
        })
        day.update(hiking)

        results.append(day)
        
    
    return results

def get_hourly_weather(lat: float, lon: float, start_date: str = None, end_date: str = None):

    forecast = get_forecast(lat, lon, start_date, end_date)
    hourly = forecast["hourly"]

    results = []
    for i in range(len(hourly["time"])):

        prob = hourly["precipitation_probability"][i]

        results.append({
            "time": hourly["time"][i],
            "temperature": hourly["temperature_2m"][i],
            "feels_like_temp": hourly["apparent_temperature"][i],
            "rain_mm": hourly["precipitation"][i],
            "rain_probability": prob,
            "weather_code": hourly["weather_code"][i],
            "condition": weather_condition(
                hourly["weather_code"][i]
            ),
            "wind_speed": hourly["wind_speed_10m"][i],
            "uv_index": hourly["uv_index"][i],
            "visibility_km": round(hourly["visibility"][i] / 1000, 2),
        })

    return results

if __name__ == "__main__":

    # result = get_weather_prediction(
    #     lat=51.5074,
    #     lon=-0.1278
    # )

    result = get_hourly_weather(
        lat=51.5074,
        lon=-0.1278
    )

    print(result)
