"""
main.py — DB-FIRST VERSION (fixed)
- Single shared engine from src.database
- init_db() creates all ORM tables on startup
- No stale module-level df/trades/portfolio
- Single scheduler via start_scheduler()
"""

from src.routes_live import router as live_router
from src.scheduler import start_scheduler
from src.database import init_db
from src.db_data import (
    ensure_ohlcv_table,
    get_features_df,
    get_trades_df,
    get_portfolio_df,
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import joblib
import pytz
import shap
from datetime import datetime
import json
import os

app = FastAPI()
app.include_router(live_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# ── Create ALL tables on startup ──────────────────────────────────────────────
init_db()             # creates signals, trades, equity_curve (ORM models)
ensure_ohlcv_table()  # creates ohlcv_features (raw SQL)

# ── Load models ───────────────────────────────────────────────────────────────
MODELS_DIR = "../models"
model      = joblib.load(f"{MODELS_DIR}/xgb_model.pkl")
lgbm_model = joblib.load(f"{MODELS_DIR}/lgbm_model.pkl")
cat_model  = joblib.load(f"{MODELS_DIR}/cat_model.pkl")
le         = joblib.load(f"{MODELS_DIR}/label_encoder.pkl")
FEATURES   = joblib.load(f"{MODELS_DIR}/features.pkl")
weights    = joblib.load(f"{MODELS_DIR}/ensemble_weights.pkl")
w_xgb      = weights["w_xgb"]
w_lgbm     = weights["w_lgbm"]
w_cat      = weights["w_cat"]

print("[STARTUP] DB tables ready. Models loaded.")

# ── Cache paths ───────────────────────────────────────────────────────────────
CACHE_DIR         = "../data/cache"
SHAP_CACHE_PATH   = f"{CACHE_DIR}/shap_cache.json"
SIGNAL_CACHE_PATH = f"{CACHE_DIR}/signal_cache.json"
os.makedirs(CACHE_DIR, exist_ok=True)

# ── SHAP (cached — expensive to recompute) ────────────────────────────────────
if os.path.exists(SHAP_CACHE_PATH):
    print("[STARTUP] Loading SHAP from cache...")
    with open(SHAP_CACHE_PATH) as f:
        _shap_cache = json.load(f)
else:
    print("[STARTUP] Computing SHAP (one-time)...")
    _df_shap    = get_features_df()
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(_df_shap[FEATURES].tail(100))
    latest_shap = explainer.shap_values(_df_shap[FEATURES].iloc[-1:])
    pred        = int(model.predict(_df_shap[FEATURES].iloc[-1:])[0])
    sv = np.array(latest_shap[pred] if isinstance(latest_shap, list) else latest_shap).flatten()
    gv = np.abs(np.array(shap_values[0] if isinstance(shap_values, list) else shap_values)).mean(axis=0).flatten()
    _shap_cache = {
        "latest_signal_explanation": sorted(
            [{"feature": f, "shap_value": round(float(sv[i]), 4),
              "abs_value": round(abs(float(sv[i])), 4),
              "direction": "positive" if sv[i] > 0 else "negative"}
             for i, f in enumerate(FEATURES)],
            key=lambda x: x["abs_value"], reverse=True,
        ),
        "global_importance": sorted(
            [{"feature": f, "importance": round(float(gv[i]), 4)}
             for i, f in enumerate(FEATURES)],
            key=lambda x: x["importance"], reverse=True,
        ),
        "predicted_class": pred,
    }
    with open(SHAP_CACHE_PATH, "w") as f:
        json.dump(_shap_cache, f)
    print("[STARTUP] SHAP cached.")

# ── Ensemble helpers ──────────────────────────────────────────────────────────
def ensemble_proba(X):
    import xgboost as xgb
    p1 = model.predict_proba(X)[:, 1]
    p2 = lgbm_model.predict(X)
    p3 = cat_model.predict_proba(X)[:, 1]
    buy_prob = w_xgb * p1 + w_lgbm * p2 + w_cat * p3
    return np.column_stack([1 - buy_prob, buy_prob])


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


# ── Market status ─────────────────────────────────────────────────────────────
IST      = pytz.timezone("Asia/Kolkata")
live_log = []


def is_market_open():
    now = datetime.now(IST)
    if now.weekday() >= 5:
        return False
    return (now.replace(hour=9,  minute=15, second=0) <=
            now <=
            now.replace(hour=15, minute=30, second=0))


def run_trading_loop():
    """Runs every 5 min via scheduler, skips if market closed."""
    try:
        if not is_market_open():
            print(f"[{datetime.now(IST).strftime('%H:%M:%S')}] Market closed — skipping")
            return
        latest_df = get_features_df(days=5)
        if latest_df.empty:
            return
        signals, confs, _ = ensemble_predict(latest_df[FEATURES].iloc[-1:])
        conf   = round(float(confs[0]), 3)
        action = {1: "BUY", -1: "SELL", 0: "HOLD"}.get(int(signals[0]), "HOLD")
        price  = round(float(latest_df["close"].iloc[-1]), 2)
        log    = f"ML → {action} (p={conf}) | price={price} | time={datetime.now(IST).strftime('%H:%M:%S')}"
        print(log)
        live_log.append({
            "time": datetime.now(IST).strftime("%H:%M:%S"),
            "action": action, "confidence": conf,
            "price": price, "log": log,
        })
        if len(live_log) > 50:
            live_log.pop(0)
    except Exception as e:
        print(f"[run_trading_loop ERROR] {e}")


# ── Startup event — single scheduler ─────────────────────────────────────────
@app.on_event("startup")
async def startup():
    start_scheduler()


# ── Client data helper ────────────────────────────────────────────────────────
def get_client_data():
    from src.database import SessionLocal, Trade as DBTrade, EquityCurvePoint
    db = SessionLocal()
    try:
        def _trades(profile):
            rows = db.query(DBTrade).filter(DBTrade.profile == profile).order_by(DBTrade.id).all()
            return [{"date": str(t.entry_date if t.status == "OPEN" else t.exit_date),
                     "action": "BUY" if t.status == "OPEN" else "SELL",
                     "price": t.entry_price if t.status == "OPEN" else t.exit_price,
                     "qty": int(t.position_size / t.entry_price) if t.entry_price else 0,
                     "pnl": round(t.pnl_abs, 2) if t.pnl_abs else 0,
                     "confidence": round(t.signal_confidence, 4) if t.signal_confidence else 0,
                     "exit_type": t.exit_reason or ""} for t in rows]

        def _portfolio(profile):
            rows = (db.query(EquityCurvePoint)
                      .filter(EquityCurvePoint.profile == profile)
                      .order_by(EquityCurvePoint.id).all())
            return [{"date": str(p.date), "value": p.equity} for p in rows]

        return (_trades("QUANT"), _portfolio("QUANT"),
                _trades("MACRO"), _portfolio("MACRO"))
    finally:
        db.close()


def calc_stats(tl, pl):
    initial = 1_000_000
    final   = pl[-1]["value"] if pl else initial
    sells   = [t for t in tl if t.get("action") == "SELL"]
    wins2   = [t for t in sells if t.get("pnl", 0) > 0]
    pk, mdd = initial, 0.0
    for r in pl:
        if r["value"] > pk: pk = r["value"]
        mdd = max(mdd, (pk - r["value"]) / pk * 100)
    return {
        "initial_capital": initial, "final_value": round(final, 2),
        "total_return":    round((final - initial) / initial * 100, 2),
        "total_trades":    len(tl), "wins": len(wins2),
        "losses":          len(sells) - len(wins2),
        "win_rate":        round(len(wins2) / len(sells) * 100, 1) if sells else 0,
        "best_trade":      round(max((t.get("pnl", 0) for t in sells), default=0), 2),
        "worst_trade":     round(min((t.get("pnl", 0) for t in sells), default=0), 2),
        "avg_trade":       round(sum(t.get("pnl", 0) for t in sells) / len(sells), 2) if sells else 0,
        "total_pnl":       round(sum(t.get("pnl", 0) for t in sells), 2),
        "max_drawdown":    round(mdd, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ALGO TRADING API running (DB-first)"}


@app.get("/signal")
def get_latest_signal():
    from src.database import SessionLocal, Signal
    from datetime import date
    db = SessionLocal()
    try:
        today = date.today().isoformat()
        s = db.query(Signal).filter(Signal.date == today).first()
        if s:
            latest_df = get_features_df(days=5)
            return {
                "signal":     s.signal,
                "confidence": round(s.confidence * 100, 2),
                "buy_prob":   round(s.confidence * 100, 2),
                "date":       s.date,
                "close":      round(float(latest_df["close"].iloc[-1]), 2),
                "source":     "db",
            }
    finally:
        db.close()

    # Fallback: compute live
    latest_df = get_features_df(days=5)
    signals, confs, probs = ensemble_predict(latest_df[FEATURES].iloc[-1:])
    return {
        "signal":     {1: "BUY", -1: "SELL", 0: "HOLD"}.get(int(signals[0]), "HOLD"),
        "confidence": round(float(confs[0]) * 100, 2),
        "buy_prob":   round(float(probs[0][1]) * 100, 2),
        "date":       str(latest_df.index[-1].date()),
        "close":      round(float(latest_df["close"].iloc[-1]), 2),
        "source":     "live",
    }


@app.get("/portfolio")
def get_portfolio():
    port = get_portfolio_df(profile="QUANT")
    port["date"] = port["date"].astype(str)
    return port.to_dict(orient="records")


@app.get("/trades")
def get_trades():
    t = get_trades_df()
    t["pnl"]        = pd.to_numeric(t.get("pnl", 0), errors="coerce").fillna(0)
    t["confidence"] = pd.to_numeric(t.get("confidence", 0), errors="coerce").fillna(0)
    return t.tail(20).fillna("").to_dict(orient="records")


@app.get("/stats")
def get_stats():
    port = get_portfolio_df(profile="QUANT")
    t    = get_trades_df()
    initial = 1_000_000
    final   = round(float(port["value"].iloc[-1]), 2) if not port.empty else initial
    st      = t[t["action"] == "SELL"]
    wins    = len(st[st["pnl"] > 0])
    losses  = len(st[st["pnl"] <= 0])
    ts      = wins + losses
    return {
        "initial_capital": initial,
        "final_value":     final,
        "total_return":    round((final - initial) / initial * 100, 2),
        "total_trades":    len(t),
        "wins":            wins,
        "losses":          losses,
        "win_rate":        round(wins / ts * 100, 1) if ts > 0 else 0,
    }


@app.get("/pnl")
def get_pnl():
    t  = get_trades_df()
    st = t[t["pnl"] != 0] if "pnl" in t.columns else pd.DataFrame()
    return {
        "cumulative_pnl": round(float(st["pnl"].sum()), 2)  if len(st) > 0 else 0,
        "best_trade":     round(float(st["pnl"].max()), 2)  if len(st) > 0 else 0,
        "worst_trade":    round(float(st["pnl"].min()), 2)  if len(st) > 0 else 0,
        "avg_trade":      round(float(st["pnl"].mean()), 2) if len(st) > 0 else 0,
        "last_log":       "",
    }


@app.get("/live-log")
def get_live_log():
    return live_log[-10:]


@app.get("/market-status")
def market_status():
    now = datetime.now(IST)
    return {
        "is_open":          is_market_open(),
        "current_time_ist": now.strftime("%H:%M:%S"),
        "status":           "OPEN" if is_market_open() else "CLOSED",
    }


@app.get("/indicators")
def get_indicators():
    latest = get_features_df(days=150)
    cols   = [c for c in ["close", "rsi", "bb_upper", "bb_lower", "sma20", "sma50"] if c in latest.columns]
    data   = latest[cols].tail(100).copy()
    data.index.name = "date"
    data   = data.reset_index()
    data["date"] = data["date"].astype(str)
    data   = data.replace([float("inf"), float("-inf")], None)
    data   = data.where(data.notna(), None)
    return data.to_dict(orient="records")


@app.get("/psychology")
def get_psychology():
    t    = get_trades_df()
    port = get_portfolio_df(profile="QUANT")
    st   = t[t["pnl"] != 0].copy() if "pnl" in t.columns else pd.DataFrame()
    if len(st) == 0:
        return {"score": 100, "status": "HEALTHY", "message": "No trades yet.", "alerts": []}
    recent = st["pnl"].tail(5).tolist()
    cl = 0
    for p in reversed(recent):
        if p < 0:
            cl += 1
        else: 
            break
    peak = port["value"].max() if not port.empty else 1_000_000
    cur  = port["value"].iloc[-1] if not port.empty else 1_000_000
    dd   = round((peak - cur) / peak * 100, 2)
    rw   = round(sum(1 for p in recent if p > 0) / len(recent) * 100, 1) if recent else 0
    cs   = round(float(t["confidence"].tail(5).mean()) * 100, 2) if "confidence" in t.columns else 50
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
        alerts.append("Revenge trading risk — 3+ consecutive losses detected")
    elif cl == 2: 
        alerts.append("2 losses in a row — recency bias may affect next decision")
    if dd > 5:
        alerts.append(f"Portfolio down {dd}% from peak")
    elif dd > 2:
        alerts.append(f"Drawdown of {dd}% detected")
    if rw < 40: 
        alerts.append("Win rate below 40% in last 5 trades")
    if cs < 50:
        alerts.append("Model confidence dropping")
    if score >= 80:  
        s, m, c = "HEALTHY",      "Trading well. Continue normally.",          "#22c55e"
    elif score >= 50: 
        s, m, c = "CAUTION",       "Signs of stress. Reduce size.",             "#f59e0b"
    elif score >= 20: 
        s, m, c = "HIGH RISK",     "High emotional risk. Consider pausing.",    "#ef4444"
    else:           
        s, m, c = "STOP TRADING",  "Critical state. Stop trading now.",         "#dc2626"
    return {"score": score, "status": s, "message": m, "color": c,
            "consecutive_losses": cl, "drawdown_pct": dd,
            "recent_winrate": rw, "conf_score": cs, "alerts": alerts}


@app.get("/shap")
def get_shap():
    return _shap_cache


# ── Walk-forward ──────────────────────────────────────────────────────────────
def run_walk_forward_engine():
    from xgboost import XGBClassifier
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import accuracy_score
    wf_df = get_features_df()
    data, n, min_train, test_size = wf_df.dropna(), len(wf_df.dropna()), 500, 200
    windows, all_equity, wn, cursor = [], [], 1, min_train
    while cursor + test_size <= n:
        tr, te = data.iloc[0:cursor], data.iloc[cursor:cursor + test_size]
        wle = LabelEncoder()
        ytr = wle.fit_transform(tr["label"])
        yte = wle.transform(te["label"])
        wm  = XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05,
                             eval_metric="logloss", random_state=42)
        wm.fit(tr[FEATURES], ytr)
        probs = wm.predict_proba(te[FEATURES])
        bp    = probs[:, 1]
        acc   = round(accuracy_score(yte, (bp >= 0.5).astype(int)) * 100, 2)
        cap, pos, wt, eq = 100000.0, None, [], []
        for i in range(len(te)):
            bpi = float(bp[i]); conf = float(probs[i].max())
            price = float(te["close"].iloc[i]); date_s = str(te.index[i].date())
            sig = "BUY" if bpi >= 0.55 else "SELL" if bpi <= 0.35 else "HOLD"
            if pos is None:
                if sig == "BUY" and conf >= 0.55:
                    qty = int((cap * 0.95) / price)
                    if qty > 0:
                        pos = {"entry_price": price, "qty": qty, "entry_idx": i}
                        cap -= qty * price
                        wt.append({"date": date_s, "action": "BUY", "price": round(price, 2),
                                   "qty": qty, "pnl": 0, "conf": round(conf, 4)})
            else:
                sh = price <= pos["entry_price"] * 0.97
                mh = (i - pos["entry_idx"]) >= 20
                if sig == "SELL" or sh or mh:
                    pnl = (price - pos["entry_price"]) * pos["qty"]
                    cap += pos["qty"] * price
                    wt.append({"date": date_s, "action": "SELL", "price": round(price, 2),
                               "qty": pos["qty"], "pnl": round(pnl, 2), "conf": round(conf, 4),
                               "exit_type": "stop_loss" if sh else "max_hold" if mh else "signal"})
                    pos = None
            eq.append({"date": date_s, "value": round(cap + (pos["qty"] * price if pos else 0), 2)})
        sells = [t for t in wt if t["action"] == "SELL"]
        wins2 = [t for t in sells if t["pnl"] > 0]
        fv = eq[-1]["value"] if eq else 100000
        ret = round((fv - 100000) / 100000 * 100, 2)
        pk, mdd = 100000, 0.0
        for e in eq:
            if e["value"] > pk: pk = e["value"]
            mdd = max(mdd, (pk - e["value"]) / pk * 100)
        nr = round((float(te["close"].iloc[-1]) - float(te["close"].iloc[0])) /
                   float(te["close"].iloc[0]) * 100, 2)
        windows.append({"window": wn,
            "train_period": f"{str(tr.index[0].date())} → {str(tr.index[-1].date())}",
            "test_period":  f"{str(te.index[0].date())} → {str(te.index[-1].date())}",
            "train_rows": len(tr), "test_rows": len(te), "accuracy": acc,
            "total_trades": len(wt), "wins": len(wins2),
            "losses": len(sells) - len(wins2),
            "win_rate": round(len(wins2) / len(sells) * 100, 1) if sells else 0,
            "return_pct": ret, "nsei_return": nr, "alpha": round(ret - nr, 2),
            "max_drawdown": round(mdd, 2), "final_value": fv, "equity": eq, "trades": wt})
        all_equity.extend(eq)
        cursor += test_size; wn += 1
    result = {"summary": {
        "total_windows":      len(windows),
        "total_return":       round((windows[-1]["final_value"] - 100000) / 100000 * 100, 2) if windows else 0,
        "avg_accuracy":       round(sum(w["accuracy"] for w in windows) / len(windows), 2) if windows else 0,
        "avg_win_rate":       round(sum(w["win_rate"] for w in windows) / len(windows), 2) if windows else 0,
        "avg_alpha":          round(sum(w["alpha"] for w in windows) / len(windows), 2) if windows else 0,
        "avg_drawdown":       round(sum(w["max_drawdown"] for w in windows) / len(windows), 2) if windows else 0,
        "total_trades":       sum(w["total_trades"] for w in windows),
        "windows_profitable": sum(1 for w in windows if w["return_pct"] > 0),
    }, "windows": windows, "equity": all_equity}
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


@app.get("/clients")
def get_clients():
    qt, qp, mt, mp = get_client_data()
    return {
        "quant": {"name": "QUANT", "style": "Aggressive", "color": "#ff6600",
            "profile": {"confidence_threshold": "55%", "position_size": "95% of capital",
                        "stop_loss": "3%", "max_hold_days": 30},
            "stats": calc_stats(qt, qp), "trades": qt[-30:], "portfolio": qp},
        "macro": {"name": "MACRO", "style": "Conservative", "color": "#00aaff",
            "profile": {"confidence_threshold": "65%", "position_size": "60% of capital",
                        "stop_loss": "1.5%", "max_hold_days": 15},
            "stats": calc_stats(mt, mp), "trades": mt[-30:], "portfolio": mp},
    }


@app.get("/clients/compare")
def get_clients_compare():
    qt, qp, mt, mp = get_client_data()
    qm = {r["date"]: r["value"] for r in qp}
    mm = {r["date"]: r["value"] for r in mp}
    full_df = get_features_df()
    full_df.index = full_df.index.astype(str)
    ip = float(full_df["close"].iloc[0]) if not full_df.empty else 1
    combined = []
    for d in sorted(set(qm) | set(mm)):
        nsei_val = None
        if d in full_df.index:
            nsei_val = round(1_000_000 * float(full_df.loc[d, "close"]) / ip, 2)
        combined.append({"date": d, "QUANT": qm.get(d), "MACRO": mm.get(d), "NSEI": nsei_val})
    nr  = (float(full_df["close"].iloc[-1]) - float(full_df["close"].iloc[0])) / float(full_df["close"].iloc[0]) * 100
    qs  = calc_stats(qt, qp)
    ms  = calc_stats(mt, mp)
    return {"quant_stats": qs, "macro_stats": ms, "chart_data": combined,
            "quant_trades": qt, "macro_trades": mt,
            "quant_portfolio": qp, "macro_portfolio": mp,
            "alpha": {"quant_vs_nsei": round(qs["total_return"] - nr, 2),
                      "macro_vs_nsei": round(ms["total_return"] - nr, 2)}}


# ── Admin endpoints ───────────────────────────────────────────────────────────

@app.post("/admin/backfill")
def trigger_backfill():
    from src.paper_engine import backfill_from_db
    backfill_from_db()
    return {"status": "backfill complete"}


@app.post("/admin/fetch-latest")
def trigger_fetch_latest():
    from src.incremental_learn import fetch_and_store_latest
    df = fetch_and_store_latest()
    return {"status": "ok", "rows": len(df)}


@app.get("/admin/db-status")
def db_status():
    from src.db_data import get_last_stored_date
    from src.database import SessionLocal, Signal, Trade
    last = get_last_stored_date()
    db   = SessionLocal()
    try:
        n_signals = db.query(Signal).count()
        n_trades  = db.query(Trade).count()
    finally:
        db.close()
    return {"last_ohlcv_date": last, "total_signals": n_signals, "total_trades": n_trades}