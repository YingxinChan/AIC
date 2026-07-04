"""
STUB — Stage 1: Train CatBoost Regressor for rain volume prediction.

Target: R² ≈ 0.837 (literature baseline — report actual achieved score honestly).
Output: ml/models/catboost_rain_volume.cbm

When implemented:
  - Load processed features from ml/data/processed/
  - Train CatBoost Regressor
  - Evaluate R² on test split
  - Save model to ml/models/catboost_rain_volume.cbm
  - Copy artifact to backend/ml/ when ready

Run: python ml/scripts/train_catboost.py
"""
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.metrics import r2_score
from pathlib import Path

def train(processed_path: Path, model_output_path: Path):
    df = pd.read_csv(processed_path)
    df = df.sort_values("date")

    # Split (80/20)
    split = int(len(df) * 0.8)
    train_df = df.iloc[:split]
    test_df = df.iloc[split:]

    X_train = train_df.drop(columns=["rain", "date", "wind_lag_3", "dew_point_lag_7"])
    y_train = train_df["rain"]
    X_test = test_df.drop(columns=["rain", "date", "wind_lag_3","dew_point_lag_7"])
    y_test = test_df["rain"]

    # Catboost model
    model = CatBoostRegressor(
      iterations=2000, # Number of boosting trees
      learning_rate=0.02, # Shrinks the contribution of each tree for more gradual learning
      depth=6, # To control model complexity 
      l2_leaf_reg=5,
      loss_function="RMSE", # model tries to minimize
      eval_metric="RMSE",
      random_seed=42,
      verbose=100 # print progress every 100 iterations
    )

    # Train model
    model.fit(X_train, 
              y_train, 
              eval_set=(X_test, y_test), 
              use_best_model=True
    )

    # Predict test data
    y_pred = model.predict(X_test)

    # Calculate R² score
    score = r2_score(y_test, y_pred)
    print(f"R² Score: {score:.3f}")

    # Feature importance (tells how much each features imapct the model)
    importance = pd.DataFrame({
      "Feature": X_train.columns,
      "Importance": model.feature_importances_
    }).sort_values(by="Importance", ascending=False)
    print(importance.tail(15))

    # Save importance features
    importance.to_csv(
      model_output_path.parent / "catboost_feature_importance.csv",
      index=False
    )

    # Save model
    model.save_model(model_output_path)
    print(f"Model saved to {model_output_path}")



if __name__ == "__main__":
    base = Path(__file__).resolve().parents[1]

    processed_path = base / "data" / "processed" / "weather_features.csv"
    model_output_path = base / "models"/ "catboost_rain_volume.cbm"

    train(processed_path, model_output_path)
