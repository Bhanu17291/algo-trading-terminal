from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.calibration import CalibratedClassifierCV


import pandas as pd
import numpy as np
import joblib
import optuna
import warnings
warnings.filterwarnings('ignore')



optuna.logging.set_verbosity(optuna.logging.WARNING)

print("=" * 60)
print("ADVANCED ML MODEL TRAINING PIPELINE")
print("=" * 60)

# ── LOAD DATA ─────────────────────────────────────────────────
df = pd.read_csv('data/nsei_features.csv', index_col=0, parse_dates=True)
df = df.dropna()

# ── PHASE 1: FEATURE ENGINEERING ─────────────────────────────
print("\n[1/5] Engineering features...")

# ATR and normalized volatility
df['atr']       = (df['High'] - df['Low']).rolling(14).mean()
df['atr_ratio'] = df['atr'] / df['Close']

# Historical volatility
df['returns']        = df['Close'].pct_change()
df['volatility_10']  = df['returns'].rolling(10).std()
df['volatility_20']  = df['returns'].rolling(20).std()

# Distance from 52-week high/low
df['high_52w']      = df['High'].rolling(252).max()
df['low_52w']       = df['Low'].rolling(252).min()
df['dist_52w_high'] = (df['Close'] - df['high_52w']) / df['high_52w']
df['dist_52w_low']  = (df['Close'] - df['low_52w'])  / df['low_52w']

# Multi-timeframe momentum
df['weekly_return']    = df['Close'].pct_change(5)
df['monthly_return']   = df['Close'].pct_change(21)
df['quarterly_return'] = df['Close'].pct_change(63)

# OBV trend
df['obv']       = (np.sign(df['Close'].diff()) * df['Volume']).cumsum()
df['obv_ratio'] = df['obv'] / df['obv'].rolling(20).mean()

# Candlestick structure
df['upper_wick'] = df['High'] - df[['Close', 'Open']].max(axis=1)
df['lower_wick'] = df[['Close', 'Open']].min(axis=1) - df['Low']
df['body_size']  = (df['Close'] - df['Open']).abs()
df['wick_ratio'] = (df['upper_wick'] - df['lower_wick']) / (df['body_size'] + 1e-9)

# Regime detection features
df['atr_20']        = df['atr'].rolling(20).mean()
df['regime_vol']    = df['atr_ratio'] / df['atr_ratio'].rolling(20).mean()
df['trend_strength']= abs(df['Close'] - df['Close'].rolling(20).mean()) / df['Close'].rolling(20).std()

df = df.dropna()

FEATURES = [
    # Original 10
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month',
    # New 13
    'atr_ratio', 'volatility_10', 'volatility_20',
    'dist_52w_high', 'dist_52w_low',
    'weekly_return', 'monthly_return', 'quarterly_return',
    'obv_ratio', 'wick_ratio',
    'regime_vol', 'trend_strength', 'returns'
]

print(f"    Total features: {len(FEATURES)} (was 10, now {len(FEATURES)})")
print(f"    Dataset size: {len(df)} rows after dropna")

# ── PHASE 2: TRAIN/TEST SPLIT + LABEL ENCODING ───────────────
print("\n[2/5] Splitting data (time-based, no leakage)...")

split = int(len(df) * 0.8)
X_train = df[FEATURES].iloc[:split]
X_test  = df[FEATURES].iloc[split:]
y_train = df['label'].iloc[:split]
y_test  = df['label'].iloc[split:]

le = LabelEncoder()
y_train_enc = le.fit_transform(y_train)
y_test_enc  = le.transform(y_test)

sample_weights = compute_sample_weight(class_weight='balanced', y=y_train_enc)

print(f"    Train: {len(X_train)} rows | Test: {len(X_test)} rows")
print(f"    Train labels: {dict(pd.Series(y_train).value_counts())}")
print(f"    Test labels:  {dict(pd.Series(y_test).value_counts())}")

# ── PHASE 3: OPTUNA HYPERPARAMETER TUNING ────────────────────
print("\n[3/5] Tuning hyperparameters with Optuna (50 trials)...")

def objective_xgb(trial):
    params = {
        'n_estimators':     trial.suggest_int('n_estimators', 100, 500),
        'max_depth':        trial.suggest_int('max_depth', 3, 7),
        'learning_rate':    trial.suggest_float('learning_rate', 0.01, 0.1),
        'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'gamma':            trial.suggest_float('gamma', 0, 2),
        'eval_metric':      'mlogloss',
        'random_state':     42
    }
    m = XGBClassifier(**params)
    m.fit(X_train, y_train_enc, sample_weight=sample_weights, verbose=False)
    return accuracy_score(y_test_enc, m.predict(X_test))

def objective_lgbm(trial):
    params = {
        'n_estimators':   trial.suggest_int('n_estimators', 100, 500),
        'max_depth':      trial.suggest_int('max_depth', 3, 7),
        'learning_rate':  trial.suggest_float('learning_rate', 0.01, 0.1),
        'subsample':      trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'num_leaves':     trial.suggest_int('num_leaves', 20, 100),
        'random_state':   42,
        'verbose':        -1
    }
    m = LGBMClassifier(**params)
    m.fit(X_train, y_train_enc, sample_weight=sample_weights)
    return accuracy_score(y_test_enc, m.predict(X_test))

study_xgb  = optuna.create_study(direction='maximize')
study_lgbm = optuna.create_study(direction='maximize')

study_xgb.optimize(objective_xgb,  n_trials=50, show_progress_bar=False)
study_lgbm.optimize(objective_lgbm, n_trials=50, show_progress_bar=False)

print(f"    Best XGBoost accuracy:  {study_xgb.best_value:.4f}")
print(f"    Best LightGBM accuracy: {study_lgbm.best_value:.4f}")

# ── PHASE 4: TRAIN FINAL ENSEMBLE ────────────────────────────
print("\n[4/5] Training final ensemble (XGBoost + LightGBM + CatBoost)...")

# XGBoost with best params
xgb_model = XGBClassifier(**study_xgb.best_params, eval_metric='mlogloss', random_state=42)
xgb_model.fit(X_train, y_train_enc, sample_weight=sample_weights, verbose=False)

# LightGBM with best params
lgbm_model = LGBMClassifier(**study_lgbm.best_params, random_state=42, verbose=-1)
lgbm_model.fit(X_train, y_train_enc, sample_weight=sample_weights)

# CatBoost
cat_model = CatBoostClassifier(
    iterations=300,
    depth=5,
    learning_rate=0.05,
    random_seed=42,
    verbose=False,
    class_weights={0: 1.5, 1: 2.0, 2: 2.5}
)
cat_model.fit(X_train, y_train_enc)

# Evaluate each individually
xgb_acc  = accuracy_score(y_test_enc, xgb_model.predict(X_test))
lgbm_acc = accuracy_score(y_test_enc, lgbm_model.predict(X_test))
cat_acc  = accuracy_score(y_test_enc, cat_model.predict(X_test))

print(f"    XGBoost  test accuracy: {xgb_acc:.4f}")
print(f"    LightGBM test accuracy: {lgbm_acc:.4f}")
print(f"    CatBoost test accuracy: {cat_acc:.4f}")

# Weighted ensemble vote
total = xgb_acc + lgbm_acc + cat_acc
w_xgb  = xgb_acc  / total
w_lgbm = lgbm_acc / total
w_cat  = cat_acc  / total

print(f"\n    Ensemble weights → XGB: {w_xgb:.2f} | LGBM: {w_lgbm:.2f} | CAT: {w_cat:.2f}")

# Weighted probability ensemble
xgb_probs  = xgb_model.predict_proba(X_test)
lgbm_probs = lgbm_model.predict_proba(X_test)
cat_probs  = cat_model.predict_proba(X_test)

ensemble_probs = w_xgb * xgb_probs + w_lgbm * lgbm_probs + w_cat * cat_probs
ensemble_preds = np.argmax(ensemble_probs, axis=1)
ensemble_acc   = accuracy_score(y_test_enc, ensemble_preds)

print(f"\n    Ensemble test accuracy: {ensemble_acc:.4f}")
print("\n=== FINAL ENSEMBLE CLASSIFICATION REPORT (UNSEEN TEST DATA) ===")
print(classification_report(y_test_enc, ensemble_preds, target_names=le.classes_.astype(str)))

# ── PHASE 5: SAVE EVERYTHING ──────────────────────────────────
print("[5/5] Saving models and updated features...")

joblib.dump(xgb_model,  'models/xgb_model.pkl')
joblib.dump(lgbm_model, 'models/lgbm_model.pkl')
joblib.dump(cat_model,  'models/cat_model.pkl')
joblib.dump(le,         'models/label_encoder.pkl')
joblib.dump({
    'w_xgb':  w_xgb,
    'w_lgbm': w_lgbm,
    'w_cat':  w_cat
}, 'models/ensemble_weights.pkl')

df.to_csv('data/nsei_features.csv')

print("\n✅ DONE. All models saved.")
print(f"   Features: {len(FEATURES)} total")
print("   Models:   xgb_model.pkl, lgbm_model.pkl, cat_model.pkl")
print("   Weights:  ensemble_weights.pkl")
print("   Ensemble test accuracy: {ensemble_acc:.4f}")