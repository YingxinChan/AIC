"""
STUB — Engineer lag features from raw weather data.

When implemented:
  - Load raw CSVs from ml/data/raw/
  - Create 1-day, 3-day, 7-day lag features for rain, temperature, humidity
  - DROP same-day rain indicators to prevent data leakage
  - 80:20 train/test split
  - Save to ml/data/processed/

Run: python ml/scripts/engineer_features.py
"""

def engineer_features(raw_path: str, output_path: str):
    # STUB
    raise NotImplementedError("engineer_features not yet implemented")

if __name__ == "__main__":
    print("engineer_features.py: STUB — not yet implemented")
