"""
seed_demo_data.py
-----------------
Run ONCE to seed 30 days of realistic signal + paper trade data.
This powers "Demo Mode" on the frontend — shows a fully populated
dashboard to a VC even before real data accumulates.

Usage:
    python seed_demo_data.py

Safe to re-run — checks if data already exists before inserting.
"""

import yfinance as yf
import numpy as np
import pandas as pd
from datetime import date, timedelta, datetime
from database import create_tables, get_db, Signal, Trade, EquityCurvePoint
import pytz

IST = pytz.timezone("Asia/Kolkata")
INITIAL_CAPITAL = 1_000_000
np.random.seed(42)


def get_past_nsei(days: int = 60) -> pd.DataFrame:
    df = yf.download("^NSEI", period=f"{days}d", interval="1d", progress=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0].lower() for col in df.columns]
    else:
        df.columns = [col[0].lower() if isinstance(col, tuple) else col.lower() for col in df.columns]
    df = df[["open", "high", "low", "close", "volume"]].dropna()
    return df

def seed():
    create_tables()
    db = next(get_db())

    # Check if already seeded
    if db.query(Signal).count() > 0:
        print("Data already exists. Skipping seed. Delete rows manually to re-seed.")
        return

    print("Fetching historical NSEI data...")
    df = get_past_nsei(days=60)
    trading_days = df.index[-30:]     # last 30 trading days

    quant_equity = INITIAL_CAPITAL
    macro_equity = INITIAL_CAPITAL
    quant_open_trade = None
    macro_open_trade = None

    print(f"Seeding {len(trading_days)} days of demo data...")

    for i, ts in enumerate(trading_days):
        day_str = ts.date().isoformat()
        close_price = float(df.loc[ts, "close"])
        open_price = float(df.loc[ts, "open"])

        # Realistic confidence: 55–85% range, BUY on ~60% of days
        confidence = round(np.random.uniform(0.52, 0.87), 4)
        signal = "BUY" if confidence >= 0.58 and np.random.random() > 0.35 else "HOLD"

        # Determine actual outcome
        if i < len(trading_days) - 1:
            next_close = float(df.loc[trading_days[i + 1], "close"])
            actual_return = (next_close - close_price) / close_price
            actual_outcome = "BUY" if actual_return > 0.003 else "HOLD"
            was_correct = int(signal == actual_outcome)
        else:
            actual_outcome = None
            was_correct = None
            actual_return = None

        sig = Signal(
            date=day_str,
            signal=signal,
            confidence=confidence,
            model_version=1 + i,          # version bumps each day
            actual_outcome=actual_outcome,
            was_correct=was_correct,
            actual_return=actual_return,
            created_at=datetime.combine(ts.date(), datetime.min.time()),
        )
        db.add(sig)

        # ── QUANT paper trades ──
        if quant_open_trade:
            ret = (close_price - quant_open_trade["entry"]) / quant_open_trade["entry"]
            if signal == "HOLD" or ret <= -0.03:
                pnl_pct = ret
                pnl_abs = pnl_pct * 0.95 * quant_open_trade["equity_at_entry"]
                quant_equity += pnl_abs
                trade = Trade(
                    profile="QUANT",
                    entry_date=quant_open_trade["date"],
                    entry_price=quant_open_trade["entry"],
                    exit_date=day_str,
                    exit_price=close_price,
                    position_size=0.95,
                    stop_loss_pct=0.03,
                    status="CLOSED",
                    exit_reason="SIGNAL" if signal == "HOLD" else "STOP_LOSS",
                    pnl_pct=round(pnl_pct, 6),
                    pnl_abs=round(pnl_abs, 2),
                    signal_confidence=quant_open_trade["conf"],
                )
                db.add(trade)
                quant_open_trade = None

        if signal == "BUY" and confidence >= 0.55 and not quant_open_trade:
            quant_open_trade = {"date": day_str, "entry": close_price, "conf": confidence, "equity_at_entry": quant_equity}

        # ── MACRO paper trades ──
        if macro_open_trade:
            ret = (close_price - macro_open_trade["entry"]) / macro_open_trade["entry"]
            if signal == "HOLD" or ret <= -0.015:
                pnl_pct = ret
                pnl_abs = pnl_pct * 0.60 * macro_open_trade["equity_at_entry"]
                macro_equity += pnl_abs
                trade = Trade(
                    profile="MACRO",
                    entry_date=macro_open_trade["date"],
                    entry_price=macro_open_trade["entry"],
                    exit_date=day_str,
                    exit_price=close_price,
                    position_size=0.60,
                    stop_loss_pct=0.015,
                    status="CLOSED",
                    exit_reason="SIGNAL" if signal == "HOLD" else "STOP_LOSS",
                    pnl_pct=round(pnl_pct, 6),
                    pnl_abs=round(pnl_abs, 2),
                    signal_confidence=macro_open_trade["conf"],
                )
                db.add(trade)
                macro_open_trade = None

        if signal == "BUY" and confidence >= 0.65 and not macro_open_trade:
            macro_open_trade = {"date": day_str, "entry": close_price, "conf": confidence, "equity_at_entry": macro_equity}

        # ── Equity curve ──
        for profile, equity in [("QUANT", quant_equity), ("MACRO", macro_equity)]:
            all_prev = db.query(EquityCurvePoint).filter(EquityCurvePoint.profile == profile).all()
            peak = max((p.equity for p in all_prev), default=equity)
            dd = (equity - max(peak, equity)) / max(peak, equity) if peak > 0 else 0.0
            db.add(EquityCurvePoint(
                date=day_str,
                profile=profile,
                equity=round(equity, 2),
                daily_return=0.0,
                drawdown=round(dd, 6),
            ))

    db.commit()
    print(f"\nSeed complete.")
    print(f"QUANT equity: ₹{quant_equity:,.0f} ({(quant_equity/INITIAL_CAPITAL-1)*100:.1f}% return)")
    print(f"MACRO equity: ₹{macro_equity:,.0f} ({(macro_equity/INITIAL_CAPITAL-1)*100:.1f}% return)")
    print(f"Signals: {db.query(Signal).count()}")
    print(f"Trades: {db.query(Trade).count()}")


if __name__ == "__main__":
    seed()