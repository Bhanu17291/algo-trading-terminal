"""
main.py — FAST VERSION
All heavy computation moved to precompute.py (run once).
Startup is instant — reads JSON cache only.
All original endpoints preserved exactly.
Live signal refreshes every 5 min during market hours only (not every 1 min always).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
import pandas as pd
import numpy as np
import joblib
import pytz
import shap
from datetime import datetime
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load models (needed only for live signal refresh + walk-forward) ─────────
model      = joblib.load("../models/xgb_model.pkl")
lgbm_model = joblib.load("../models/lgbm_model.pkl")
cat_model  = joblib.load("../models/cat_model.pkl")
le         = joblib.load("../models/label_encoder.pkl")
FEATURES   = joblib.load("../models/features.pkl")
weights    = joblib.load("../models/ensemble_weights.pkl")
w_xgb      = weights['w_xgb']
w_lgbm     = weights['w_lgbm']
w_cat      = weights['w_cat']

# ── Load data ─────────────────────────────────────────────────
df        = pd.read_csv("../data/nsei_features.csv", index_col=0, parse_dates=True)
portfolio = pd.read_csv("../data/portfolio.csv", index_col=0, parse_dates=True)
trades    = pd.read_csv("../data/trades_log.csv")
trades    = trades.fillna("")
trades['pnl']        = pd.to_numeric(trades['pnl'], errors='coerce').fillna(0)
trades['confidence'] = pd.to_numeric(trades['confidence'], errors='coerce').fillna(0)

# ── Cache paths ───────────────────────────────────────────────
CACHE_DIR         = "../data/cache"
SHAP_CACHE_PATH   = f"{CACHE_DIR}/shap_cache.json"
CLIENT_CACHE_PATH = f"{CACHE_DIR}/client_cache.json"
SIGNAL_CACHE_PATH = f"{CACHE_DIR}/signal_cache.json"
os.makedirs(CACHE_DIR, exist_ok=True)

# ── Ensemble helpers ──────────────────────────────────────────
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
        if bp >= 0.55:   signals.append(1)
        elif bp <= 0.35: signals.append(-1)
        else:            signals.append(0)
    return np.array(signals), probs.max(axis=1), probs

# ── Load SHAP from cache (instant) ────────────────────────────
if os.path.exists(SHAP_CACHE_PATH):
    print("[STARTUP] Loading SHAP from cache...")
    with open(SHAP_CACHE_PATH) as f:
        _shap_cache = json.load(f)
    print("[STARTUP] SHAP ready.")
else:
    print("[STARTUP] No SHAP cache found — run precompute.py first!")
    print("[STARTUP] Computing SHAP now (one-time)...")
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(df[FEATURES].tail(100))
    latest_shap = explainer.shap_values(df[FEATURES].iloc[-1:])
    pred        = int(model.predict(df[FEATURES].iloc[-1:])[0])
    sv = np.array(latest_shap[pred] if isinstance(latest_shap, list) else latest_shap).flatten()
    gv = np.abs(np.array(shap_values[0] if isinstance(shap_values, list) else shap_values)).mean(axis=0).flatten()
    _shap_cache = {
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
        json.dump(_shap_cache, f)
    print("[STARTUP] SHAP ready.")

# ── Load client portfolios from cache (instant) ───────────────
if os.path.exists(CLIENT_CACHE_PATH):
    print("[STARTUP] Loading client portfolios from cache...")
    with open(CLIENT_CACHE_PATH) as f:
        _c = json.load(f)
    _quant_trades    = _c["quant_trades"]
    _quant_portfolio = _c["quant_portfolio"]
    _macro_trades    = _c["macro_trades"]
    _macro_portfolio = _c["macro_portfolio"]
    print("[STARTUP] Client portfolios ready.")
else:
    print("[STARTUP] No client cache found — run precompute.py first!")
    print("[STARTUP] Simulating client portfolios (one-time)...")

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
                        client_trades.append({"date": date, "action": "BUY",
                            "price": round(price, 2), "qty": qty,
                            "pnl": 0, "confidence": round(conf, 4)})
            else:
                stop_hit = price <= position["entry_price"] * (1 - stop_loss_pct)
                max_hit  = (i - position["entry_idx"]) >= max_hold_days
                if action == "SELL" or stop_hit or max_hit:
                    pnl     = (price - position["entry_price"]) * position["qty"]
                    capital += position["qty"] * price
                    client_trades.append({"date": date, "action": "SELL",
                        "price": round(price, 2), "qty": position["qty"],
                        "pnl": round(pnl, 2), "confidence": round(conf, 4),
                        "exit_type": "stop_loss" if stop_hit else "max_hold" if max_hit else "signal"})
                    position = None
            portfolio_val.append({"date": date,
                "value": round(capital + (position["qty"] * price if position else 0), 2)})
        return client_trades, portfolio_val

    _quant_trades, _quant_portfolio = simulate_client_trades(0.55, 0.95, 0.03, 30)
    _macro_trades, _macro_portfolio = simulate_client_trades(0.65, 0.60, 0.015, 15)
    with open(CLIENT_CACHE_PATH, "w") as f:
        json.dump({"quant_trades": _quant_trades, "quant_portfolio": _quant_portfolio,
                   "macro_trades": _macro_trades, "macro_portfolio": _macro_portfolio}, f)
    print("[STARTUP] Client portfolios cached.")

def get_client_data():
    return _quant_trades, _quant_portfolio, _macro_trades, _macro_portfolio

# ── Market status + live trading loop ────────────────────────
IST      = pytz.timezone("Asia/Kolkata")
live_log = []

def is_market_open():
    now = datetime.now(IST)
    if now.weekday() >= 5: return False
    return now.replace(hour=9, minute=15, second=0) <= now <= now.replace(hour=15, minute=30, second=0)

def run_trading_loop():
    """Runs every 5 min, skips if market is closed."""
    try:
        if not is_market_open():
            print(f"[{datetime.now(IST).strftime('%H:%M:%S')}] Market closed — skipping")
            return
        signals, confs, _ = ensemble_predict(df[FEATURES].iloc[-1:])
        conf   = round(float(confs[0]), 3)
        action = {1: "BUY", -1: "SELL", 0: "HOLD"}.get(int(signals[0]), "HOLD")
        price  = round(float(df['Close'].iloc[-1]), 2)
        log    = f"ML → {action} (p={conf}) | price={price} | time={datetime.now(IST).strftime('%H:%M:%S')}"
        print(log)
        live_log.append({"time": datetime.now(IST).strftime("%H:%M:%S"),
                          "action": action, "confidence": conf,
                          "price": price, "log": log})
        if len(live_log) > 50:
            live_log.pop(0)
    except Exception as e:
        print(f"[run_trading_loop ERROR] {e}")

# ── Scheduler: every 5 min (was 1 min), skips when market closed ─
scheduler = BackgroundScheduler()
scheduler.add_job(run_trading_loop, 'interval', minutes=5, max_instances=1, coalesce=True)
scheduler.start()

# ═══════════════════════════════════════════════════════════════
# ENDPOINTS — all identical to your original main.py
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ALGO TRADING API running"}

@app.get("/signal")
def get_latest_signal():
    # Serve from cache if available, else compute live
    if os.path.exists(SIGNAL_CACHE_PATH):
        with open(SIGNAL_CACHE_PATH) as f:
            return json.load(f)
    signals, confs, probs = ensemble_predict(df[FEATURES].iloc[-1:])
    return {
        "signal":     {1: "BUY", -1: "SELL", 0: "HOLD"}.get(int(signals[0]), "HOLD"),
        "confidence": round(float(confs[0]) * 100, 2),
        "buy_prob":   round(float(probs[0][1]) * 100, 2),
        "date":       str(df.index[-1].date()),
        "close":      round(float(df['Close'].iloc[-1]), 2),
    }

@app.get("/portfolio")
def get_portfolio():
    # Serve from cache if available
    cache_path = f"{CACHE_DIR}/portfolio_cache.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    data = portfolio.reset_index()
    data['date'] = data['date'].astype(str)
    return data.to_dict(orient="records")

@app.get("/trades")
def get_trades():
    cache_path = f"{CACHE_DIR}/trades_cache.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    return trades.tail(20).to_dict(orient="records")

@app.get("/stats")
def get_stats():
    cache_path = f"{CACHE_DIR}/stats_cache.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    initial = 100000
    final   = round(float(portfolio['value'].iloc[-1]), 2)
    st      = trades[trades['action'] == 'SELL']
    wins    = len(st[st['pnl'] > 0])
    losses  = len(st[st['pnl'] <= 0])
    ts      = wins + losses
    return {"initial_capital": initial, "final_value": final,
            "total_return": round((final - initial) / initial * 100, 2),
            "total_trades": len(trades), "wins": wins, "losses": losses,
            "win_rate": round(wins / ts * 100, 1) if ts > 0 else 0}

@app.get("/pnl")
def get_pnl():
    cache_path = f"{CACHE_DIR}/pnl_cache.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    st = trades[trades['pnl'] != 0]
    ll = trades['log'].replace("", float('nan')).dropna().iloc[-1] \
         if 'log' in trades.columns else ""
    return {
        "cumulative_pnl": round(float(st['pnl'].sum()), 2),
        "best_trade":     round(float(st['pnl'].max()), 2) if len(st) > 0 else 0,
        "worst_trade":    round(float(st['pnl'].min()), 2) if len(st) > 0 else 0,
        "avg_trade":      round(float(st['pnl'].mean()), 2) if len(st) > 0 else 0,
        "last_log":       ll,
    }

@app.get("/live-log")
def get_live_log():
    return live_log[-10:]

@app.get("/market-status")
def market_status():
    now = datetime.now(IST)
    return {"is_open": is_market_open(),
            "current_time_ist": now.strftime("%H:%M:%S"),
            "status": "OPEN" if is_market_open() else "CLOSED"}

@app.get("/indicators")
def get_indicators():
    cache_path = f"{CACHE_DIR}/indicators_cache.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    data = df[['Close', 'rsi', 'bb_upper', 'bb_lower', 'sma20', 'sma50']].tail(100).copy()
    data.index.name = 'date'
    data = data.reset_index()
    data['date'] = data['date'].astype(str)
    return data.to_dict(orient="records")

@app.get("/psychology")
def get_psychology():
    cache_path = f"{CACHE_DIR}/psychology_cache.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    # Fallback: compute live (exact original logic)
    st = trades[trades['pnl'] != 0].copy()
    if len(st) == 0:
        return {"score": 100, "status": "HEALTHY", "message": "No trades yet.", "alerts": []}
    recent = st['pnl'].tail(5).tolist()
    cl = 0
    for p in reversed(recent):
        if p < 0: cl += 1
        else: break
    peak = portfolio['value'].max()
    cur  = portfolio['value'].iloc[-1]
    dd   = round((peak - cur) / peak * 100, 2)
    rw   = round(sum(1 for p in recent if p > 0) / len(recent) * 100, 1) if recent else 0
    cs   = round(float(trades['confidence'].tail(5).mean()) * 100, 2)
    score = 100 - [0, 10, 25, 40, 60][min(cl, 4)]
    if dd > 10:   score -= 30
    elif dd > 5:  score -= 20
    elif dd > 2:  score -= 10
    if rw < 20:   score -= 30
    elif rw < 40: score -= 15
    if cs < 50:   score -= 10
    score = max(0, min(100, score))
    alerts = []
    if cl >= 3:   alerts.append("🚨 Revenge trading risk — 3+ consecutive losses detected")
    elif cl == 2: alerts.append("⚠️ 2 losses in a row — recency bias may affect next decision")
    if dd > 5:    alerts.append(f"🔴 Portfolio down {dd}% from peak")
    elif dd > 2:  alerts.append(f"🟡 Drawdown of {dd}% detected")
    if rw < 40:   alerts.append("📉 Win rate below 40% in last 5 trades")
    if cs < 50:   alerts.append("🤔 Model confidence dropping")
    if score >= 80:   s, m, c = "HEALTHY",     "You're trading well. Continue normally.",            "#22c55e"
    elif score >= 50: s, m, c = "CAUTION",      "Signs of emotional stress. Consider reducing size.", "#f59e0b"
    elif score >= 20: s, m, c = "HIGH RISK",    "High emotional risk. Consider pausing.",             "#ef4444"
    else:             s, m, c = "STOP TRADING", "Critical state. Stop trading now.",                  "#dc2626"
    return {"score": score, "status": s, "message": m, "color": c,
            "consecutive_losses": cl, "drawdown_pct": dd,
            "recent_winrate": rw, "conf_score": cs, "alerts": alerts}

@app.get("/shap")
def get_shap():
    return _shap_cache

# ── Walk-forward (unchanged from your original) ───────────────
def run_walk_forward_engine():
    from xgboost import XGBClassifier
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import accuracy_score
    data, n, min_train, test_size = df.dropna(), len(df.dropna()), 500, 200
    windows, all_equity, wn, cursor = [], [], 1, min_train
    while cursor + test_size <= n:
        tr, te = data.iloc[0:cursor], data.iloc[cursor:cursor + test_size]
        wle = LabelEncoder()
        ytr = wle.fit_transform(tr['label'])
        yte = wle.transform(te['label'])
        wm  = XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05,
                             eval_metric='logloss', random_state=42)
        wm.fit(tr[FEATURES], ytr)
        probs = wm.predict_proba(te[FEATURES])
        bp    = probs[:, 1]
        acc   = round(accuracy_score(yte, (bp >= 0.5).astype(int)) * 100, 2)
        cap, pos, wt, eq = 100000.0, None, [], []
        for i in range(len(te)):
            bpi   = float(bp[i])
            conf  = float(probs[i].max())
            price = float(te['Close'].iloc[i])
            date  = str(te.index[i].date())
            sig   = "BUY" if bpi >= 0.55 else "SELL" if bpi <= 0.35 else "HOLD"
            if pos is None:
                if sig == "BUY" and conf >= 0.55:
                    qty = int((cap * 0.95) / price)
                    if qty > 0:
                        pos = {"entry_price": price, "qty": qty, "entry_idx": i}
                        cap -= qty * price
                        wt.append({"date": date, "action": "BUY", "price": round(price, 2),
                                   "qty": qty, "pnl": 0, "conf": round(conf, 4)})
            else:
                sh = price <= pos["entry_price"] * 0.97
                mh = (i - pos["entry_idx"]) >= 20
                if sig == "SELL" or sh or mh:
                    pnl = (price - pos["entry_price"]) * pos["qty"]
                    cap += pos["qty"] * price
                    wt.append({"date": date, "action": "SELL", "price": round(price, 2),
                               "qty": pos["qty"], "pnl": round(pnl, 2), "conf": round(conf, 4),
                               "exit_type": "stop_loss" if sh else "max_hold" if mh else "signal"})
                    pos = None
            eq.append({"date": date, "value": round(cap + (pos["qty"] * price if pos else 0), 2)})
        sells = [t for t in wt if t["action"] == "SELL"]
        wins2 = [t for t in sells if t["pnl"] > 0]
        fv    = eq[-1]["value"] if eq else 100000
        ret   = round((fv - 100000) / 100000 * 100, 2)
        pk, mdd = 100000, 0.0
        for e in eq:
            if e["value"] > pk: pk = e["value"]
            mdd = max(mdd, (pk - e["value"]) / pk * 100)
        nr = round((float(te['Close'].iloc[-1]) - float(te['Close'].iloc[0])) /
                   float(te['Close'].iloc[0]) * 100, 2)
        windows.append({
            "window": wn,
            "train_period": f"{str(tr.index[0].date())} → {str(tr.index[-1].date())}",
            "test_period":  f"{str(te.index[0].date())} → {str(te.index[-1].date())}",
            "train_rows": len(tr), "test_rows": len(te), "accuracy": acc,
            "total_trades": len(wt), "wins": len(wins2),
            "losses": len(sells) - len(wins2),
            "win_rate": round(len(wins2) / len(sells) * 100, 1) if sells else 0,
            "return_pct": ret, "nsei_return": nr, "alpha": round(ret - nr, 2),
            "max_drawdown": round(mdd, 2), "final_value": fv, "equity": eq, "trades": wt
        })
        all_equity.extend(eq)
        cursor += test_size
        wn += 1
    result = {
        "summary": {
            "total_windows":      len(windows),
            "total_return":       round((windows[-1]["final_value"] - 100000) / 100000 * 100, 2) if windows else 0,
            "avg_accuracy":       round(sum(w["accuracy"] for w in windows) / len(windows), 2) if windows else 0,
            "avg_win_rate":       round(sum(w["win_rate"] for w in windows) / len(windows), 2) if windows else 0,
            "avg_alpha":          round(sum(w["alpha"] for w in windows) / len(windows), 2) if windows else 0,
            "avg_drawdown":       round(sum(w["max_drawdown"] for w in windows) / len(windows), 2) if windows else 0,
            "total_trades":       sum(w["total_trades"] for w in windows),
            "windows_profitable": sum(1 for w in windows if w["return_pct"] > 0),
        },
        "windows": windows,
        "equity":  all_equity,
    }
    with open("../data/walkforward_results.json", "w") as f:
        json.dump(result, f)
    return result

@app.get("/walkforward")
def get_walkforward():
    p = "../data/walkforward_results.json"
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return {"error": "not_run"}

@app.post("/walkforward/run")
def trigger_walkforward():
    r = run_walk_forward_engine()
    return {"status": "complete", "windows": r["summary"]["total_windows"],
            "alpha": r["summary"]["avg_alpha"]}

# ── Clients (unchanged from your original) ────────────────────
def calc_stats(tl, pl):
    initial = 100000
    final   = pl[-1]["value"] if pl else initial
    sells   = [t for t in tl if t["action"] == "SELL"]
    wins2   = [t for t in sells if t["pnl"] > 0]
    pk, mdd = initial, 0.0
    for r in pl:
        if r["value"] > pk: pk = r["value"]
        mdd = max(mdd, (pk - r["value"]) / pk * 100)
    return {
        "initial_capital": initial,
        "final_value":     round(final, 2),
        "total_return":    round((final - initial) / initial * 100, 2),
        "total_trades":    len(tl),
        "wins":            len(wins2),
        "losses":          len(sells) - len(wins2),
        "win_rate":        round(len(wins2) / len(sells) * 100, 1) if sells else 0,
        "best_trade":      round(max((t["pnl"] for t in sells), default=0), 2),
        "worst_trade":     round(min((t["pnl"] for t in sells), default=0), 2),
        "avg_trade":       round(sum(t["pnl"] for t in sells) / len(sells), 2) if sells else 0,
        "total_pnl":       round(sum(t["pnl"] for t in sells), 2),
        "max_drawdown":    round(mdd, 2),
    }

@app.get("/clients")
def get_clients():
    qt, qp, mt, mp = get_client_data()
    return {
        "quant": {
            "name": "QUANT", "style": "Aggressive", "color": "#ff6600",
            "profile": {"confidence_threshold": "55%", "position_size": "95% of capital",
                        "stop_loss": "3%", "max_hold_days": 30},
            "stats": calc_stats(qt, qp), "trades": qt[-30:], "portfolio": qp,
        },
        "macro": {
            "name": "MACRO", "style": "Conservative", "color": "#00aaff",
            "profile": {"confidence_threshold": "65%", "position_size": "60% of capital",
                        "stop_loss": "1.5%", "max_hold_days": 15},
            "stats": calc_stats(mt, mp), "trades": mt[-30:], "portfolio": mp,
        },
    }

@app.get("/clients/compare")
def get_clients_compare():
    qt, qp, mt, mp = get_client_data()
    qm = {r["date"]: r["value"] for r in qp}
    mm = {r["date"]: r["value"] for r in mp}
    ip = float(df['Close'].iloc[0])
    combined = [
        {"date": d, "QUANT": qm.get(d), "MACRO": mm.get(d),
         "NSEI": round(100000 * float(df.loc[d, 'Close']) / ip, 2)
         if d in df.index.astype(str).values else None}
        for d in sorted(set(qm) | set(mm))
    ]
    nr  = (float(df['Close'].iloc[-1]) - float(df['Close'].iloc[0])) / float(df['Close'].iloc[0]) * 100
    qs  = calc_stats(qt, qp)
    ms  = calc_stats(mt, mp)
    return {
        "quant_stats":    qs,
        "macro_stats":    ms,
        "chart_data":     combined,
        "quant_trades":   qt,
        "macro_trades":   mt,
        "quant_portfolio": qp,
        "macro_portfolio": mp,
        "alpha": {
            "quant_vs_nsei": round(qs["total_return"] - nr, 2),
            "macro_vs_nsei": round(ms["total_return"] - nr, 2),
        },
    }