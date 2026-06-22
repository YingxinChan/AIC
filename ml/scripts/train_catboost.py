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

def train(processed_path: str, model_output_path: str):
    # STUB
    raise NotImplementedError("CatBoost training not yet implemented")

if __name__ == "__main__":
    print("train_catboost.py: STUB — not yet implemented")
