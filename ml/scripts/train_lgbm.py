"""
Run: python ml/scripts/train_lgbm.py
"""

import pandas as pd
import numpy as np
import json
import shap
import matplotlib.pyplot as plt
from pathlib import Path
from lightgbm import LGBMClassifier
from sklearn.metrics import f1_score
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix
from lightgbm import early_stopping


def train(processed_path: Path, model_output_path: Path):
    df = pd.read_csv(processed_path)
    df = df.sort_values(["city", "date"]).reset_index(drop=True)

    # Chronological split according to date (64% train / 16% validation / 20% test)
    df["date"] = pd.to_datetime(df["date"])
    train_df = df[df["date"] < "2022-01-01"].copy()
    val_df = df[
        (df["date"] >= "2022-01-01") &
        (df["date"] < "2024-01-01")
    ].copy()
    test_df = df[df["date"] >= "2024-01-01"].copy()

    selected_features = [
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

    ]


    # Heavy rain risk threshold (80th percentile)
    threshold = train_df["rain_day1"].quantile(0.80)

    train_df.loc[:, "heavy_rain_day1"] = (
        train_df["rain_day1"] >= threshold
    ).astype(int)

    val_df.loc[:, "heavy_rain_day1"] = (
        val_df["rain_day1"] >= threshold
    ).astype(int)

    test_df.loc[:, "heavy_rain_day1"] = (
        test_df["rain_day1"] >= threshold
    ).astype(int)

    X_train =  train_df[selected_features]
    y_train = train_df["heavy_rain_day1"]

    X_val =  val_df[selected_features]
    y_val = val_df["heavy_rain_day1"]

    X_test =  test_df[selected_features]
    y_test = test_df["heavy_rain_day1"]

    # LGBM model
    model = LGBMClassifier(
      n_estimators=1500, # Number of decision trees
      learning_rate=0.02, # How much each new tree changes the model
      num_leaves=31,
      max_depth=-1,
      class_weight="balanced", # Tell the classifier to pay more attention to y value
      random_state=42,
      colsample_bytree=0.8, # Each tree is trained using (no.) of the available features
      subsample=0.8, # Each tree is trained using (no.) of trainig samples
      subsample_freq=5, # Creates a new random sample every (no.) trees.
      reg_alpha=0.5,
      reg_lambda=1.0,
    )

    # Train model
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[
            early_stopping(100)
        ]
    )

    # Find best threshold
    # y_prob_val = model.predict_proba(X_val)[:, 1]
    # best_f1 = 0
    # best_threshold = 0
    # for threshold in np.arange(0.1, 0.91, 0.05):
    #     y_pred = (y_prob_val >= threshold).astype(int)

    #     f1 = f1_score(y_val, y_pred)

    #     if f1 > best_f1:
    #         best_f1 = f1
    #         best_threshold = threshold

    # print(f"Best Threshold: {best_threshold:.2f}")
    # print(f"Validation F1: {best_f1:.3f}")

    # Fixed threshold selected after empirical threshold sweep
    # (approximately optimal validation F1 ≈ 0.502)
    best_threshold = 0.50

    # Save best threshold
    config = {
        "threshold": float(best_threshold)
    }
    with open(model_output_path.parent / "model_config.json", "w") as f:
        json.dump(config, f, indent=4)

    # Predict on the test set
    y_prob_test = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob_test >= best_threshold).astype(int)

    f1 = f1_score(y_test, y_pred)
    print(f"F1 score: {f1}")

    print(confusion_matrix(y_test, y_pred))
    # Results : [[TN(True neg) FP(False pos)], [FN(False neg) TP(True pos)]]

    report = classification_report(
        y_test,
        y_pred,
        output_dict=True
    )
    # Save classification_report
    pd.DataFrame(report).to_csv(
        model_output_path.parent / "classification_report.csv"
    )
    print(report)
    # Precision: Correctness of positive predictions
    # Recall: Ability to find all positive cases
    # F1-score: Balance between precision and recall
    # Support: Number of true instances of each class

    # SHAP
    explainer = shap.TreeExplainer(model)
    X_sample = X_test.sample(
        min(1000, len(X_test)),
        random_state=42
    )
    shap_values = explainer(
        X_sample,
        check_additivity=False
    )

    # SHAP beeswarm plot 
    shap.plots.beeswarm(
        shap_values,
        show=False
    )
    fig = plt.gcf()
    fig.savefig(
        model_output_path.parent / "shap_beeswarm.png",
        dpi=300,
        bbox_inches="tight"
    )
    plt.close(fig)
    print("Beesworm plot saved")

    # SHAP bar plot
    plt.figure(figsize=(10, 6))
    shap.plots.bar(
        shap_values,
        show=False
    )
    fig = plt.gcf()
    fig.savefig(
        model_output_path.parent / "shap_bar.png",
        dpi=300,
        bbox_inches="tight"
    )
    plt.close(fig)
    print("Bar plot saved")

    # SHAP waterfall plot
    shap.plots.waterfall(
        shap_values[0],
        show=False
    )
    fig = plt.gcf()
    fig.savefig(
        model_output_path.parent / "shap_waterfall.png",
        dpi=300,
        bbox_inches="tight"
    )
    plt.close(fig)
    print("Waterfall plot saved")

    # Features importance
    importance = pd.DataFrame({
      "Feature": X_train.columns,
      "Importance": model.feature_importances_
    }).sort_values(by="Importance", ascending=False)

    print(importance.head(20))

    # Save importance features
    importance.to_csv(
      model_output_path.parent / "lgbm_feature_importance.csv",
      index=False
    )

    # Save model
    model.booster_.save_model(model_output_path)    
    print(f"Model saved to {model_output_path}")

    # Save features
    with open(model_output_path.parent / "feature_names.json", "w") as f:
        json.dump(selected_features, f, indent=4)
    print("Features saved to feature_names.json")

if __name__ == "__main__":
    base = Path(__file__).resolve().parents[1]

    processed_path = base / "data" / "processed" / "weather_features.csv"
    model_output_path = base / "models"/ "lgbm_heavy_rain.txt"

    train(processed_path, model_output_path)