"""
STUB — Engineer lag features from raw weather data.

When implemented:
  - Load raw CSVs from ml/data/raw/
  - Create 1-day, 3-day, 7-day lag features for rain, temperature, humidity
  - DROP same-day rain indicators to prevent data leakage -- move to do it in taining
  - 80:20 train/test split -- move to do it in training
  - Create flash_storm target (95th percentile) -- move to do in train_lgbm
  - Save to ml/data/processed/

Run: python ml/scripts/engineer_features.py
"""
import pandas as pd
import numpy as np
from pathlib import Path

def engineer_features(raw_path: Path, output_path: Path):
    df = pd.read_csv(raw_path)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    # Cyclic day-of-year features (to teach model that time is cyclical)
    # A smarter way of telling the model what season it is
    df["day_of_year"] = df["date"].dt.dayofyear
    df["day_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365)
    df["day_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365)


    # Future rainfall targets
    for day in range(1, 8):
        df[f"rain_day{day}"] = df["rain"].shift(-day)

    # Encode wind direction cyclically
    radians = np.radians(df["wind_dir"])
    df["wind_dir_sin"] = np.sin(radians)
    df["wind_dir_cos"] = np.cos(radians)

    # Clean
    df = df.dropna()

    # Reorder columns
    ordered_columns = [
        "date",
        "day_sin",
        "day_cos",

        "rain",
        "temp",
        "temp_max",
        "temp_min",

        "humidity",
        "pressure",
        "wind",
        "wind_dir_cos",
        "wind_dir_sin",
        "radiation",

        "rain_day1",
    ]
    df = df[ordered_columns]

    print(df.info())

    # Save csv
    df.to_csv(output_path, index=False) 
    print(f"Saved processed data to {output_path}")

    return df
    

if __name__ == "__main__":
    base = Path(__file__).resolve().parents[1]

    raw_path = base / "data" / "raw" / "london_weather.csv"
    output_path = base / "data" / "processed" / "weather_features.csv"

    engineer_features(raw_path, output_path)
