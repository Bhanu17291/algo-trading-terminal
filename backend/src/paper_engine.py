"""
paper_engine.py
---------------
Runs after incremental_learn.py each evening.
Simulates QUANT and MACRO paper trading on live signals.

QUANT:  confidence >= 55%, 95% of capital, 3% stop-loss
MACRO:  confidence >= 65%, 60% of capital, 1.5% stop-loss

Flow each evening:
1. Load today's signal from DB
2. Check open trades — did any hit stop-loss today?
3. If HOLD signal and trade open → exit at today's close
4. If BUY signal and no open trade → enter at tomorrow's open (estimated as today's close)
5. Update equity curve for both profiles
"""

import yfinance as yf
import pytz
from datetime import datetime, date
from sqlalchemy.orm import Session
from src.database import get_db, Signal, Trade, EquityCurvePoint

IST = pytz.timezone("Asia/Kolkata")
TICKER = "^NSEI"

PROFILES = {
    "QUANT": {
        "confidence_threshold": 0.55,
        "position_size": 0.95,
        "stop_loss_pct": 0.03,
        "initial_capital": 1_000_000,   # ₹10 lakh starting capital
    },
    "MACRO": {
        "confidence_threshold": 0.65,
        "position_size": 0.60,
        "stop_loss_pct": 0.015,
        "initial_capital": 1_000_000,
    },
}


def get_latest_price() -> float:
    """Fetch today's closing price for NSEI."""
    df = yf.download(TICKER, period="3d", interval="1d", progress=False)
    return float(df["Close"].iloc[-1])


def get_current_equity(db: Session, profile: str) -> float:
    """Get latest equity value from equity curve table."""
    latest = (
        db.query(EquityCurvePoint)
        .filter(EquityCurvePoint.profile == profile)
        .order_by(EquityCurvePoint.id.desc())
        .first()
    )
    if latest:
        return latest.equity
    return PROFILES[profile]["initial_capital"]


def get_open_trade(db: Session, profile: str):
    return (
        db.query(Trade)
        .filter(Trade.profile == profile, Trade.status == "OPEN")
        .first()
    )


def close_trade(db: Session, trade: Trade, exit_price: float, exit_reason: str):
    """Close an open trade and record PnL."""
    trade.exit_price = exit_price
    trade.exit_date = date.today().isoformat()
    trade.exit_reason = exit_reason
    trade.status = "CLOSED"

    trade.pnl_pct = (exit_price - trade.entry_price) / trade.entry_price
    trade.pnl_abs = trade.pnl_pct * trade.position_size * get_current_equity(db, trade.profile)
    db.commit()
    print(f"[{trade.profile}] Trade CLOSED @ {exit_price:.2f} | PnL: {trade.pnl_pct*100:.2f}% | Reason: {exit_reason}")


def open_trade(db: Session, profile: str, entry_price: float, confidence: float):
    cfg = PROFILES[profile]
    equity = get_current_equity(db, profile)
    trade = Trade(
        profile=profile,
        entry_date=date.today().isoformat(),
        entry_price=entry_price,
        position_size=cfg["position_size"],
        stop_loss_pct=cfg["stop_loss_pct"],
        status="OPEN",
        signal_confidence=confidence,
    )
    db.add(trade)
    db.commit()
    print(f"[{profile}] Trade OPENED @ {entry_price:.2f} | Size: {cfg['position_size']*100:.0f}% capital | SL: {cfg['stop_loss_pct']*100:.1f}%")


def update_equity_curve(db: Session, profile: str, current_price: float):
    """
    Recalculate equity based on open/closed trades today.
    Mark-to-market on open positions.
    """
    equity = get_current_equity(db, profile)
    open_trade = get_open_trade(db, profile)
    daily_return = 0.0

    if open_trade:
        price_return = (current_price - open_trade.entry_price) / open_trade.entry_price
        daily_return = price_return * open_trade.position_size
        equity = equity * (1 + daily_return)

    # Calculate peak for drawdown
    all_points = (
        db.query(EquityCurvePoint)
        .filter(EquityCurvePoint.profile == profile)
        .order_by(EquityCurvePoint.id)
        .all()
    )
    peak = max((p.equity for p in all_points), default=equity)
    drawdown = (equity - peak) / peak if peak > 0 else 0.0

    point = EquityCurvePoint(
        date=date.today().isoformat(),
        profile=profile,
        equity=round(equity, 2),
        daily_return=round(daily_return, 6),
        drawdown=round(drawdown, 6),
    )
    db.add(point)
    db.commit()
    print(f"[{profile}] Equity: ₹{equity:,.0f} | Daily: {daily_return*100:.2f}% | DD: {drawdown*100:.2f}%")
    return equity


def run_paper_engine():
    """Main entry point — called after incremental_learn.py each evening."""
    print(f"\n[{datetime.now(IST).strftime('%H:%M:%S IST')}] Running paper trading engine...")

    db = next(get_db())
    today = date.today().isoformat()
    current_price = get_latest_price()
    print(f"NSEI close today: {current_price:.2f}")

    # Get today's signal
    signal_row = db.query(Signal).filter(Signal.date == today).first()
    if not signal_row:
        print("No signal found for today. Skipping paper engine.")
        return

    signal = signal_row.signal
    confidence = signal_row.confidence
    print(f"Signal: {signal} @ {confidence*100:.1f}% confidence")

    for profile, cfg in PROFILES.items():
        print(f"\n--- {profile} ---")
        open_tr = get_open_trade(db, profile)

        # Check stop-loss on open trade
        if open_tr:
            price_return = (current_price - open_tr.entry_price) / open_tr.entry_price
            if price_return <= -cfg["stop_loss_pct"]:
                close_trade(db, open_tr, current_price, "STOP_LOSS")
                open_tr = None

        # Exit on HOLD signal
        if open_tr and signal == "HOLD":
            close_trade(db, open_tr, current_price, "SIGNAL")
            open_tr = None

        # Enter on BUY signal if no open trade and confidence meets threshold
        if signal == "BUY" and not open_tr and confidence >= cfg["confidence_threshold"]:
            open_trade(db, profile, current_price, confidence)

        # Mark-to-market equity curve
        update_equity_curve(db, profile, current_price)

    print("\nPaper engine complete.")


if __name__ == "__main__":
    run_paper_engine()