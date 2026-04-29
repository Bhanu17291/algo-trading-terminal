from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
import pandas as pd
import numpy as np
import joblib
import pytz
import shap
from datetime import datetime
import functools
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LOAD MODEL + DATA ──────────────────────────────────────────
model     = joblib.load("../models/xgb_model.pkl")
le        = joblib.load("../models/label_encoder.pkl")
df        = pd.read_csv("../data/nsei_features.csv", index_col=0, parse_dates=True)
portfolio = pd.read_csv("../data/portfolio.csv", index_col=0, parse_dates=True)

trades = pd.read_csv("../data/trades_log.csv")
trades = trades.fillna("")
trades['pnl']        = pd.to_numeric(trades['pnl'], errors='coerce').fillna(0)
trades['confidence'] = pd.to_numeric(trades['confidence'], errors='coerce').fillna(0)

FEATURES = [
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month'
]

# Pre-compute SHAP explainer once at startup
explainer = shap.TreeExplainer(model)

# ── LIVE TRADING LOOP ──────────────────────────────────────────
IST      = pytz.timezone("Asia/Kolkata")
live_log = []

def is_market_open():
    now = datetime.now(IST)
    if now.weekday() >= 5:
        return False
    market_open  = now.replace(hour=9,  minute=15, second=0)
    market_close = now.replace(hour=15, minute=30, second=0)
    return market_open <= now <= market_close

def run_trading_loop():
    if not is_market_open():
        print(f"[{datetime.now(IST).strftime('%H:%M:%S')}] Market closed — skipping")
        return

    latest    = df[FEATURES].iloc[-1:]
    prob      = model.predict_proba(latest)[0]
    pred      = model.predict(latest)[0]
    signal    = le.inverse_transform([pred])[0]
    conf      = round(float(prob.max()), 3)
    price     = round(float(df['Close'].iloc[-1]), 2)
    label_map = {1: "BUY", -1: "SELL", 0: "HOLD"}
    action    = label_map.get(signal, "HOLD")

    log = f"ML → {action} (p={conf}) | price={price} | time={datetime.now(IST).strftime('%H:%M:%S')}"
    print(log)
    live_log.append({
        "time":       datetime.now(IST).strftime("%H:%M:%S"),
        "action":     action,
        "confidence": conf,
        "price":      price,
        "log":        log
    })
    if len(live_log) > 50:
        live_log.pop(0)

scheduler = BackgroundScheduler()
scheduler.add_job(run_trading_loop, 'interval', minutes=1)
scheduler.start()

# ── ENDPOINTS ──────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ALGO TRADING API running"}

@app.get("/signal")
def get_latest_signal():
    latest     = df[FEATURES].iloc[-1:]
    prob       = model.predict_proba(latest)[0]
    pred       = model.predict(latest)[0]
    signal     = le.inverse_transform([pred])[0]
    confidence = round(float(prob.max()) * 100, 2)
    label_map  = {1: "BUY", -1: "SELL", 0: "HOLD"}
    return {
        "signal":     label_map.get(signal, "HOLD"),
        "confidence": confidence,
        "date":       str(df.index[-1].date()),
        "close":      round(float(df['Close'].iloc[-1]), 2)
    }

@app.get("/portfolio")
def get_portfolio():
    data         = portfolio.reset_index()
    data['date'] = data['date'].astype(str)
    return data.to_dict(orient="records")

@app.get("/trades")
def get_trades():
    t = trades.tail(20).copy()
    return t.to_dict(orient="records")

@app.get("/stats")
def get_stats():
    initial      = 100000
    final        = round(float(portfolio['value'].iloc[-1]), 2)
    returns      = round((final - initial) / initial * 100, 2)
    total_trades = len(trades)
    sell_trades  = trades[trades['action'] == 'SELL']
    wins         = len(sell_trades[sell_trades['pnl'] > 0])
    losses       = len(sell_trades[sell_trades['pnl'] <= 0])
    total_sells  = wins + losses
    win_rate     = round(wins / total_sells * 100, 1) if total_sells > 0 else 0
    return {
        "initial_capital": initial,
        "final_value":     final,
        "total_return":    returns,
        "total_trades":    total_trades,
        "wins":            wins,
        "losses":          losses,
        "win_rate":        win_rate
    }

@app.get("/pnl")
def get_pnl():
    sell_trades = trades[trades['pnl'] != 0]
    cumulative  = round(float(sell_trades['pnl'].sum()), 2)
    best_trade  = round(float(sell_trades['pnl'].max()), 2) if len(sell_trades) > 0 else 0
    worst_trade = round(float(sell_trades['pnl'].min()), 2) if len(sell_trades) > 0 else 0
    avg_trade   = round(float(sell_trades['pnl'].mean()), 2) if len(sell_trades) > 0 else 0
    last_log    = trades['log'].replace("", float('nan')).dropna().iloc[-1] if 'log' in trades.columns else ""
    return {
        "cumulative_pnl": cumulative,
        "best_trade":     best_trade,
        "worst_trade":    worst_trade,
        "avg_trade":      avg_trade,
        "last_log":       last_log
    }

@app.get("/live-log")
def get_live_log():
    return live_log[-10:]

@app.get("/market-status")
def market_status():
    open_ = is_market_open()
    now   = datetime.now(IST)
    return {
        "is_open":          open_,
        "current_time_ist": now.strftime("%H:%M:%S"),
        "status":           "OPEN" if open_ else "CLOSED"
    }

@app.get("/indicators")
def get_indicators():
    data = df[['Close', 'rsi', 'bb_upper', 'bb_lower', 'sma20', 'sma50']].tail(100).copy()
    data.index.name = 'date'
    data = data.reset_index()
    data['date'] = data['date'].astype(str)
    return data.to_dict(orient="records")

@app.get("/psychology")
def get_psychology():
    sell_trades = trades[trades['pnl'] != 0].copy()

    if len(sell_trades) == 0:
        return {"score": 100, "status": "HEALTHY", "message": "No trades yet.", "alerts": []}

    recent = sell_trades['pnl'].tail(5).tolist()
    consecutive_losses = 0
    for pnl_val in reversed(recent):
        if pnl_val < 0:
            consecutive_losses += 1
        else:
            break

    peak          = portfolio['value'].max()
    current_value = portfolio['value'].iloc[-1]
    drawdown_pct  = round((peak - current_value) / peak * 100, 2)

    recent_wins    = sum(1 for p in recent if p > 0)
    recent_winrate = round(recent_wins / len(recent) * 100, 1) if len(recent) > 0 else 0

    recent_conf = trades['confidence'].tail(5).mean()
    conf_score  = round(float(recent_conf) * 100, 2)

    score = 100
    if consecutive_losses == 1:
        score -= 10
    elif consecutive_losses == 2:
        score -= 25
    elif consecutive_losses == 3:
        score -= 40
    elif consecutive_losses >= 4:
        score -= 60

    if drawdown_pct > 2:
        score -= 10
    if drawdown_pct > 5:
        score -= 20
    if drawdown_pct > 10:
        score -= 30

    if recent_winrate < 40:
        score -= 15
    if recent_winrate < 20:
        score -= 15

    if conf_score < 50:
        score -= 10

    score = max(0, min(100, score))

    alerts = []
    if consecutive_losses >= 3:
        alerts.append("🚨 Revenge trading risk — 3+ consecutive losses detected")
    elif consecutive_losses == 2:
        alerts.append("⚠️ 2 losses in a row — recency bias may affect next decision")
    if drawdown_pct > 5:
        alerts.append(f"🔴 Portfolio down {drawdown_pct}% from peak — loss aversion kicking in")
    elif drawdown_pct > 2:
        alerts.append(f"🟡 Drawdown of {drawdown_pct}% detected — monitor closely")
    if recent_winrate < 40:
        alerts.append("📉 Win rate below 40% in last 5 trades — review strategy")
    if conf_score < 50:
        alerts.append("🤔 Model confidence dropping — uncertain market conditions")

    if score >= 80:
        status  = "HEALTHY"
        message = "You're trading well. Emotions appear stable. Continue normally."
        color   = "#22c55e"
    elif score >= 50:
        status  = "CAUTION"
        message = "Signs of emotional stress detected. Consider reducing position size."
        color   = "#f59e0b"
    elif score >= 20:
        status  = "HIGH RISK"
        message = "High emotional risk. Research shows traders lose more after this point. Consider pausing."
        color   = "#ef4444"
    else:
        status  = "STOP TRADING"
        message = "Critical emotional state detected. Stop trading now. Come back tomorrow with a clear mind."
        color   = "#dc2626"

    return {
        "score":              score,
        "status":             status,
        "message":            message,
        "color":              color,
        "consecutive_losses": consecutive_losses,
        "drawdown_pct":       drawdown_pct,
        "recent_winrate":     recent_winrate,
        "conf_score":         conf_score,
        "alerts":             alerts
    }

@app.get("/shap")
def get_shap():
    X      = df[FEATURES].tail(100)
    latest = df[FEATURES].iloc[-1:]

    shap_values = explainer.shap_values(X)
    latest_shap = explainer.shap_values(latest)

    pred = int(model.predict(latest)[0])
    if isinstance(latest_shap, list):
        shap_vals = np.array(latest_shap[pred]).flatten()
    else:
        shap_vals = np.array(latest_shap).flatten()

    feature_importance = []
    for i, feat in enumerate(FEATURES):
        val = float(shap_vals[i])
        feature_importance.append({
            "feature":    feat,
            "shap_value": round(val, 4),
            "abs_value":  round(abs(val), 4),
            "direction":  "positive" if val > 0 else "negative"
        })
    feature_importance.sort(key=lambda x: x["abs_value"], reverse=True)

    if isinstance(shap_values, list):
        global_shap = np.abs(np.array(shap_values[0])).mean(axis=0).flatten()
    else:
        global_shap = np.abs(np.array(shap_values)).mean(axis=0).flatten()

    global_importance = []
    for i, feat in enumerate(FEATURES):
        global_importance.append({
            "feature":    feat,
            "importance": round(float(global_shap[i]), 4)
        })
    global_importance.sort(key=lambda x: x["importance"], reverse=True)

    return {
        "latest_signal_explanation": feature_importance,
        "global_importance":         global_importance,
        "predicted_class":           pred
    }

# ── WALK-FORWARD ───────────────────────────────────────────────

def run_walk_forward_engine():
    from xgboost import XGBClassifier
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import accuracy_score

    data        = df.dropna()
    n           = len(data)
    min_train   = 370
    test_size   = 125
    windows     = []
    all_equity  = []
    window_num  = 1
    cursor      = min_train

    while cursor + test_size <= n:
        train_df = data.iloc[0:cursor]
        test_df  = data.iloc[cursor:cursor + test_size]

        X_train = train_df[FEATURES]
        y_train = train_df['label']
        X_test  = test_df[FEATURES]
        y_test  = test_df['label']

        wf_le = LabelEncoder()
        y_train_enc = wf_le.fit_transform(y_train)
        y_test_enc  = wf_le.transform(y_test)

        wf_model = XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            use_label_encoder=False,
            eval_metric='mlogloss',
            random_state=42
        )
        wf_model.fit(X_train, y_train_enc)

        probs   = wf_model.predict_proba(X_test)
        preds   = wf_model.predict(X_test)
        signals = wf_le.inverse_transform(preds)
        accuracy = round(accuracy_score(y_test_enc, preds) * 100, 2)

        capital   = 100000.0
        position  = None
        wf_trades = []
        equity    = []
        label_map = {1: "BUY", -1: "SELL", 0: "HOLD"}

        for i in range(len(test_df)):
            signal = label_map.get(int(signals[i]), "HOLD")
            conf   = float(probs[i].max())
            price  = float(test_df['Close'].iloc[i])
            date   = str(test_df.index[i].date())

            if position is None:
                if signal == "BUY" and conf >= 0.55:
                    qty = int((capital * 0.95) / price)
                    if qty > 0:
                        position = {
                            "entry_price": price,
                            "qty":         qty,
                            "entry_idx":   i,
                            "entry_date":  date
                        }
                        capital -= qty * price
                        wf_trades.append({
                            "date":   date,
                            "action": "BUY",
                            "price":  round(price, 2),
                            "qty":    qty,
                            "pnl":    0,
                            "conf":   round(conf, 4)
                        })
            else:
                days_held = i - position["entry_idx"]
                stop_hit  = price <= position["entry_price"] * 0.97
                max_hold  = days_held >= 20
                if (signal == "SELL" and conf >= 0.55) or stop_hit or max_hold:
                    pnl     = (price - position["entry_price"]) * position["qty"]
                    capital += position["qty"] * price
                    wf_trades.append({
                        "date":      date,
                        "action":    "SELL",
                        "price":     round(price, 2),
                        "qty":       position["qty"],
                        "pnl":       round(pnl, 2),
                        "conf":      round(conf, 4),
                        "exit_type": "stop_loss" if stop_hit else "max_hold" if max_hold else "signal"
                    })
                    position = None

            open_val = position["qty"] * price if position else 0
            equity.append({"date": date, "value": round(capital + open_val, 2)})

        sells    = [t for t in wf_trades if t["action"] == "SELL"]
        wins     = [t for t in sells if t["pnl"] > 0]
        win_rate = round(len(wins) / len(sells) * 100, 1) if sells else 0
        final_val   = equity[-1]["value"] if equity else 100000
        wf_return   = round((final_val - 100000) / 100000 * 100, 2)

        peak   = 100000
        max_dd = 0.0
        for e in equity:
            if e["value"] > peak:
                peak = e["value"]
            dd = (peak - e["value"]) / peak * 100
            if dd > max_dd:
                max_dd = dd

        nsei_start  = float(test_df['Close'].iloc[0])
        nsei_end    = float(test_df['Close'].iloc[-1])
        nsei_return = round((nsei_end - nsei_start) / nsei_start * 100, 2)
        alpha       = round(wf_return - nsei_return, 2)

        windows.append({
            "window":       window_num,
            "train_period": f"{str(train_df.index[0].date())} → {str(train_df.index[-1].date())}",
            "test_period":  f"{str(test_df.index[0].date())} → {str(test_df.index[-1].date())}",
            "train_rows":   len(train_df),
            "test_rows":    len(test_df),
            "accuracy":     accuracy,
            "total_trades": len(wf_trades),
            "wins":         len(wins),
            "losses":       len(sells) - len(wins),
            "win_rate":     win_rate,
            "return_pct":   wf_return,
            "nsei_return":  nsei_return,
            "alpha":        alpha,
            "max_drawdown": round(max_dd, 2),
            "final_value":  final_val,
            "equity":       equity,
            "trades":       wf_trades
        })

        all_equity.extend(equity)
        cursor     += test_size
        window_num += 1

    total_return = round((windows[-1]["final_value"] - 100000) / 100000 * 100, 2) if windows else 0
    avg_accuracy = round(sum(w["accuracy"]     for w in windows) / len(windows), 2) if windows else 0
    avg_win_rate = round(sum(w["win_rate"]     for w in windows) / len(windows), 2) if windows else 0
    avg_alpha    = round(sum(w["alpha"]        for w in windows) / len(windows), 2) if windows else 0
    avg_drawdown = round(sum(w["max_drawdown"] for w in windows) / len(windows), 2) if windows else 0
    total_trades = sum(w["total_trades"] for w in windows)

    result = {
        "summary": {
            "total_windows":      len(windows),
            "total_return":       total_return,
            "avg_accuracy":       avg_accuracy,
            "avg_win_rate":       avg_win_rate,
            "avg_alpha":          avg_alpha,
            "avg_drawdown":       avg_drawdown,
            "total_trades":       total_trades,
            "windows_profitable": sum(1 for w in windows if w["return_pct"] > 0),
        },
        "windows": windows,
        "equity":  all_equity
    }

    os.makedirs("../data", exist_ok=True)
    with open("../data/walkforward_results.json", "w") as f:
        json.dump(result, f)

    print(f"Walk-forward complete — {len(windows)} windows, avg alpha: {avg_alpha}%")
    return result


@app.get("/walkforward")
def get_walkforward():
    path = "../data/walkforward_results.json"
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {"error": "not_run"}


@app.post("/walkforward/run")
def trigger_walkforward():
    result = run_walk_forward_engine()
    return {
        "status":  "complete",
        "windows": result["summary"]["total_windows"],
        "alpha":   result["summary"]["avg_alpha"]
    }

# ── CLIENT PROFILES ────────────────────────────────────────────

def simulate_client_trades(confidence_threshold, position_fraction, stop_loss_pct, max_hold_days, label="CLIENT"):
    capital       = 100000.0
    portfolio_val = [{"date": str(df.index[0].date()), "value": capital}]
    client_trades = []
    position      = None

    for i in range(1, len(df)):
        row       = df[FEATURES].iloc[[i]]
        prob      = model.predict_proba(row)[0]
        pred      = model.predict(row)[0]
        signal    = le.inverse_transform([pred])[0]
        conf      = float(prob.max())
        label_map = {1: "BUY", -1: "SELL", 0: "HOLD"}
        action    = label_map.get(signal, "HOLD")
        price     = float(df['Close'].iloc[i])
        date      = str(df.index[i].date())

        if position is None:
            if action == "BUY" and conf >= confidence_threshold:
                invest = capital * position_fraction
                qty    = int(invest / price)
                if qty > 0:
                    position = {
                        "entry_price": price,
                        "qty":         qty,
                        "entry_date":  date,
                        "entry_idx":   i,
                        "confidence":  conf
                    }
                    capital -= qty * price
                    client_trades.append({
                        "date":       date,
                        "action":     "BUY",
                        "price":      round(price, 2),
                        "qty":        qty,
                        "pnl":        0,
                        "confidence": round(conf, 4)
                    })
        else:
            days_held    = i - position["entry_idx"]
            stop_hit     = price <= position["entry_price"] * (1 - stop_loss_pct)
            max_hold_hit = days_held >= max_hold_days
            should_sell  = (action == "SELL" and conf >= confidence_threshold) or stop_hit or max_hold_hit

            if should_sell:
                pnl       = (price - position["entry_price"]) * position["qty"]
                capital  += position["qty"] * price
                exit_type = "stop_loss" if stop_hit else "max_hold" if max_hold_hit else "signal"
                client_trades.append({
                    "date":       date,
                    "action":     "SELL",
                    "price":      round(price, 2),
                    "qty":        position["qty"],
                    "pnl":        round(pnl, 2),
                    "confidence": round(conf, 4),
                    "exit_type":  exit_type
                })
                position = None

        open_val = position["qty"] * price if position else 0
        portfolio_val.append({"date": date, "value": round(capital + open_val, 2)})

    return client_trades, portfolio_val


@functools.lru_cache(maxsize=1)
def get_client_data():
    quant_trades, quant_portfolio = simulate_client_trades(
        confidence_threshold=0.45,
        position_fraction=0.95,
        stop_loss_pct=0.03,
        max_hold_days=30,
        label="QUANT"
    )
    macro_trades, macro_portfolio = simulate_client_trades(
        confidence_threshold=0.70,
        position_fraction=0.60,
        stop_loss_pct=0.015,
        max_hold_days=15,
        label="MACRO"
    )
    return quant_trades, quant_portfolio, macro_trades, macro_portfolio


def calc_stats(trades_list, portfolio_list):
    initial      = 100000
    final        = portfolio_list[-1]["value"] if portfolio_list else initial
    total_return = round((final - initial) / initial * 100, 2)
    sells        = [t for t in trades_list if t["action"] == "SELL"]
    wins         = [t for t in sells if t["pnl"] > 0]
    losses       = [t for t in sells if t["pnl"] <= 0]
    win_rate     = round(len(wins) / len(sells) * 100, 1) if sells else 0
    best         = round(max((t["pnl"] for t in sells), default=0), 2)
    worst        = round(min((t["pnl"] for t in sells), default=0), 2)
    avg          = round(sum(t["pnl"] for t in sells) / len(sells), 2) if sells else 0
    total_pnl    = round(sum(t["pnl"] for t in sells), 2)

    peak   = initial
    max_dd = 0.0
    for row in portfolio_list:
        if row["value"] > peak:
            peak = row["value"]
        dd = (peak - row["value"]) / peak * 100
        if dd > max_dd:
            max_dd = dd

    return {
        "initial_capital": initial,
        "final_value":     round(final, 2),
        "total_return":    total_return,
        "total_trades":    len(trades_list),
        "wins":            len(wins),
        "losses":          len(losses),
        "win_rate":        win_rate,
        "best_trade":      best,
        "worst_trade":     worst,
        "avg_trade":       avg,
        "total_pnl":       total_pnl,
        "max_drawdown":    round(max_dd, 2)
    }


@app.get("/clients")
def get_clients():
    quant_trades, quant_portfolio, macro_trades, macro_portfolio = get_client_data()
    return {
        "quant": {
            "name":    "QUANT",
            "style":   "Aggressive",
            "color":   "#ff6600",
            "profile": {
                "confidence_threshold": "45%",
                "position_size":        "95% of capital",
                "stop_loss":            "3%",
                "max_hold_days":        30
            },
            "stats":     calc_stats(quant_trades, quant_portfolio),
            "trades":    quant_trades[-30:],
            "portfolio": quant_portfolio
        },
        "macro": {
            "name":    "MACRO",
            "style":   "Conservative",
            "color":   "#00aaff",
            "profile": {
                "confidence_threshold": "70%",
                "position_size":        "60% of capital",
                "stop_loss":            "1.5%",
                "max_hold_days":        15
            },
            "stats":     calc_stats(macro_trades, macro_portfolio),
            "trades":    macro_trades[-30:],
            "portfolio": macro_portfolio
        }
    }


@app.get("/clients/compare")
def get_clients_compare():
    quant_trades, quant_portfolio, macro_trades, macro_portfolio = get_client_data()
    quant_stats = calc_stats(quant_trades, quant_portfolio)
    macro_stats = calc_stats(macro_trades, macro_portfolio)

    q_map         = {r["date"]: r["value"] for r in quant_portfolio}
    m_map         = {r["date"]: r["value"] for r in macro_portfolio}
    initial_price = float(df['Close'].iloc[0])
    all_dates     = sorted(set(q_map) | set(m_map))
    combined      = []
    for d in all_dates:
        nsei_price = float(df.loc[d, 'Close']) if d in df.index.astype(str).values else None
        nsei_val   = round(100000 * nsei_price / initial_price, 2) if nsei_price else None
        combined.append({
            "date":  d,
            "QUANT": q_map.get(d),
            "MACRO": m_map.get(d),
            "NSEI":  nsei_val
        })

    nsei_return = (float(df['Close'].iloc[-1]) - float(df['Close'].iloc[0])) / float(df['Close'].iloc[0]) * 100

    return {
        "quant_stats":     quant_stats,
        "macro_stats":     macro_stats,
        "chart_data":      combined,
        "quant_trades":    quant_trades,
        "macro_trades":    macro_trades,
        "quant_portfolio": quant_portfolio,
        "macro_portfolio": macro_portfolio,
        "alpha": {
            "quant_vs_nsei": round(quant_stats["total_return"] - nsei_return, 2),
            "macro_vs_nsei": round(macro_stats["total_return"] - nsei_return, 2),
        }
    }