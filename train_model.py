import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder
import joblib
import os

# ── 1. LOAD DATA ───────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv("data/nsei_features.csv", index_col=0, parse_dates=True)

FEATURES = [
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month'
]

X = df[FEATURES]
y = df['label']

# Encode labels: -1 → 0, 0 → 1, 1 → 2
le = LabelEncoder()
y_encoded = le.fit_transform(y)

print(f"✅ Loaded {len(X)} rows, {len(FEATURES)} features")

# ── 2. TRAIN WITH TimeSeriesSplit ──────────────────────────────
print("Training model...")

tscv = TimeSeriesSplit(n_splits=5)

model = XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    use_label_encoder=False,
    eval_metric='mlogloss',
    random_state=42
)

# Walk-forward validation
for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y_encoded[train_idx], y_encoded[test_idx]

    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    print(f"\nFold {fold+1}:")
    print(classification_report(y_test, preds, target_names=['SELL','HOLD','BUY']))

# ── 3. FINAL TRAIN ON ALL DATA ─────────────────────────────────
model.fit(X, y_encoded)

# ── 4. SAVE MODEL ──────────────────────────────────────────────
os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/xgb_model.pkl")
joblib.dump(le, "models/label_encoder.pkl")

print("\n✅ Model saved to models/xgb_model.pkl")