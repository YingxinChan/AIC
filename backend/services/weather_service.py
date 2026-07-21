# Run: python -m services.weather_service

from services.openmeteo import get_forecast
from services.feature_builder import build_features
from ml.predictor import WeatherPredictor
from ml.risk_calculator import flood_risk, beach_safety, snow_probability

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
        }
        
        # Add ML prediction
        day.update(prediction)

        # Flood risk
        rain_today = features.iloc[i]["rain"]
        if i < len(features) - 1:
            rain_tomorrow = features.iloc[i + 1]["rain"]
        else:
            rain_tomorrow = 0

        flood = flood_risk(
            heavy_rain_probability=prediction["heavy_rain_probability"],
            rain_today=rain_today,
            rain_tomorrow=rain_tomorrow
        )

        # Beach safety
        wind = features.iloc[i]["wind"]
        temp = features.iloc[i]["temp"]

        beach = beach_safety(
            heavy_rain_probability=prediction["heavy_rain_probability"],
            wind=wind,
            temp=temp
        )

        # Heavy snow
        rain = features.iloc[i]["rain"]
        temp = features.iloc[i]["temp"]

        snow = snow_probability(
            rain=rain,
            temp=temp
        )

        day.update(flood)
        day.update(beach)
        day.update(snow)

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
            "rain_mm": hourly["precipitation"][i],
            "rain_probability": prob,
            "weather_code": hourly["weather_code"][i],
            "condition": weather_condition(
                hourly["weather_code"][i]
            )
        })

    return results
    

if __name__ == "__main__":

    result = get_hourly_weather(
        lat=51.5074,
        lon=-0.1278
    )

    print(result)
