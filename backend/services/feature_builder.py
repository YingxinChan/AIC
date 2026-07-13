# To make features for forecasted data 
# Run: python services/feature_builder.py

import pandas as pd
import numpy as np


def build_features(forecast):

    daily = forecast["daily"]

    df = pd.DataFrame({
        "date": daily["time"],
        "weather_code": daily["weather_code"],
        "rain": daily["precipitation_sum"],
        "temp": daily["temperature_2m_mean"],
        "temp_max": daily["temperature_2m_max"],
        "temp_min": daily["temperature_2m_min"],
        "humidity": daily["relative_humidity_2m_mean"],
        "wind": daily["wind_speed_10m_max"],
        "wind_dir": daily["wind_direction_10m_dominant"],
    })

    hourly = forecast["hourly"]

    hourly_df = pd.DataFrame({
        "time": hourly["time"],
        "pressure": hourly["pressure_msl"],
        "radiation": hourly["shortwave_radiation"],
    })

    hourly_df["time"] = pd.to_datetime(hourly_df["time"])
    hourly_df["date"] = hourly_df["time"].dt.normalize()

    daily_hourly = (
        hourly_df
        .groupby("date")
        .agg({
            "pressure": "mean",
            "radiation": "mean"
        })
        .reset_index()
    )

    df["date"] = pd.to_datetime(df["date"])
    df["day_of_year"] = pd.to_datetime(df["date"]).dt.dayofyear
    df["day_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365)
    df["day_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365)

    df = df.merge(
        daily_hourly,
        on="date",
        how="left"
    )

    return df

if __name__ == "__main__":
    from openmeteo import get_forecast

    forecast = get_forecast(
        lat=51.5074,
        lon=-0.1278
    )

    df = build_features(forecast)

    print(df.head())
    print(forecast["daily"]["weather_code"])