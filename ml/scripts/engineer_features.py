"""
Run: python ml/scripts/engineer_features.py
"""
import pandas as pd
import numpy as np
from pathlib import Path

CITY_COORDS = {
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

def engineer_features(raw_dir: Path, output_path: Path):
    # Put all cities into one data frame
    all_data = []
    for file in raw_dir.glob("*_weather.csv"):
        city_df = pd.read_csv(file)
        city_df["date"] = pd.to_datetime(city_df["date"])
        all_data.append(city_df)

    df = pd.concat(all_data, ignore_index=True)

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["city", "date"]).reset_index(drop=True)

    # Cyclic day-of-year features (to teach model that time is cyclical)
    # A smarter way of telling the model what season it is
    df["day_of_year"] = df["date"].dt.dayofyear
    df["day_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365)
    df["day_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365)

    # Month for seasonal pattern
    df["month"] = df["date"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df = df.drop(columns=["month"])

    df["latitude"] = df["city"].map(lambda x: CITY_COORDS[x][0])
    df["longitude"] = df["city"].map(lambda x: CITY_COORDS[x][1])


    # Future rainfall targets
    for day in range(1, 8):
        df[f"rain_day{day}"] = (
            df.groupby("city")["rain"]
            .shift(-day)
        )

    # Encode wind direction cyclically
    radians = np.radians(df["wind_dir"])
    df["wind_dir_sin"] = np.sin(radians)
    df["wind_dir_cos"] = np.cos(radians)

    # Temp range
    df["temp_range"] = df["temp_max"] - df["temp_min"]

    # Clean
    df = df.dropna()

    # Reorder columns
    ordered_columns = [
        "date",
        "city",
        "latitude",
        "longitude",

        "day_sin",
        "day_cos",
        "month_sin",
        "month_cos",

        "rain",
        "temp",
        "temp_max",
        "temp_min",
        "temp_range",

        "humidity",
        "pressure",
        "wind",
        "wind_dir_cos",
        "wind_dir_sin",
        "radiation",

        "rain_day1",
        "rain_day2",
        "rain_day3",
        "rain_day4",
        "rain_day5",
        "rain_day6",
        "rain_day7",
    ]
    df = df[ordered_columns]

    print(df.info())

    # Save csv
    df.to_csv(output_path, index=False) 
    print(f"Saved processed data to {output_path}")

    return df
    

if __name__ == "__main__":
    base = Path(__file__).resolve().parents[1]

    raw_dir = raw_dir = base / "data" / "raw"
    output_path = base / "data" / "processed" / "weather_features.csv"

    engineer_features(raw_dir, output_path)
