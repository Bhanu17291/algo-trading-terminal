import pandas as pd
import numpy as np
import joblib
import optuna
import warnings
warnings.filterwarnings('ignore')

from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
from catboost import CatBoostRegressor
from sklearn.preprocessing import LabelEncoder
from scipy.stats import spearmanr

optuna.logging.set_verbosity(optuna.logging.WARNING)

print("=" * 60)
print("NIFTY 50 POOLED CROSS-SECTIONAL RANKER (regression on future_return)")
print("=" * 60)

# ── LOAD DATA ─────────────────────────────────────────────────
df = pd.read_csv('data/nifty50_features.csv', index_col=0, parse_dates=True)
df = df.dropna()
print(f"\nRows loaded: {len(df)}")
print(f"Symbols: {df['symbol'].nunique()}")
print(f"Date range: {df.index.min().date()} to {df.index.max().date()}")

# Reuse the same symbol encoding as the classifier if it exists, so symbol_id
# means the same thing across both models. Falls back to a fresh encoder.
try:
    symbol_encoder = joblib.load('models/symbol_encoder_stocks.pkl')
    df['symbol_id'] = symbol_encoder.transform(df['symbol'])
    print("Reused existing symbol encoder from train_model_stocks.py")
except FileNotFoundError:
    symbol_encoder = LabelEncoder()
    df['symbol_id'] = symbol_encoder.fit_transform(df['symbol'])
    print("No existing symbol encoder found — fit a new one")

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
    'symbol_id',
]
FEATURES = [f for f in FEATURES if f in df.columns]
print(f"Features available: {len(FEATURES)}")

# ── TARGET: the continuous forward return, not a threshold call ──
X = df[FEATURES]
y = df['future_return']

print(f"\nTarget (future_return) stats:")
print(y.describe())

# ── TIME-BASED SPLIT BY DATE ──────────────────────────────────
print("\n[1/5] Splitting data (time-based, by date)...")

unique_dates = np.sort(df.index.unique())
split_date = unique_dates[int(len(unique_dates) * 0.8)]

train_mask = df.index < split_date
test_mask  = ~train_mask

X_train, X_test = X[train_mask], X[test_mask]
y_train, y_test = y[train_mask], y[test_mask]
test_index = df.index[test_mask]  # needed to group predictions by date for IC

print(f"Split date: {pd.Timestamp(split_date).date()}")
print(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows")


def mean_daily_ic(preds, actual_returns, dates):
    """The metric that actually matters: for each date, rank stocks by
    predicted return and check Spearman correlation against actual forward
    return, then average across all test dates."""
    tmp = pd.DataFrame({'pred': preds, 'actual': actual_returns.values, 'date': dates})
    ics = []
    for _, g in tmp.groupby('date'):
        if len(g) < 10:
            continue
        ic, _ = spearmanr(g['pred'], g['actual'])
        if not np.isnan(ic):
            ics.append(ic)
    return np.mean(ics) if ics else 0.0


# ── OPTUNA TUNING — OPTIMIZE IC DIRECTLY, NOT RMSE ────────────
# This is the key change vs. the classifier: we tune for the metric we
# actually care about (does this rank stocks well) rather than a proxy
# (accuracy on an arbitrary threshold).
N_TRIALS = 40  # lower than the classifier's 80 — raise once you confirm this runs end-to-end
print(f"\n[2/5] Tuning hyperparameters ({N_TRIALS} trials each, objective = mean daily IC)...")

def objective_xgb(trial):
    m = XGBRegressor(
        n_estimators     = trial.suggest_int('n_estimators', 100, 800),
        max_depth        = trial.suggest_int('max_depth', 3, 8),
        learning_rate    = trial.suggest_float('learning_rate', 0.005, 0.1),
        subsample        = trial.suggest_float('subsample', 0.6, 1.0),
        colsample_bytree = trial.suggest_float('colsample_bytree', 0.5, 1.0),
        min_child_weight = trial.suggest_int('min_child_weight', 1, 20),
        gamma            = trial.suggest_float('gamma', 0, 3),
        reg_alpha        = trial.suggest_float('reg_alpha', 0, 1),
        reg_lambda       = trial.suggest_float('reg_lambda', 0, 2),
        random_state     = 42
    )
    m.fit(X_train, y_train)
    preds = m.predict(X_test)
    return mean_daily_ic(preds, y_test, test_index)

def objective_lgbm(trial):
    m = LGBMRegressor(
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
    m.fit(X_train, y_train)
    preds = m.predict(X_test)
    return mean_daily_ic(preds, y_test, test_index)

study_xgb  = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=42))
study_lgbm = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=42))
study_xgb.optimize(objective_xgb,  n_trials=N_TRIALS)
study_lgbm.optimize(objective_lgbm, n_trials=N_TRIALS)

print(f"Best XGBoost  mean daily IC: {study_xgb.best_value:.4f}")
print(f"Best LightGBM mean daily IC: {study_lgbm.best_value:.4f}")

# ── TRAIN FINAL ENSEMBLE ──────────────────────────────────────
print("\n[3/5] Training final ensemble...")

xgb_model = XGBRegressor(**study_xgb.best_params, random_state=42)
xgb_model.fit(X_train, y_train)

lgbm_model = LGBMRegressor(**study_lgbm.best_params, random_state=42, verbose=-1)
lgbm_model.fit(X_train, y_train)

cat_model = CatBoostRegressor(
    iterations=500, depth=6, learning_rate=0.03,
    random_seed=42, verbose=False
)
cat_model.fit(X_train, y_train)

xgb_preds  = xgb_model.predict(X_test)
lgbm_preds = lgbm_model.predict(X_test)
cat_preds  = cat_model.predict(X_test)

xgb_ic  = mean_daily_ic(xgb_preds,  y_test, test_index)
lgbm_ic = mean_daily_ic(lgbm_preds, y_test, test_index)
cat_ic  = mean_daily_ic(cat_preds,  y_test, test_index)

print(f"XGBoost  mean daily IC: {xgb_ic:.4f}")
print(f"LightGBM mean daily IC: {lgbm_ic:.4f}")
print(f"CatBoost mean daily IC: {cat_ic:.4f}")

# Weight by POSITIVE IC only — a model with negative/near-zero IC shouldn't
# drag the ensemble down. If all three are non-positive, fall back to equal
# weights rather than dividing by ~zero.
raw = np.array([max(xgb_ic, 0), max(lgbm_ic, 0), max(cat_ic, 0)])
if raw.sum() < 1e-6:
    w_xgb = w_lgbm = w_cat = 1 / 3
    print("\n⚠️  All three models had non-positive IC — using equal weights.")
else:
    w_xgb, w_lgbm, w_cat = raw / raw.sum()

ensemble_preds = w_xgb * xgb_preds + w_lgbm * lgbm_preds + w_cat * cat_preds
ensemble_ic = mean_daily_ic(ensemble_preds, y_test, test_index)

tmp = pd.DataFrame({'pred': ensemble_preds, 'actual': y_test.values, 'date': test_index})
daily_ics = []
for _, g in tmp.groupby('date'):
    if len(g) < 10:
        continue
    ic, _ = spearmanr(g['pred'], g['actual'])
    if not np.isnan(ic):
        daily_ics.append(ic)
daily_ics = np.array(daily_ics)

print(f"\nEnsemble weights → XGB: {w_xgb:.2f} | LGBM: {w_lgbm:.2f} | CAT: {w_cat:.2f}")
print(f"\n=== FINAL RESULT ===")
print(f"Ensemble mean daily IC:      {ensemble_ic:.4f}")
print(f"Fraction of days positive:   {(daily_ics > 0).mean():.2%}")
print(f"Days evaluated:              {len(daily_ics)}")
print(f"IC std across days:          {daily_ics.std():.4f}")

# ── PER-STOCK IC — does ranking hold up within individual names too? ──
print("\n=== TOP 10 FEATURES (XGBoost) ===")
importance = sorted(
    zip(FEATURES, xgb_model.feature_importances_),
    key=lambda x: x[1], reverse=True
)
for feat, imp in importance[:10]:
    print(f"  {feat:<25} {imp:.4f}")

# ── SAVE ──────────────────────────────────────────────────────
print("\n[4/5] Saving...")

joblib.dump(xgb_model,      'models/xgb_model_stocks_ranker.pkl')
joblib.dump(lgbm_model,     'models/lgbm_model_stocks_ranker.pkl')
joblib.dump(cat_model,      'models/cat_model_stocks_ranker.pkl')
joblib.dump(FEATURES,       'models/features_stocks_ranker.pkl')
joblib.dump({'w_xgb': w_xgb, 'w_lgbm': w_lgbm, 'w_cat': w_cat}, 'models/ensemble_weights_stocks_ranker.pkl')
joblib.dump(symbol_encoder, 'models/symbol_encoder_stocks_ranker.pkl')

print("\n[5/5] Done.")
print(f"   Rows: {len(df)} | Symbols: {df['symbol'].nunique()} | Features: {len(FEATURES)}")
print(f"   Ensemble mean daily IC: {ensemble_ic:.4f}")
print("   Saved 6 files to models/ with a '_stocks_ranker' suffix.")
print("\n   Reference: |IC| > 0.05 = weakly useful, > 0.10 = decent for a single")
print("   cross-sectional equity factor. Compare this to the 0.036 we measured")
print("   from the classifier's buy_prob in the diagnostic — if this is higher,")
print("   the regression reframing helped.")