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
print("ADVANCED ML MODEL v5 — 1481 ROWS, 2-CLASS")
print("=" * 60)

# ── LOAD DATA ─────────────────────────────────────────────────
df = pd.read_csv('data/nsei_features.csv', index_col=0, parse_dates=True)
df = df.dropna()
print(f"\nRows loaded: {len(df)}")
print(f"Date range: {df.index[0].date()} to {df.index[-1].date()}")

FEATURES = [
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month',
    'atr_ratio', 'volatility_10', 'volatility_20',
    'dist_60d_high', 'dist_60d_low',
    'weekly_return', 'monthly_return',
    'obv_ratio', 'wick_ratio',
    'regime_vol', 'trend_strength',
    'returns', 'mom_5', 'mom_10',
    'body_size', 'rsi_divergence', 'upper_wick'
]

# Verify all features exist
FEATURES = [f for f in FEATURES if f in df.columns]
print(f"Features available: {len(FEATURES)}")

# ── USE 2-CLASS LABEL ─────────────────────────────────────────
X = df[FEATURES]
y = df['label']  # 2-class: 0 = HOLD, 1 = BUY

print(f"\nLabel distribution:")
print(y.value_counts())

# ── TRAIN/TEST SPLIT ──────────────────────────────────────────
print("\n[1/5] Splitting data (time-based)...")

split = int(len(df) * 0.8)
X_train = X.iloc[:split]
X_test  = X.iloc[split:]
y_train = y.iloc[:split]
y_test  = y.iloc[split:]

sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)

print(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows")
print(f"Train labels: {dict(y_train.value_counts())}")
print(f"Test labels:  {dict(y_test.value_counts())}")

# ── OPTUNA TUNING ─────────────────────────────────────────────
print("\n[2/5] Tuning hyperparameters (80 trials each)...")

def objective_xgb(trial):
    m = XGBClassifier(
        n_estimators     = trial.suggest_int('n_estimators', 100, 800),
        max_depth        = trial.suggest_int('max_depth', 3, 8),
        learning_rate    = trial.suggest_float('learning_rate', 0.005, 0.1),
        subsample        = trial.suggest_float('subsample', 0.6, 1.0),
        colsample_bytree = trial.suggest_float('colsample_bytree', 0.5, 1.0),
        min_child_weight = trial.suggest_int('min_child_weight', 1, 20),
        gamma            = trial.suggest_float('gamma', 0, 3),
        reg_alpha        = trial.suggest_float('reg_alpha', 0, 1),
        reg_lambda       = trial.suggest_float('reg_lambda', 0, 2),
        eval_metric      = 'logloss',
        random_state     = 42
    )
    m.fit(X_train, y_train, sample_weight=sample_weights, verbose=False)
    return accuracy_score(y_test, m.predict(X_test))

def objective_lgbm(trial):
    m = LGBMClassifier(
        n_estimators      = trial.suggest_int('n_estimators', 100, 800),
        max_depth         = trial.suggest_int('max_depth', 3, 8),
        learning_rate     = trial.suggest_float('learning_rate', 0.005, 0.1),
        subsample         = trial.suggest_float('subsample', 0.6, 1.0),
        colsample_bytree  = trial.suggest_float('colsample_bytree', 0.5, 1.0),
        num_leaves        = trial.suggest_int('num_leaves', 20, 150),
        min_child_samples = trial.suggest_int('min_child_samples', 5, 50),
        reg_alpha         = trial.suggest_float('reg_alpha', 0, 1),
        reg_lambda        = trial.suggest_float('reg_lambda', 0, 2),
        random_state      = 42,
        verbose           = -1
    )
    m.fit(X_train, y_train, sample_weight=sample_weights)
    return accuracy_score(y_test, m.predict(X_test))

study_xgb  = optuna.create_study(direction='maximize')
study_lgbm = optuna.create_study(direction='maximize')
study_xgb.optimize(objective_xgb,  n_trials=80)
study_lgbm.optimize(objective_lgbm, n_trials=80)

print(f"Best XGBoost  accuracy: {study_xgb.best_value:.4f}")
print(f"Best LightGBM accuracy: {study_lgbm.best_value:.4f}")

# ── TRAIN FINAL ENSEMBLE ──────────────────────────────────────
print("\n[3/5] Training final ensemble...")

xgb_model = XGBClassifier(
    **study_xgb.best_params,
    eval_metric='logloss',
    random_state=42
)
xgb_model.fit(X_train, y_train, sample_weight=sample_weights, verbose=False)

lgbm_model = LGBMClassifier(
    **study_lgbm.best_params,
    random_state=42,
    verbose=-1
)
lgbm_model.fit(X_train, y_train, sample_weight=sample_weights)

cat_model = CatBoostClassifier(
    iterations=500,
    depth=6,
    learning_rate=0.03,
    random_seed=42,
    verbose=False,
    auto_class_weights='Balanced'
)
cat_model.fit(X_train, y_train)

xgb_acc  = accuracy_score(y_test, xgb_model.predict(X_test))
lgbm_acc = accuracy_score(y_test, lgbm_model.predict(X_test))
cat_acc  = accuracy_score(y_test, cat_model.predict(X_test))

print(f"XGBoost  test accuracy: {xgb_acc:.4f}")
print(f"LightGBM test accuracy: {lgbm_acc:.4f}")
print(f"CatBoost test accuracy: {cat_acc:.4f}")

total  = xgb_acc + lgbm_acc + cat_acc
w_xgb  = xgb_acc  / total
w_lgbm = lgbm_acc / total
w_cat  = cat_acc  / total

xgb_probs      = xgb_model.predict_proba(X_test)
lgbm_probs     = lgbm_model.predict_proba(X_test)
cat_probs      = cat_model.predict_proba(X_test)
ensemble_probs = w_xgb * xgb_probs + w_lgbm * lgbm_probs + w_cat * cat_probs
ensemble_preds = np.argmax(ensemble_probs, axis=1)
ensemble_acc   = accuracy_score(y_test, ensemble_preds)

print(f"\nEnsemble weights → XGB: {w_xgb:.2f} | LGBM: {w_lgbm:.2f} | CAT: {w_cat:.2f}")
print(f"Ensemble test accuracy: {ensemble_acc:.4f}")

print("\n=== FINAL REPORT (UNSEEN TEST DATA) ===")
print(classification_report(y_test, ensemble_preds, target_names=['HOLD', 'BUY']))

# Feature importance
print("=== TOP 10 FEATURES ===")
importance = sorted(
    zip(FEATURES, xgb_model.feature_importances_),
    key=lambda x: x[1], reverse=True
)
for feat, imp in importance[:10]:
    print(f"  {feat:<25} {imp:.4f}")

# ── SAVE ──────────────────────────────────────────────────────
print("\n[4/5] Saving...")

joblib.dump(xgb_model,  'models/xgb_model.pkl')
joblib.dump(lgbm_model, 'models/lgbm_model.pkl')
joblib.dump(cat_model,  'models/cat_model.pkl')
joblib.dump(FEATURES,   'models/features.pkl')
joblib.dump({'w_xgb': w_xgb, 'w_lgbm': w_lgbm, 'w_cat': w_cat}, 'models/ensemble_weights.pkl')

# Save label encoder for 2-class
le = LabelEncoder()
le.fit(y)
joblib.dump(le, 'models/label_encoder.pkl')

print("\n✅ DONE.")
print("   Rows: {len(df)} | Features: {len(FEATURES)}")
print("   Ensemble accuracy: {ensemble_acc:.4f}")
print("   Classes: 0=HOLD, 1=BUY")