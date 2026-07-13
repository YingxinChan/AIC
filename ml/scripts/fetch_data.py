"""
STUB — Fetch historical weather data from NASA POWER and OpenWeatherMap.

When implemented:
  1. Pull NASA POWER daily data for London (lat=51.5074, lon=-0.1278) for the past 5+ years
  2. Pull OWM historical data for the same period
  3. Save raw CSVs to ml/data/raw/

Run: python ml/scripts/fetch_data.py
"""
import requests
import numpy as np
import pandas as pd
from pathlib import Path

def fetch_open_meteo(lat: float, lon: float, start_year: int, end_year: int):
    start = f"{start_year}-01-01"
    end = f"{end_year}-12-31"

    # Hourly variables from Open-Meteo
    hourly = ",".join([
        "precipitation",
        "temperature_2m",
        "dew_point_2m",
        "relative_humidity_2m",
        "surface_pressure",
        "wind_speed_10m",
        "wind_direction_10m",
        "shortwave_radiation",
    ])

    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}"
        f"&longitude={lon}"
        f"&start_date={start}"
        f"&end_date={end}"
        f"&hourly={hourly}"
        f"&timezone=GMT"
    )

    response = requests.get(url)
    if response.status_code != 200: #incase it fail to get data
        raise Exception(f"Request failed with status code {response.status_code}")


    # Create dataframe
    data = response.json()["hourly"]

    # Hourly dataframe
    hourly_df = pd.DataFrame({
        "datetime": data["time"],
        "rain": data["precipitation"],
        "temp": data["temperature_2m"],
        "humidity": data["relative_humidity_2m"],
        "dew_point": data["dew_point_2m"],
        "pressure": data["surface_pressure"],
        "wind": data["wind_speed_10m"],
        "wind_dir": data["wind_direction_10m"],
        "radiation": data["shortwave_radiation"],
    })

    hourly_df["datetime"] = pd.to_datetime(hourly_df["datetime"])
    hourly_df["date"] = hourly_df["datetime"].dt.date

    # Daily dataframe
    daily_df = (
        hourly_df
        .groupby("date")
        .agg({
            "rain": "sum",
            "temp": "mean",
            "humidity": "mean",
            "dew_point": "mean",
            "pressure": "mean",
            "wind": "mean",
            "wind_dir": "mean",
            "radiation": "sum",
        })
        .reset_index()
    )

    temp_stats = (
        hourly_df
        .groupby("date")["temp"]
        .agg(["max", "min"])
        .reset_index()
    )

    temp_stats.columns = [
        "date",
        "temp_max",
        "temp_min"
    ]

    # Merge temperature statistics
    daily_df = daily_df.merge(temp_stats, on="date")

    # Convert date back to datetime
    daily_df["date"] = pd.to_datetime(daily_df["date"])

    # Remove missing rows
    daily_df = daily_df.dropna()

    print(daily_df.head())
    
    # Save CSV
    base = Path(__file__).resolve().parents[1] # Project's ml folder
    output_path = base / "data" / "raw" / "london_weather.csv" # File location
    daily_df.to_csv(output_path, index=False)

    print(f"Saved weather data to {output_path}")

    return daily_df

if __name__ == "__main__":
    df = fetch_open_meteo(
        lat=51.5074,
        lon=-0.1278,
        start_year=2001,
        end_year=2025
    )
