"""
STUB — Fetch historical daily weather data from Open-Meteo for multiple European cities.

Run: python ml/scripts/fetch_data.py
"""
import requests
import time
import pandas as pd
from pathlib import Path

YEAR_RANGES = [
    (2015, 2020),
    (2021, 2025),
]

CITIES = {
    "London": (51.5074, -0.1278),
    "Paris": (48.8566, 2.3522),
    "Rome": (41.9028, 12.4964),
    "Florence": (43.7696, 11.2558),
    "Venice": (45.4408, 12.3155),
    "Milan": (45.4642, 9.1900),
    "Barcelona": (41.3851, 2.1734),
    "Madrid": (40.4168, -3.7038),
    "Istanbul": (41.0082, 28.9784),
    "Berlin": (52.5200, 13.4050),
    "Munich": (48.1351, 11.5820),
    "Prague": (50.0755, 14.4378),
    "Edinburgh": (55.9533, -3.1883),
    "Copenhagen": (55.6761, 12.5683),
    "Brussels": (50.8503, 4.3517),
    "Bruges": (51.2093, 3.2247),
    "Budapest": (47.4979, 19.0402),
    "Krakow": (50.0647, 19.9450),
    "Vienna": (48.2082, 16.3738),
    "Amsterdam": (52.3676, 4.9041),
    "Lisbon": (38.7223, -9.1393),
    "Athens": (37.9838, 23.7275),
    "Dublin": (53.3498, -6.2603),
    "Oslo": (59.9139, 10.7522),
    "Zurich": (47.3769, 8.5417),
}

def fetch_city(city: str, lat: float, lon: float, start_year: int=2015, end_year: int=2025):
    all_data = []
    
    for start_year, end_year in YEAR_RANGES:
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

        for attempt in range(5):
            response = requests.get(url, timeout=60)

            if response.status_code == 200: #incase it fail to get data
                break

            if response.status_code == 429:
                wait = 20 * (attempt + 1)
                print(f"Rate limit reached. Waiting {wait} seconds...")
                time.sleep(wait)
            else:
                response.raise_for_status()
        else:
            raise Exception("Failed after multiple retries.")

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

        all_data.append(daily_df)

        print(f"{city}: {start_year}-{end_year} downloaded")

        time.sleep(2)

    # Concat all data
    daily_df = pd.concat(all_data, ignore_index=True)

    # Add city column
    daily_df["city"] = city

    # Reoder the column
    daily_df = daily_df[
        [
            "date",
            "city",
            "rain",
            "temp",
            "temp_max",
            "temp_min",
            "humidity",
            "dew_point",
            "pressure",
            "wind",
            "wind_dir",
            "radiation",
        ]
    ]

    # Convert date back to datetime
    daily_df["date"] = pd.to_datetime(daily_df["date"])

    # Remove missing rows
    daily_df = daily_df.dropna()

    print(f"{city}:")
    print(daily_df.head())
    
    # Save CSV
    output_dir = Path("ml/data/raw")
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = city.lower().replace(" ", "_") + "_weather.csv"
    daily_df.to_csv(output_dir / filename, index=False)

    print(f"{city} saved ({len(daily_df)} rows)")

    return daily_df

# Loop through all cities
def main():

    for i, (city, (lat, lon)) in enumerate(CITIES.items(), start=1):
        print(f"[{i}/{len(CITIES)}] Downloading {city}...")

        try:
            fetch_city(city, lat, lon, )

        except Exception as e:
            print(f"Failed to fetch {city}: {e}")


if __name__ == "__main__":
    main()