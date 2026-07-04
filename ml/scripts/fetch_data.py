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

def fetch_nasa_power(lat: float, lon: float, start_year: int, end_year: int):
    start = f"{start_year}0101"
    end = f"{end_year}1231"

    # Features we get from NASA
    parameters = ",".join([
    "PRECTOTCORR", # Rain
    "T2M", # Temp
    "T2M_MAX", # Temp max
    "T2M_MIN", # Temp min
    "T2MDEW", # Dew point temp (temp at which air becomes saturated)
    "WS2M", # Wind speed
    "U2M",  # Zonal wind (west-east)
    "V2M",  # Meridional wind (south-north)
    "RH2M", # Relative humidity
    "QV2M", # Specific humidity
    "PS", # Surface pressure
    "ALLSKY_SFC_LW_DWN", # longwave radiation
    ])

    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters={parameters}"
        f"&community=RE"
        f"&longitude={lon}"
        f"&latitude={lat}"
        f"&start={start}"
        f"&end={end}"
        f"&format=JSON"
    )

    response = requests.get(url)
    if response.status_code != 200: #incase it fail to get data
        raise Exception(f"Request failed with status code {response.status_code}")
    
    data = response.json()["properties"]["parameter"]

    mapping = {
        "PRECTOTCORR": "rain",
        "T2M": "temp",
        "T2M_MAX": "temp_max",
        "T2M_MIN": "temp_min",
        "T2MDEW": "dew_point",
        "WS2M": "wind",
        "U2M": "wind_u",
        "V2M": "wind_v",
        "RH2M": "humidity",
        "QV2M": "specific_humidity",
        "PS": "pressure",
        "ALLSKY_SFC_LW_DWN": "longwave_radiation",
    }

    # Create dataframe
    df = pd.DataFrame({
        "date": list(data["PRECTOTCORR"].keys())
    })

    for nasa_name, col_name in mapping.items():
        df[col_name] = list(data[nasa_name].values())

    df["date"] = pd.to_datetime(df["date"], format="%Y%m%d")

    # Clean missing data
    df = df.replace(-999, pd.NA)
    df = df.dropna()

    print(df.columns)
    
    from pathlib import Path

    # Save CSV
    base = Path(__file__).resolve().parents[1] # Project's ml folder
    output_path = base / "data" / "raw" / "london_weather.csv" # File location
    df.to_csv(output_path, index=False)

    print(f"Saved weather data to {output_path}")

    return df

def fetch_owm_historical(lat: float, lon: float, start_year: int, end_year: int):
    # STUB
    raise NotImplementedError("fetch_owm_historical not yet implemented")

if __name__ == "__main__":
    df = fetch_nasa_power(
        lat=51.5074,
        lon=-0.1278,
        start_year=2001,
        end_year=2025
    )
