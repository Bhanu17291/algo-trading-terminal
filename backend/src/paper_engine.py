"""
paper_engine.py
---------------
Paper trading engine — runs at 3:40 PM IST (after incremental_learn.py).

Reads today's signal from DB, executes paper trades for QUANT and MACRO
profiles, writes results back to DB (trades + equity_curve tables).

Profile configs:
  QUANT  — 55% threshold, 95% position, 3% stop loss, 30d max hold
  MACRO  — 65% threshold, 60% position, 1.5% stop loss, 15d max hold
"""

import os
import logging
from datetime import date, datetime, timedelta
import pytz

from src.database import SessionLocal, Signal, Trade, EquityCurvePoint
from src.db_data import get_features_df

logger = logging.getLogger(__name__)
IST    = pytz.timezone("Asia/Kolkata")

INITIAL_CAPITAL = 1_000_000  # ₹10 lakh paper capital per profile

PROFILES = {
    "QUANT": {
        "confidence_threshold": 0.55,
        "position_fraction":    0.95,
        "stop_loss_pct":        0.03,
        "max_hold_days":        30,
    },
    "MACRO": {
        "confidence_threshold": 0.65,
        "position_fraction":    0.60,
        "stop_loss_pct":        0.015,
        "max_hold_days":        15,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def get_current_capital(db, profile: str) -> float:
    """
    Reconstructs current capital from equity_curve table.
    Falls back to INITIAL_CAPITAL if no history.
    """
    last = (db.query(EquityCurvePoint)
              .filter(EquityCurvePoint.profile == profile)
              .order_by(EquityCurvePoint.id.desc())
              .first())
    return last.equity if last else INITIAL_CAPITAL


def get_open_trade(db, profile: str):
    """Returns the currently open trade for a profile, or None."""
    return (db.query(Trade)
              .filter(Trade.profile == profile, Trade.status == "OPEN")
              .order_by(Trade.id.desc())
              .first())


def get_peak_equity(db, profile: str) -> float:
    """Returns the all-time peak equity for drawdown calculation."""
    points = (db.query(EquityCurvePoint)
                .filter(EquityCurvePoint.profile == profile)
                .all())
    if not points:
        return INITIAL_CAPITAL
    return max(p.equity for p in points)


def days_held(entry_date_str: str) -> int:
    try:
        entry = datetime.strptime(entry_date_str, "%Y-%m-%d").date()
        return (date.today() - entry).days
    except Exception:
        return 0


# ═══════════════════════════════════════════════════════════════════════════════
# CORE ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def run_profile_engine(db, profile: str, config: dict, signal: str,
                       confidence: float, today_close: float, today_str: str):
    """
    Executes one day's paper trading logic for a single profile.
    Writes trade entries/exits and equity curve point to DB.
    """
    capital    = get_current_capital(db, profile)
    open_trade = get_open_trade(db, profile)

    action_taken = "HOLD"

    # ── Check for exit conditions on open trade ───────────────────────────────
    if open_trade is not None:
        held     = days_held(open_trade.entry_date)
        stop_hit = today_close <= open_trade.entry_price * (1 - config["stop_loss_pct"])
        max_hit  = held >= config["max_hold_days"]
        sell_sig = signal == "HOLD" and confidence < 0.45  # model going cold

        if stop_hit or max_hit or sell_sig:
            pnl_abs = (today_close - open_trade.entry_price) * (open_trade.position_size / open_trade.entry_price)
            pnl_pct = (today_close - open_trade.entry_price) / open_trade.entry_price

            exit_reason = ("STOP_LOSS" if stop_hit else
                           "MAX_HOLD"  if max_hit  else "SIGNAL")

            open_trade.exit_date   = today_str
            open_trade.exit_price  = today_close
            open_trade.status      = "CLOSED"
            open_trade.exit_reason = exit_reason
            open_trade.pnl_pct     = pnl_pct
            open_trade.pnl_abs     = pnl_abs

            capital += open_trade.position_size + pnl_abs
            open_trade = None
            action_taken = f"SELL ({exit_reason})"
            logger.info(f"[{profile}] SELL — {exit_reason}, PnL={pnl_abs:.0f}, capital={capital:.0f}")

    # ── Check for entry ───────────────────────────────────────────────────────
    if open_trade is None and signal == "BUY" and confidence >= config["confidence_threshold"]:
        position_value = capital * config["position_fraction"]
        qty            = int(position_value / today_close)

        if qty > 0:
            cost          = qty * today_close
            capital      -= cost
            action_taken  = "BUY"

            new_trade = Trade(
                profile           = profile,
                entry_date        = today_str,
                entry_price       = today_close,
                position_size     = cost,
                stop_loss_pct     = config["stop_loss_pct"],
                status            = "OPEN",
                signal_confidence = confidence,
            )
            db.add(new_trade)
            logger.info(f"[{profile}] BUY — price={today_close}, qty={qty}, capital_remaining={capital:.0f}")

    # ── Mark-to-market equity ─────────────────────────────────────────────────
    open_trade_refreshed = get_open_trade(db, profile)
    mtm_value = 0.0
    if open_trade_refreshed:
        qty_held  = int(open_trade_refreshed.position_size / open_trade_refreshed.entry_price)
        mtm_value = qty_held * today_close

    total_equity = capital + mtm_value

    # Drawdown
    peak     = max(get_peak_equity(db, profile), total_equity)
    drawdown = (peak - total_equity) / peak if peak > 0 else 0.0

    # Daily return
    last_point = (db.query(EquityCurvePoint)
                    .filter(EquityCurvePoint.profile == profile)
                    .order_by(EquityCurvePoint.id.desc())
                    .first())
    daily_return = ((total_equity - last_point.equity) / last_point.equity
                    if last_point else 0.0)

    # Upsert equity curve point (one per day per profile)
    existing_point = (db.query(EquityCurvePoint)
                        .filter(EquityCurvePoint.profile == profile,
                                EquityCurvePoint.date == today_str)
                        .first())
    if existing_point:
        existing_point.equity       = total_equity
        existing_point.daily_return = daily_return
        existing_point.drawdown     = drawdown
    else:
        db.add(EquityCurvePoint(
            date         = today_str,
            profile      = profile,
            equity       = total_equity,
            daily_return = daily_return,
            drawdown     = drawdown,
        ))

    db.commit()
    logger.info(f"[{profile}] equity={total_equity:.0f}, drawdown={drawdown:.2%}, action={action_taken}")


# ═══════════════════════════════════════════════════════════════════════════════
# BACKFILL — seed DB from historical data (run once on first deploy)
# ═══════════════════════════════════════════════════════════════════════════════

def backfill_from_db():
    """
    Replays all historical OHLCV rows through the paper engine to seed
    the trades and equity_curve tables from scratch.
    Call once via: POST /api/paper/backfill
    """
    import joblib
    import numpy as np
    import xgboost as xgb

    MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
    xgb_model  = joblib.load(os.path.join(MODELS_DIR, "xgb_model.pkl"))
    lgbm_model = joblib.load(os.path.join(MODELS_DIR, "lgbm_model.pkl"))
    cat_model  = joblib.load(os.path.join(MODELS_DIR, "cat_model.pkl"))
    FEATURES   = joblib.load(os.path.join(MODELS_DIR, "features.pkl"))
    weights    = joblib.load(os.path.join(MODELS_DIR, "ensemble_weights.pkl"))

    df = get_features_df()
    if df.empty:
        logger.error("[backfill] No data in DB — run fetch_and_store_latest() first.")
        return

    db = SessionLocal()
    try:
        # Clear existing paper data
        db.query(Trade).delete()
        db.query(EquityCurvePoint).delete()
        db.commit()
        logger.info("[backfill] Cleared old trades + equity curve.")

        for i in range(1, len(df)):
            row     = df.iloc[[i]]
            row_idx = df.index[i]
            today_str   = str(row_idx.date())
            today_close = float(df["Close"].iloc[i])

            if row[FEATURES].isnull().any(axis=1).iloc[0]:
                continue

            p_xgb = xgb_model.predict(xgb.DMatrix(row[FEATURES]))
            p_lgb = lgbm_model.predict(row[FEATURES])
            p_cat = cat_model.predict_proba(row[FEATURES])[:, 1]
            buy_prob   = (weights["w_xgb"] * p_xgb[0] +
                          weights["w_lgbm"] * p_lgb[0] +
                          weights["w_cat"]  * p_cat[0])
            signal     = "BUY" if buy_prob >= 0.55 else "HOLD"
            confidence = float(buy_prob)

            for profile, config in PROFILES.items():
                run_profile_engine(db, profile, config, signal,
                                   confidence, today_close, today_str)

        logger.info(f"[backfill] Complete — {len(df)} rows processed.")
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — called by scheduler at 3:40 PM IST
# ═══════════════════════════════════════════════════════════════════════════════

def run_paper_engine():
    """
    Reads today's signal from DB, runs paper engine for QUANT + MACRO.
    """
    logger.info(f"[paper_engine] Starting at {datetime.now(IST).strftime('%H:%M:%S IST')}")

    db = SessionLocal()
    try:
        today_str = date.today().isoformat()

        # Get today's signal (written by incremental_learn 5 min ago)
        sig_row = db.query(Signal).filter(Signal.date == today_str).first()
        if not sig_row:
            logger.warning("[paper_engine] No signal for today — aborting.")
            return

        signal     = sig_row.signal
        confidence = sig_row.confidence

        # Get today's close from DB
        df = get_features_df(days=5)
        if df.empty:
            logger.error("[paper_engine] No OHLCV data — aborting.")
            return

        today_close = float(df["Close"].iloc[-1])
        logger.info(f"[paper_engine] signal={signal}, confidence={confidence:.3f}, close={today_close}")

        for profile, config in PROFILES.items():
            run_profile_engine(db, profile, config, signal,
                               confidence, today_close, today_str)

        logger.info("[paper_engine] Done.")

    except Exception as e:
        logger.exception(f"[paper_engine] FAILED: {e}")
        raise
    finally:
        db.close()