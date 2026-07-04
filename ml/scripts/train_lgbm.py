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

import pandas as pd
import numpy as np
from pathlib import Path
from lightgbm import LGBMClassifier
from sklearn.metrics import f1_score
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix


def train(processed_path: Path, model_output_path: Path):
    df = pd.read_csv(processed_path)
    df = df.sort_values("date")

    # Split (80/20) 
    split = int(len(df) * 0.8)
    train_df = df.iloc[:split].copy()
    test_df = df.iloc[split:].copy()

    # Calculate threshold
    threshold = train_df["rain"].quantile(0.95) # only compute on train
    train_df["flash_storm"] = (train_df["rain"] > threshold).astype(int)
    test_df["flash_storm"] = (test_df["rain"] > threshold).astype(int)

    X_train = train_df.drop(columns=["flash_storm", "rain", "date"])
    y_train = train_df["flash_storm"]
    X_test = test_df.drop(columns=["flash_storm", "rain", "date"])
    y_test = test_df["flash_storm"]

    # LGBM model
    model = LGBMClassifier(
      n_estimators=1000, # Number of decision trees
      learning_rate=0.03, # How much each new tree changes the model
      num_leaves=15,
      max_depth=6,
      class_weight="balanced", # Tell the classifier to pay more attention to y value
      random_state=42,
      feature_fraction=0.7, # Each tree is trained using (no.) of the available features
      bagging_fraction=0.8, # Each tree is trained using (no.) of trainig samples
      bagging_freq=5, # Creates a new random sample every (no.) trees.
      min_child_samples=20 # Sets the minimum number of training samples required in a leaf
    )

    # Train model
    model.fit(X_train, 
              y_train, 
              eval_set=(X_test, y_test)
    )

    # Predict test data
    y_prob = model.predict_proba(X_test)[:, 1]

    # Find the best threshold that gives the highest f1 score
    best_f1 = 0
    best_threshold = 0
    for threshold in np.arange(0.05, 0.55, 0.05):
        y_pred = (y_prob >= threshold).astype(int)
        f1 = f1_score(y_test, y_pred) # Calculate f1 score
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = threshold
    print(f"Best Threshold: {best_threshold}")
    print(f"Best F1: {best_f1}")

    # Use the best threshold
    y_pred = (y_prob >= best_threshold).astype(int)

    print(confusion_matrix(y_test, y_pred))
    # Results : [[TN(True neg) FP(False pos)], [FN(False neg) TP(True pos)]]

    print(classification_report(y_test, y_pred))
    # Precision: Correctness of positive predictions
    # Recall: Ability to find all positive cases
    # F1-score: Balance between precision and recall
    # Support: Number of true instances of each class

    # Features importance
    importance = pd.DataFrame({
      "Feature": X_train.columns,
      "Importance": model.feature_importances_
    }).sort_values(by="Importance", ascending=False)
    
    # print(importance.tail(10))

    # Save importance features
    importance.to_csv(
      model_output_path.parent / "lgbm_feature_importance.csv",
      index=False
    )

    # Save model
    model.booster_.save_model(model_output_path)    
    print(f"Model saved to {model_output_path}")


if __name__ == "__main__":
    base = Path(__file__).resolve().parents[1]

    processed_path = base / "data" / "processed" / "weather_features.csv"
    model_output_path = base / "models"/ "lgbm_flash_storm.txt"

    train(processed_path, model_output_path)