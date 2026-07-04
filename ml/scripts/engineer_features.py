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

    # Wind physics features
    df["wind_speed_uv"] = (df["wind_u"]**2 + df["wind_v"]**2) ** 0.5
        # wind speed - formula: Pythagoean theorem
    df["wind_dir"] = np.arctan2(df["wind_v"], df["wind_u"])
        # wind direction - formula: vector geometry to find angle zeta

    # Atmospheric change features
    df["pressure_change_1"] = df["pressure"] - df["pressure"].shift(1)
    df["temp_change_1"] = df["temp"] - df["temp"].shift(1)
    df["humidity_change_1"] = df["humidity"] - df["humidity"].shift(1)

    # Moisture physics
    df["dew_temp_gap"] = df["temp"] - df["dew_point"]
        # Small gap means more likely to rain
    df["humidity_temp_interaction"] = df["humidity"] * df["temp"]
        # Indicate warm moist air, tropical conditions which favour rainfall.

    # Create lag
    weather_columns = [
    "rain",
    "temp",
    "temp_max",
    "temp_min",
    "temp_change_1",
    "dew_point",
    "dew_temp_gap",
    "wind",
    "wind_u",
    "wind_v",
    "wind_speed_uv",
    "wind_dir",
    "humidity",
    "specific_humidity",
    "humidity_change_1",
    "pressure",
    "pressure_change_1",
    "longwave_radiation"
    ]

    for column in weather_columns:
        for lag in [1, 3, 7]:
            df[f"{column}_lag_{lag}"] = df[column].shift(lag)

    # Rolling features (to avoid leakage)
    df["rain_roll_mean_7"] = df["rain"].shift(1).rolling(7).mean()
        # Average rainfall over the previous seven days not include today
    df["pressure_roll_std_7"] = df["pressure"].shift(1).rolling(7).std()
        # measurehow unstable pressure has been during the previous wee
        # low std = stable weather

    # Clean
    df = df.dropna()

    # Date
    date_cols = [
        "date",
        "day_sin",
        "day_cos",
    ]

    # Rain
    rain_cols = [
        "rain",
        "rain_lag_1",
        "rain_lag_3",
        "rain_lag_7",
        "rain_roll_mean_7",
    ]

    # Temp
    temp_cols = [
        "temp",
        "temp_lag_1",
        "temp_lag_3",
        "temp_lag_7",

        "temp_max",
        "temp_max_lag_1",
        "temp_max_lag_3",
        "temp_max_lag_7",

        "temp_min",
        "temp_min_lag_1",
        "temp_min_lag_3",
        "temp_min_lag_7",

        "temp_change_1",
        "temp_change_1_lag_1",
        "temp_change_1_lag_3",
        "temp_change_1_lag_7",

        "dew_point",
        "dew_point_lag_1",
        "dew_point_lag_3",
        "dew_point_lag_7",

        "dew_temp_gap",
        "dew_temp_gap_lag_1",
        "dew_temp_gap_lag_3",
        "dew_temp_gap_lag_7",
    ]

    # Wind
    wind_cols = [
        "wind",
        "wind_lag_1",
        "wind_lag_3",
        "wind_lag_7",

        "wind_u",
        "wind_u_lag_1",
        "wind_u_lag_3",
        "wind_u_lag_7",

        "wind_v",
        "wind_v_lag_1",
        "wind_v_lag_3",
        "wind_v_lag_7",

        "wind_speed_uv",
        "wind_speed_uv_lag_1",
        "wind_speed_uv_lag_3",
        "wind_speed_uv_lag_7",

        "wind_dir",
        "wind_dir_lag_1",
        "wind_dir_lag_3",
        "wind_dir_lag_7",
    ]

    # Humidity
    humidity_cols = [
        "humidity",
        "humidity_lag_1",
        "humidity_lag_3",
        "humidity_lag_7",

        "specific_humidity",
        "specific_humidity_lag_1",
        "specific_humidity_lag_3",
        "specific_humidity_lag_7",

        "humidity_change_1",
        "humidity_change_1_lag_1",
        "humidity_change_1_lag_3",
        "humidity_change_1_lag_7",

        "humidity_temp_interaction",
    ]

    # Pressure
    pressure_cols = [
        "pressure",
        "pressure_lag_1",
        "pressure_lag_3",
        "pressure_lag_7",

        "pressure_change_1",
        "pressure_change_1_lag_1",
        "pressure_change_1_lag_3",
        "pressure_change_1_lag_7",

        "pressure_roll_std_7",
    ]

    # Radiation
    radiation_cols = [
        "longwave_radiation",
        "longwave_radiation_lag_1",
        "longwave_radiation_lag_3",
        "longwave_radiation_lag_7",
    ]

    # Reorder columns
    ordered_columns = (
        date_cols
        + rain_cols
        + temp_cols
        + wind_cols
        + humidity_cols
        + pressure_cols
        + radiation_cols
    )
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
