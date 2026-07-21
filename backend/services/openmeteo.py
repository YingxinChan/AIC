import requests
from datetime import datetime, timedelta

def get_forecast(lat: float, lon: float, start_date: str = None, end_date: str = None):
    # If no start_date is provided, default to today
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")

    # If no end_date is provided, calculate it based on the start date
    if not end_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_date = (start_dt + timedelta(days=7)).strftime("%Y-%m-%d")

    # Hourly forecasted variables
    hourly = ",".join([
        "pressure_msl",
        "shortwave_radiation",
        "precipitation",
        "precipitation_probability",
        "temperature_2m",
        "weather_code"
    ])

    # Daily forecasted variables
    daily = ",".join(["weather_code", "precipitation_sum", "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", "wind_speed_10m_mean", "wind_direction_10m_dominant", "relative_humidity_2m_mean"])

    # Build the URL with the date parameters
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}"
        f"&longitude={lon}"
        f"&hourly={hourly}"
        f"&daily={daily}"
        f"&start_date={start_date}"
        f"&end_date={end_date}"
        f"&timezone=GMT"
    )

    response = requests.get(url)
    if response.status_code != 200:
        raise Exception(f"Request failed with status code {response.status_code}")

    data = response.json()
    return {
        "latitude": lat,
        "longitude": lon,
        "hourly": data["hourly"],
        "daily": data["daily"]
    }