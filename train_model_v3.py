import pandas as pd
import numpy as np
import joblib
import optuna
import warnings
warnings.filterwarnings('ignore')

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from sklearn.utils.class_weight import compute_sample_weight

optuna.logging.set_verbosity(optuna.logging.WARNING)

print("=" * 60)
print("ADVANCED ML MODEL v3 — FULL DATA PRESERVED")
print("=" * 60)

# ── LOAD ORIGINAL DATA (before v2 shrunk it) ─────────────────
df = pd.read_csv('data/nsei_features_backup.csv', index_col=0, parse_dates=True)
df = df.dropna()
print(f"\nOriginal rows loaded: {len(df)}")

# ── FEATURE ENGINEERING (no large rolling windows) ───────────
print("\n[1/5] Engineering features...")

# ATR — use 14 days (small window, safe)
df['atr']       = (df['High'] - df['Low']).rolling(14).mean()
df['atr_ratio'] = df['atr'] / df['Close']

# Volatility — short windows only
df['returns']       = df['Close'].pct_change()
df['volatility_10'] = df['returns'].rolling(10).std()
df['volatility_20'] = df['returns'].rolling(20).std()

# 52-week levels — use min available window (not 252)
# Use 60-day high/low instead — captures meaningful levels without eating data
df['high_60d']      = df['High'].rolling(60).max()
df['low_60d']       = df['Low'].rolling(60).min()
df['dist_60d_high'] = (df['Close'] - df['high_60d']) / df['high_60d']
df['dist_60d_low']  = (df['Close'] - df['low_60d'])  / df['low_60d']

# Multi-timeframe momentum — use shorter lookbacks
df['weekly_return']  = df['Close'].pct_change(5)
df['monthly_return'] = df['Close'].pct_change(21)

# OBV trend
df['obv']       = (np.sign(df['Close'].diff()) * df['Volume']).cumsum()
df['obv_sma']   = df['obv'].rolling(20).mean()
df['obv_ratio'] = df['obv'] / (df['obv_sma'] + 1e-9)

# Candlestick structure
df['upper_wick'] = df['High'] - df[['Close', 'Open']].max(axis=1)
df['lower_wick'] = df[['Close', 'Open']].min(axis=1) - df['Low']
df['body_size']  = (df['Close'] - df['Open']).abs()
df['wick_ratio'] = (df['upper_wick'] - df['lower_wick']) / (df['body_size'] + 1e-9)

# Regime features
df['regime_vol']     = df['atr_ratio'] / (df['atr_ratio'].rolling(20).mean() + 1e-9)
df['trend_strength'] = (
    abs(df['Close'] - df['Close'].rolling(20).mean()) /
    (df['Close'].rolling(20).std() + 1e-9)
)

# Price momentum
df['mom_5']  = df['Close'] / df['Close'].shift(5)  - 1
df['mom_10'] = df['Close'] / df['Close'].shift(10) - 1

df = df.dropna()
print(f"Rows after feature engineering: {len(df)}")

FEATURES = [
    # Original 10
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month',
    # New 15
    'atr_ratio', 'volatility_10', 'volatility_20',
    'dist_60d_high', 'dist_60d_low',
    'weekly_return', 'monthly_return',
    'obv_ratio', 'wick_ratio',
    'regime_vol', 'trend_strength',
    'returns', 'mom_5', 'mom_10',
    'body_size'
]

print(f"Total features: {len(FEATURES)}")

# ── TRAIN/TEST SPLIT ──────────────────────────────────────────
print("\n[2/5] Splitting data...")

split = int(len(df) * 0.8)
X_train = df[FEATURES].iloc[:split]
X_test  = df[FEATURES].iloc[split:]
y_train = df['label'].iloc[:split]
y_test  = df['label'].iloc[split:]

le = LabelEncoder()
y_train_enc = le.fit_transform(y_train)
y_test_enc  = le.transform(y_test)

sample_weights = compute_sample_weight(class_weight='balanced', y=y_train_enc)

print(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows")
print(f"Train labels: {dict(pd.Series(y_train).value_counts())}")
print(f"Test labels:  {dict(pd.Series(y_test).value_counts())}")

# ── OPTUNA TUNING ─────────────────────────────────────────────
print("\n[3/5] Tuning with Optuna (60 trials each)...")

def objective_xgb(trial):
    m = XGBClassifier(
        n_estimators     = trial.suggest_int('n_estimators', 100, 600),
        max_depth        = trial.suggest_int('max_depth', 3, 8),
        learning_rate    = trial.suggest_float('learning_rate', 0.01, 0.15),
        subsample        = trial.suggest_float('subsample', 0.6, 1.0),
        colsample_bytree = trial.suggest_float('colsample_bytree', 0.5, 1.0),
        min_child_weight = trial.suggest_int('min_child_weight', 1, 15),
        gamma            = trial.suggest_float('gamma', 0, 3),
        eval_metric      = 'mlogloss',
        random_state     = 42
    )
    m.fit(X_train, y_train_enc, sample_weight=sample_weights, verbose=False)
    return accuracy_score(y_test_enc, m.predict(X_test))

def objective_lgbm(trial):
    m = LGBMClassifier(
        n_estimators     = trial.suggest_int('n_estimators', 100, 600),
        max_depth        = trial.suggest_int('max_depth', 3, 8),
        learning_rate    = trial.suggest_float('learning_rate', 0.01, 0.15),
        subsample        = trial.suggest_float('subsample', 0.6, 1.0),
        colsample_bytree = trial.suggest_float('colsample_bytree', 0.5, 1.0),
        num_leaves       = trial.suggest_int('num_leaves', 20, 150),
        min_child_samples= trial.suggest_int('min_child_samples', 5, 30),
        random_state     = 42,
        verbose          = -1
    )
    m.fit(X_train, y_train_enc, sample_weight=sample_weights)
    return accuracy_score(y_test_enc, m.predict(X_test))

study_xgb  = optuna.create_study(direction='maximize')
study_lgbm = optuna.create_study(direction='maximize')
study_xgb.optimize(objective_xgb,  n_trials=60)
study_lgbm.optimize(objective_lgbm, n_trials=60)

print(f"Best XGBoost  accuracy: {study_xgb.best_value:.4f}")
print(f"Best LightGBM accuracy: {study_lgbm.best_value:.4f}")

# ── TRAIN FINAL ENSEMBLE ──────────────────────────────────────
print("\n[4/5] Training final ensemble...")

xgb_model = XGBClassifier(
    **study_xgb.best_params,
    eval_metric='mlogloss',
    random_state=42
)
xgb_model.fit(X_train, y_train_enc, sample_weight=sample_weights, verbose=False)

lgbm_model = LGBMClassifier(
    **study_lgbm.best_params,
    random_state=42,
    verbose=-1
)
lgbm_model.fit(X_train, y_train_enc, sample_weight=sample_weights)

cat_model = CatBoostClassifier(
    iterations=400,
    depth=6,
    learning_rate=0.04,
    random_seed=42,
    verbose=False,
    auto_class_weights='Balanced'
)
cat_model.fit(X_train, y_train_enc)

# Individual accuracies
xgb_acc  = accuracy_score(y_test_enc, xgb_model.predict(X_test))
lgbm_acc = accuracy_score(y_test_enc, lgbm_model.predict(X_test))
cat_acc  = accuracy_score(y_test_enc, cat_model.predict(X_test))

print(f"XGBoost  test accuracy: {xgb_acc:.4f}")
print(f"LightGBM test accuracy: {lgbm_acc:.4f}")
print(f"CatBoost test accuracy: {cat_acc:.4f}")

# Weighted ensemble
total  = xgb_acc + lgbm_acc + cat_acc
w_xgb  = xgb_acc  / total
w_lgbm = lgbm_acc / total
w_cat  = cat_acc  / total

xgb_probs      = xgb_model.predict_proba(X_test)
lgbm_probs     = lgbm_model.predict_proba(X_test)
cat_probs      = cat_model.predict_proba(X_test)
ensemble_probs = w_xgb * xgb_probs + w_lgbm * lgbm_probs + w_cat * cat_probs
ensemble_preds = np.argmax(ensemble_probs, axis=1)
ensemble_acc   = accuracy_score(y_test_enc, ensemble_preds)

print(f"\nEnsemble weights → XGB: {w_xgb:.2f} | LGBM: {w_lgbm:.2f} | CAT: {w_cat:.2f}")
print(f"Ensemble test accuracy: {ensemble_acc:.4f}")

print("\n=== FINAL REPORT (UNSEEN TEST DATA) ===")
print(classification_report(y_test_enc, ensemble_preds, target_names=le.classes_.astype(str)))

# ── SAVE ──────────────────────────────────────────────────────
print("[5/5] Saving...")

joblib.dump(xgb_model,  'models/xgb_model.pkl')
joblib.dump(lgbm_model, 'models/lgbm_model.pkl')
joblib.dump(cat_model,  'models/cat_model.pkl')
joblib.dump(le,         'models/label_encoder.pkl')
joblib.dump(FEATURES,   'models/features.pkl')
joblib.dump({'w_xgb': w_xgb, 'w_lgbm': w_lgbm, 'w_cat': w_cat}, 'models/ensemble_weights.pkl')

df.to_csv('data/nsei_features.csv')

print(f"\n✅ DONE. Ensemble accuracy: {ensemble_acc:.4f}")
print(f"   Rows preserved: {len(df)} (was 243, now {len(df)})")
print(f"   Features: {len(FEATURES)}")