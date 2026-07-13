# To get forecasted data from Open-Meteo
# Run python services/openmeteo.py
import requests

def get_forecast(lat: float, lon: float):

    # Hourly forecasted variables
    hourly = ",".join([
        "pressure_msl",
        "shortwave_radiation",
        "precipitation",
        "temperature_2m",
        "weather_code"
    ])

    # Daily forecasted variables
    daily = ",".join([
        "weather_code",
        "precipitation_sum",
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "wind_speed_10m_max",
        "wind_direction_10m_dominant",
        "relative_humidity_2m_mean"
    ])

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}"
        f"&longitude={lon}"
        f"&hourly={hourly}"
        f"&daily={daily}"
        f"&timezone=GMT"
    )

    response = requests.get(url)
    if response.status_code != 200: #incase it fail to get data
        raise Exception(f"Request failed with status code {response.status_code}")


    # Create dataframe
    hourly_data = response.json()["hourly"]
    daily_data = response.json()["daily"]

    return {
        "hourly": hourly_data,
        "daily": daily_data
    }

if __name__ == "__main__":
    forecast = get_forecast(
        lat=51.5074,
        lon=-0.1278
    )
    print(forecast)