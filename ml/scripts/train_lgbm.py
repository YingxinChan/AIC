"""
STUB — Stage 2: Train LightGBM Classifier for flash storm detection.

Target: F1 ≈ 0.752 (literature baseline — report actual achieved score honestly).
Output: ml/models/lgbm_flash_storm.txt

When implemented:
  - Load processed features from ml/data/processed/
  - Train LightGBM Classifier
  - Evaluate F1 on test split
  - Save model to ml/models/lgbm_flash_storm.txt
  - Copy artifact to backend/ml/ when ready

Run: python ml/scripts/train_lgbm.py
"""

def train(processed_path: str, model_output_path: str):
    # STUB
    raise NotImplementedError("LightGBM training not yet implemented")

if __name__ == "__main__":
    print("train_lgbm.py: STUB — not yet implemented")
