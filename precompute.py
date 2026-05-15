"""
precompute.py — Run this ONCE from ALGO-TRADING/backend/ folder.
Saves all heavy computation to ../data/cache/ so backend starts instantly.

Usage:
    cd ALGO-TRADING/backend
    python precompute.py
"""

import os, json, warnings
import numpy as np
import pandas as pd
import joblib
import shap

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────
CACHE_DIR = "data/cache"
os.makedirs(CACHE_DIR, exist_ok=True)

SHAP_CACHE_PATH   = f"{CACHE_DIR}/shap_cache.json"
CLIENT_CACHE_PATH = f"{CACHE_DIR}/client_cache.json"
SIGNAL_CACHE_PATH = f"{CACHE_DIR}/signal_cache.json"

# ── Load models (exact paths from your main.py) ────────────────
print("[PRECOMPUTE] Loading models...")
model      = joblib.load("models/xgb_model.pkl")
lgbm_model = joblib.load("models/lgbm_model.pkl")
cat_model  = joblib.load("models/cat_model.pkl")
le         = joblib.load("models/label_encoder.pkl")
FEATURES   = joblib.load("models/features.pkl")
weights    = joblib.load("models/ensemble_weights.pkl")
w_xgb      = weights['w_xgb']
w_lgbm     = weights['w_lgbm']
w_cat      = weights['w_cat']

# ── Load data (exact paths from your main.py) ──────────────────
print("[PRECOMPUTE] Loading data...")
df        = pd.read_csv("data/nsei_features.csv", index_col=0, parse_dates=True)
portfolio = pd.read_csv("data/portfolio.csv", index_col=0, parse_dates=True)
trades    = pd.read_csv("data/trades_log.csv")
trades    = trades.fillna("")
trades['pnl']        = pd.to_numeric(trades['pnl'], errors='coerce').fillna(0)
trades['confidence'] = pd.to_numeric(trades['confidence'], errors='coerce').fillna(0)
print(f"[PRECOMPUTE] Loaded {len(df)} rows.")

# ── Ensemble helpers (exact copy from your main.py) ────────────
def ensemble_proba(X):
    p1 = model.predict_proba(X)
    p2 = lgbm_model.predict_proba(X)
    p3 = cat_model.predict_proba(X)
    return w_xgb * p1 + w_lgbm * p2 + w_cat * p3

def ensemble_predict(X):
    probs    = ensemble_proba(X)
    buy_prob = probs[:, 1]
    signals  = []
    for bp in buy_prob:
        if bp >= 0.55:  
            signals.append(1)
        elif bp <= 0.35: 
            signals.append(-1)
        else:           
            signals.append(0)
    return np.array(signals), probs.max(axis=1), probs

# ── 1. SHAP (exact logic from your main.py) ────────────────────
print("[PRECOMPUTE] Computing SHAP values...")
explainer   = shap.TreeExplainer(model)
shap_values = explainer.shap_values(df[FEATURES].tail(100))
latest_shap = explainer.shap_values(df[FEATURES].iloc[-1:])
pred        = int(model.predict(df[FEATURES].iloc[-1:])[0])
sv = np.array(latest_shap[pred] if isinstance(latest_shap, list) else latest_shap).flatten()
gv = np.abs(np.array(shap_values[0] if isinstance(shap_values, list) else shap_values)).mean(axis=0).flatten()

shap_cache = {
    "latest_signal_explanation": sorted(
        [{"feature": f, "shap_value": round(float(sv[i]), 4),
          "abs_value": round(abs(float(sv[i])), 4),
          "direction": "positive" if sv[i] > 0 else "negative"}
         for i, f in enumerate(FEATURES)],
        key=lambda x: x["abs_value"], reverse=True
    ),
    "global_importance": sorted(
        [{"feature": f, "importance": round(float(gv[i]), 4)}
         for i, f in enumerate(FEATURES)],
        key=lambda x: x["importance"], reverse=True
    ),
    "predicted_class": pred
}
with open(SHAP_CACHE_PATH, "w") as f:
    json.dump(shap_cache, f)
print("[PRECOMPUTE] SHAP cached.")

# ── 2. Latest signal ───────────────────────────────────────────
print("[PRECOMPUTE] Computing latest signal...")
signals, confs, probs = ensemble_predict(df[FEATURES].iloc[-1:])
signal_cache = {
    "signal":     {1: "BUY", -1: "SELL", 0: "HOLD"}.get(int(signals[0]), "HOLD"),
    "confidence": round(float(confs[0]) * 100, 2),
    "buy_prob":   round(float(probs[0][1]) * 100, 2),
    "date":       str(df.index[-1].date()),
    "close":      round(float(df['Close'].iloc[-1]), 2),
}
with open(SIGNAL_CACHE_PATH, "w") as f:
    json.dump(signal_cache, f)
print("[PRECOMPUTE] Signal cached.")

# ── 3. Client portfolios (exact logic from your main.py) ───────
def simulate_client_trades(confidence_threshold, position_fraction, stop_loss_pct, max_hold_days):
    capital, position = 100000.0, None
    portfolio_val = [{"date": str(df.index[0].date()), "value": 100000.0}]
    client_trades = []

    for i in range(1, len(df)):
        signals, confs, probs = ensemble_predict(df[FEATURES].iloc[[i]])
        conf     = float(confs[0])
        buy_prob = float(probs[0][1])
        action   = {1: "BUY", -1: "SELL", 0: "HOLD"}.get(int(signals[0]), "HOLD")
        price    = float(df['Close'].iloc[i])
        date     = str(df.index[i].date())

        if position is None:
            if action == "BUY" and buy_prob >= confidence_threshold:
                qty = int((capital * position_fraction) / price)
                if qty > 0:
                    position = {"entry_price": price, "qty": qty,
                                "entry_date": date, "entry_idx": i}
                    capital -= qty * price
                    client_trades.append({
                        "date": date, "action": "BUY",
                        "price": round(price, 2), "qty": qty,
                        "pnl": 0, "confidence": round(conf, 4)
                    })
        else:
            stop_hit = price <= position["entry_price"] * (1 - stop_loss_pct)
            max_hit  = (i - position["entry_idx"]) >= max_hold_days
            if action == "SELL" or stop_hit or max_hit:
                pnl     = (price - position["entry_price"]) * position["qty"]
                capital += position["qty"] * price
                client_trades.append({
                    "date": date, "action": "SELL",
                    "price": round(price, 2), "qty": position["qty"],
                    "pnl": round(pnl, 2), "confidence": round(conf, 4),
                    "exit_type": "stop_loss" if stop_hit else "max_hold" if max_hit else "signal"
                })
                position = None

        portfolio_val.append({
            "date": date,
            "value": round(capital + (position["qty"] * price if position else 0), 2)
        })

    return client_trades, portfolio_val

print("[PRECOMPUTE] Simulating QUANT client (conf=55%, pos=95%, sl=3%, hold=30d)...")
quant_trades, quant_portfolio = simulate_client_trades(0.55, 0.95, 0.03, 30)
print(f"[PRECOMPUTE] QUANT done — {len(quant_trades)} trades.")

print("[PRECOMPUTE] Simulating MACRO client (conf=65%, pos=60%, sl=1.5%, hold=15d)...")
macro_trades, macro_portfolio = simulate_client_trades(0.65, 0.60, 0.015, 15)
print(f"[PRECOMPUTE] MACRO done — {len(macro_trades)} trades.")

with open(CLIENT_CACHE_PATH, "w") as f:
    json.dump({
        "quant_trades":    quant_trades,
        "quant_portfolio": quant_portfolio,
        "macro_trades":    macro_trades,
        "macro_portfolio": macro_portfolio,
    }, f)
print("[PRECOMPUTE] Client portfolios cached.")

# ── 4. Stats (from portfolio.csv + trades_log.csv) ─────────────
print("[PRECOMPUTE] Computing stats...")
initial = 100000
final   = round(float(portfolio['value'].iloc[-1]), 2)
st      = trades[trades['action'] == 'SELL']
wins    = len(st[st['pnl'] > 0])
losses  = len(st[st['pnl'] <= 0])
ts      = wins + losses
stats_cache = {
    "initial_capital": initial,
    "final_value":     final,
    "total_return":    round((final - initial) / initial * 100, 2),
    "total_trades":    len(trades),
    "wins":            wins,
    "losses":          losses,
    "win_rate":        round(wins / ts * 100, 1) if ts > 0 else 0,
}
with open(f"{CACHE_DIR}/stats_cache.json", "w") as f:
    json.dump(stats_cache, f)
print("[PRECOMPUTE] Stats cached.")

# ── 5. PnL summary ─────────────────────────────────────────────
print("[PRECOMPUTE] Computing PnL...")
st2 = trades[trades['pnl'] != 0]
ll  = trades['log'].replace("", float('nan')).dropna().iloc[-1] \
      if 'log' in trades.columns and len(trades) > 0 else ""
pnl_cache = {
    "cumulative_pnl": round(float(st2['pnl'].sum()), 2),
    "best_trade":     round(float(st2['pnl'].max()), 2) if len(st2) > 0 else 0,
    "worst_trade":    round(float(st2['pnl'].min()), 2) if len(st2) > 0 else 0,
    "avg_trade":      round(float(st2['pnl'].mean()), 2) if len(st2) > 0 else 0,
    "last_log":       ll,
}
with open(f"{CACHE_DIR}/pnl_cache.json", "w") as f:
    json.dump(pnl_cache, f)
print("[PRECOMPUTE] PnL cached.")

# ── 6. Indicators (exact columns from your main.py) ────────────
print("[PRECOMPUTE] Computing indicators...")
ind_data = df[['Close', 'rsi', 'bb_upper', 'bb_lower', 'sma20', 'sma50']].tail(100).copy()
ind_data.index.name = 'date'
ind_data = ind_data.reset_index()
ind_data['date'] = ind_data['date'].astype(str)
with open(f"{CACHE_DIR}/indicators_cache.json", "w") as f:
    json.dump(ind_data.to_dict(orient="records"), f)
print("[PRECOMPUTE] Indicators cached.")

# ── 7. Psychology (exact logic from your main.py) ──────────────
print("[PRECOMPUTE] Computing psychology...")
st3 = trades[trades['pnl'] != 0].copy()
if len(st3) > 0:
    recent = st3['pnl'].tail(5).tolist()
    cl = 0
    for p in reversed(recent):
        if p < 0:
            cl += 1
        else: 
            break
    peak = portfolio['value'].max()
    cur  = portfolio['value'].iloc[-1]
    dd   = round((peak - cur) / peak * 100, 2)
    rw   = round(sum(1 for p in recent if p > 0) / len(recent) * 100, 1) if recent else 0
    cs   = round(float(trades['confidence'].tail(5).mean()) * 100, 2)

    score = 100 - [0, 10, 25, 40, 60][min(cl, 4)]
    if dd > 10:  
        score -= 30
    elif dd > 5: 
        score -= 20
    elif dd > 2: 
        score -= 10
    if rw < 20:  
        score -= 30
    elif rw < 40:
        score -= 15
    if cs < 50:  
        score -= 10
    score = max(0, min(100, score))

    alerts = []
    if cl >= 3:  
        alerts.append("🚨 Revenge trading risk — 3+ consecutive losses detected")
    elif cl == 2: 
        alerts.append("⚠️ 2 losses in a row — recency bias may affect next decision")
    if dd > 5:   
        alerts.append(f"🔴 Portfolio down {dd}% from peak")
    elif dd > 2: 
        alerts.append(f"🟡 Drawdown of {dd}% detected")
    if rw < 40:  
        alerts.append("📉 Win rate below 40% in last 5 trades")
    if cs < 50:  
        alerts.append("🤔 Model confidence dropping")

    if score >= 80:  
        s, m, c = "HEALTHY",     "You're trading well. Continue normally.",            "#22c55e"
    elif score >= 50: 
        s, m, c = "CAUTION",      "Signs of emotional stress. Consider reducing size.", "#f59e0b"
    elif score >= 20:
        s, m, c = "HIGH RISK",    "High emotional risk. Consider pausing.",             "#ef4444"
    else:           
        s, m, c = "STOP TRADING", "Critical state. Stop trading now.",                  "#dc2626"

    psych_cache = {
        "score": score, "status": s, "message": m, "color": c,
        "consecutive_losses": cl, "drawdown_pct": dd,
        "recent_winrate": rw, "conf_score": cs, "alerts": alerts
    }
else:
    psych_cache = {"score": 100, "status": "HEALTHY", "message": "No trades yet.", "alerts": []}

with open(f"{CACHE_DIR}/psychology_cache.json", "w") as f:
    json.dump(psych_cache, f)
print("[PRECOMPUTE] Psychology cached.")

# ── 8. Portfolio (for /portfolio endpoint) ─────────────────────
print("[PRECOMPUTE] Caching portfolio...")
port_data = portfolio.reset_index()
port_data['date'] = port_data['date'].astype(str)
with open(f"{CACHE_DIR}/portfolio_cache.json", "w") as f:
    json.dump(port_data.to_dict(orient="records"), f)
print("[PRECOMPUTE] Portfolio cached.")

# ── 9. Trades log (for /trades endpoint) ──────────────────────
print("[PRECOMPUTE] Caching trades log...")
with open(f"{CACHE_DIR}/trades_cache.json", "w") as f:
    json.dump(trades.tail(20).to_dict(orient="records"), f)
print("[PRECOMPUTE] Trades cached.")

print("\n✅ ALL DONE. Cache written to ../data/cache/")
print("   shap_cache, signal_cache, client_cache, stats_cache,")
print("   pnl_cache, indicators_cache, psychology_cache,")
print("   portfolio_cache, trades_cache")
print("\n   Backend will now start in < 5 seconds every time.")
print("   Run: python -m uvicorn main:app --port 8000")