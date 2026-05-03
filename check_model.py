import pandas as pd, joblib, numpy as np
from sklearn.metrics import classification_report

df = pd.read_csv('data/nsei_features.csv').dropna()
model = joblib.load('models/xgb_model.pkl')
le = joblib.load('models/label_encoder.pkl')

FEATURES = ['sma_cross','rsi','macd','macd_signal','macd_diff','bb_width','bb_pos','volume_ratio','day_of_week','month']

X = df[FEATURES]
y = le.transform(df['label'])
preds = model.predict(X)

print("=== LABEL DISTRIBUTION ===")
print(df['label'].value_counts())
print("\n=== CLASS-WISE ACCURACY ===")
print(classification_report(y, preds, target_names=le.classes_.astype(str)))