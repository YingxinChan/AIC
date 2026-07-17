# Run: python -m ml.predictor

import pandas as pd
import json
from lightgbm import Booster
from pathlib import Path
from services.openmeteo import get_forecast
from services.feature_builder import build_features

MODEL_DIR = Path(__file__).parent / "models"

class WeatherPredictor:

    def __init__(self):
        # Load trained model
        self.model = Booster(
            model_file=str(MODEL_DIR / "lgbm_heavy_rain.txt")
        )
        
        with open(MODEL_DIR / "feature_names.json", "r") as f:
            self.selected_features = json.load(f)

        # Load best threshold
        with open(MODEL_DIR / "model_config.json", "r") as f:
            config = json.load(f)

        self.threshold = config["threshold"]

    def predict(self, weather_features):
        # Create one-row DataFrame
        features_df = weather_features.copy()

        # Get date before drop column
        dates = features_df["date"].copy()

        # Ensure feature order matches training
        features_df = features_df[self.selected_features]

        # Predict probabilities
        probabilities = self.model.predict(features_df)

        # Put all probs in each day in dictionary
        results = []
        for i, probability in enumerate(probabilities):
            
            warning = probability >= self.threshold

            results.append({
                "heavy_rain_probability": round(float(probability) * 100, 2),
                "heavy_rain_warning": bool(warning)
            })

        # Check for missing features
        missing = [
            f for f in self.selected_features
            if f not in features_df.columns
        ]
        if missing:
            raise ValueError(
                f"Missing features: {missing}"
            )

        return results


if __name__ == "__main__":

    # Get forecasted weature date
    forecast = get_forecast(
        lat=51.5074,
        lon=-0.1278
    )

    # Build features for forecasted data 
    features = build_features(forecast)
    
    predictor = WeatherPredictor()

    result = predictor.predict(features)

    print(result)
    print(features.head())