"""
diagnose_model_stocks.py

Run this AFTER train_model_stocks.py to sanity-check what's actually going on
with the 54.4% ensemble accuracy result. Answers two questions:

1. Is each stock's accuracy actually bad, or just bad relative to a POOLED
   baseline that doesn't reflect that stock's own class balance?
2. Even if BUY/HOLD classification is weak, does the model's predicted
   probability still RANK stocks usefully by forward return? This is the
   metric that actually matters for building the 3 strategies — we need
   relative ranking, not a perfect binary call.

Loads the saved models/data from train_model_stocks.py — doesn't retrain
anything, just re-evaluates.
"""

import pandas as pd
import numpy as np
import joblib
from scipy.stats import spearmanr

print("=" * 60)
print("DIAGNOSTIC — Nifty 50 pooled model")
print("=" * 60)

# ── LOAD SAME DATA + SAME SPLIT AS TRAINING ──────────────────
df = pd.read_csv('data/nifty50_features.csv', index_col=0, parse_dates=True)
df = df.dropna()

symbol_encoder = joblib.load('models/symbol_encoder_stocks.pkl')
df['symbol_id'] = symbol_encoder.transform(df['symbol'])

FEATURES = joblib.load('models/features_stocks.pkl')
weights  = joblib.load('models/ensemble_weights_stocks.pkl')

xgb_model  = joblib.load('models/xgb_model_stocks.pkl')
lgbm_model = joblib.load('models/lgbm_model_stocks.pkl')
cat_model  = joblib.load('models/cat_model_stocks.pkl')

unique_dates = np.sort(df.index.unique())
split_date = unique_dates[int(len(unique_dates) * 0.8)]
test_mask = df.index >= split_date
test_df = df[test_mask].copy()

X_test = test_df[FEATURES]
y_test = test_df['label']

# ── REGENERATE ENSEMBLE PREDICTIONS ──────────────────────────
xgb_probs  = xgb_model.predict_proba(X_test)
lgbm_probs = lgbm_model.predict_proba(X_test)
cat_probs  = cat_model.predict_proba(X_test)

ensemble_probs = (
    weights['w_xgb']  * xgb_probs +
    weights['w_lgbm'] * lgbm_probs +
    weights['w_cat']  * cat_probs
)
test_df['buy_prob'] = ensemble_probs[:, 1]
test_df['pred']     = np.argmax(ensemble_probs, axis=1)
test_df['correct']  = (test_df['pred'] == test_df['label']).astype(int)

overall_acc = test_df['correct'].mean()
print(f"\nOverall ensemble accuracy: {overall_acc:.4f}")

# ── QUESTION 1: accuracy vs EACH STOCK'S OWN baseline ────────
print("\n" + "=" * 60)
print("Q1: Per-stock accuracy vs. that stock's OWN majority-class baseline")
print("=" * 60)

rows = []
for sym, g in test_df.groupby('symbol'):
    own_baseline = g['label'].value_counts(normalize=True).max()
    model_acc    = g['correct'].mean()
    rows.append({
        'symbol': sym,
        'n': len(g),
        'own_baseline': own_baseline,
        'model_acc': model_acc,
        'beats_baseline': model_acc > own_baseline,
    })

diag = pd.DataFrame(rows).sort_values('model_acc')
n_beats = diag['beats_baseline'].sum()
print(f"\nStocks where model BEATS its own baseline: {n_beats} / {len(diag)}")
print(f"Stocks where model UNDERPERFORMS its own baseline: {len(diag) - n_beats} / {len(diag)}")
print("\nWorst 10 (model_acc - own_baseline, most negative first):")
diag['edge'] = diag['model_acc'] - diag['own_baseline']
print(diag.sort_values('edge')[['symbol', 'n', 'own_baseline', 'model_acc', 'edge']].head(10).to_string(index=False))
print("\nBest 10:")
print(diag.sort_values('edge', ascending=False)[['symbol', 'n', 'own_baseline', 'model_acc', 'edge']].head(10).to_string(index=False))

# ── QUESTION 2: does buy_prob RANK stocks usefully by forward return? ─
print("\n" + "=" * 60)
print("Q2: Cross-sectional rank correlation (buy_prob vs. actual future_return)")
print("=" * 60)
print("This is computed PER DATE (comparing all ~49 stocks against each other")
print("on that day), then averaged — this is the actual 'stock picking' signal,")
print("independent of whether the BUY/HOLD threshold call is right.\n")

if 'future_return' not in test_df.columns:
    print("⚠️  'future_return' column not found — can't compute this. Make sure")
    print("   data_pipeline_stocks.py didn't drop it (it shouldn't — only")
    print("   'vol_threshold' gets dropped).")
else:
    daily_ic = []
    for date, g in test_df.groupby(test_df.index):
        if len(g) < 10:  # need enough stocks on that date for ranking to mean anything
            continue
        ic, _ = spearmanr(g['buy_prob'], g['future_return'])
        if not np.isnan(ic):
            daily_ic.append(ic)

    daily_ic = np.array(daily_ic)
    mean_ic = daily_ic.mean()
    pct_positive = (daily_ic > 0).mean()

    print(f"Mean daily Information Coefficient (Spearman): {mean_ic:.4f}")
    print(f"Fraction of days with positive IC:              {pct_positive:.2%}")
    print(f"Days evaluated:                                 {len(daily_ic)}")
    print()
    print("Rule of thumb in quant research: |IC| > 0.05 is considered weakly")
    print("useful, > 0.10 is decent for single-factor equity signals. Negative")
    print("or near-zero IC means the model isn't ranking stocks usefully either.")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
