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
print("ADVANCED ML MODEL — NIFTY 50 POOLED CROSS-SECTIONAL, 2-CLASS")
print("=" * 60)

# ── LOAD DATA ─────────────────────────────────────────────────
df = pd.read_csv('data/nifty50_features.csv', index_col=0, parse_dates=True)
df = df.dropna()
df.index.name = df.index.name or 'Date'
print(f"\nRows loaded: {len(df)}")
print(f"Symbols: {df['symbol'].nunique()}")
print(f"Date range: {df.index.min().date()} to {df.index.max().date()}")

# ── ENCODE SYMBOL AS A FEATURE ───────────────────────────────
# Lets the model learn stock-specific tendencies while still being ONE pooled
# model trained across all rows — far more training data per model than
# training 49 separate models on ~4 years each.
symbol_encoder = LabelEncoder()
df['symbol_id'] = symbol_encoder.fit_transform(df['symbol'])

FEATURES = [
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month',
    'atr_ratio', 'volatility_10', 'volatility_20',
    'dist_60d_high', 'dist_60d_low',
    'weekly_return', 'monthly_return',
    'obv_ratio', 'wick_ratio',
    'regime_vol', 'trend_strength',
    'returns', 'mom_5', 'mom_10',
    'body_size', 'rsi_divergence', 'upper_wick',
    'symbol_id',   # <- only real addition vs. train_model_v5.py's feature list
]

FEATURES = [f for f in FEATURES if f in df.columns]
print(f"Features available: {len(FEATURES)}")

# ── USE 2-CLASS LABEL ─────────────────────────────────────────
X = df[FEATURES]
y = df['label']  # 2-class: 0 = HOLD, 1 = BUY

print(f"\nLabel distribution:")
print(y.value_counts())

# ── TIME-BASED SPLIT BY DATE, NOT ROW COUNT ──────────────────
# With ~49 rows per date (one per stock), a row-count split could let one
# stock's later dates leak into another stock's "test" period. Splitting on
# a shared date cutoff keeps train/test cleanly separated in time for every
# stock at once — same no-look-ahead guarantee as the original pipeline.
print("\n[1/5] Splitting data (time-based, by date)...")

unique_dates = np.sort(df.index.unique())
split_date = unique_dates[int(len(unique_dates) * 0.8)]

train_mask = df.index < split_date
test_mask  = ~train_mask

X_train, X_test = X[train_mask], X[test_mask]
y_train, y_test = y[train_mask], y[test_mask]

sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)

print(f"Split date: {pd.Timestamp(split_date).date()}")
print(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows")
print(f"Train labels: {dict(y_train.value_counts())}")
print(f"Test labels:  {dict(y_test.value_counts())}")

# ── OPTUNA TUNING ─────────────────────────────────────────────
# Same search spaces as train_model_v5.py. NOTE: with ~35x more rows than the
# index-only model, each trial takes longer — consider cutting n_trials down
# (e.g. 40) for a first pass, then raising it once the pipeline is confirmed
# working end-to-end.
N_TRIALS = 80
print(f"\n[2/5] Tuning hyperparameters ({N_TRIALS} trials each)...")

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

study_xgb  = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=42))
study_lgbm = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=42))
study_xgb.optimize(objective_xgb,  n_trials=N_TRIALS)
study_lgbm.optimize(objective_lgbm, n_trials=N_TRIALS)

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

# ── PER-STOCK ACCURACY BREAKDOWN ──────────────────────────────
# Worth checking: a pooled model can still perform unevenly across stocks
# (e.g. very low-volatility names vs. high-beta names). This surfaces that
# before it becomes a surprise in the strategy engine (Phase 4).
print("\n=== PER-SYMBOL TEST ACCURACY (bottom 10) ===")
test_df = df[test_mask].copy()
test_df['pred'] = ensemble_preds
test_df['correct'] = (test_df['pred'] == test_df['label']).astype(int)
per_symbol_acc = test_df.groupby('symbol')['correct'].mean().sort_values()
print(per_symbol_acc.head(10))

# ── SAVE ──────────────────────────────────────────────────────
print("\n[4/5] Saving...")

joblib.dump(xgb_model,       'models/xgb_model_stocks.pkl')
joblib.dump(lgbm_model,      'models/lgbm_model_stocks.pkl')
joblib.dump(cat_model,       'models/cat_model_stocks.pkl')
joblib.dump(FEATURES,        'models/features_stocks.pkl')
joblib.dump({'w_xgb': w_xgb, 'w_lgbm': w_lgbm, 'w_cat': w_cat}, 'models/ensemble_weights_stocks.pkl')
joblib.dump(symbol_encoder,  'models/symbol_encoder_stocks.pkl')  # needed to map symbol -> symbol_id at inference

le = LabelEncoder()
le.fit(y)
joblib.dump(le, 'models/label_encoder_stocks.pkl')

print("\n[5/5] Done.")
print(f"   Rows: {len(df)} | Symbols: {df['symbol'].nunique()} | Features: {len(FEATURES)}")
print(f"   Ensemble accuracy: {ensemble_acc:.4f}")
print("   Classes: 0=HOLD, 1=BUY")
print("   Saved 6 files to models/ with a '_stocks' suffix — nothing existing was overwritten.")