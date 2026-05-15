"""
db_data.py
----------
Replaces all CSV/cache reads with live PostgreSQL queries.
Drop this into backend/src/ and import wherever you need data.

Usage:
    from src.db_data import get_ohlcv_df, get_features_df, get_trades_df, get_portfolio_df
"""

import os
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# ── DB connection (same logic as database.py) ─────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./nsei_terminal.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ═══════════════════════════════════════════════════════════════════════════════
# OHLCV + FEATURES TABLE
# We store engineered features (the 27 cols your model uses) in a single table.
# Schema is created by ensure_ohlcv_table() below — call once on startup.
# ═══════════════════════════════════════════════════════════════════════════════

OHLCV_TABLE = "ohlcv_features"

def ensure_ohlcv_table():
    """
    Creates the ohlcv_features table if it doesn't exist.
    Columns: date (PK) + all OHLCV + all 27 engineered features + label.
    Call this once at startup before any reads/writes.
    """
    with engine.connect() as conn:
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {OHLCV_TABLE} (
                date        DATE PRIMARY KEY,
                open        FLOAT,
                high        FLOAT,
                low         FLOAT,
                close       FLOAT,
                volume      FLOAT,

                -- Returns & momentum
                returns          FLOAT,
                log_returns      FLOAT,
                momentum_3       FLOAT,
                momentum_5       FLOAT,
                momentum_10      FLOAT,
                momentum_20      FLOAT,

                -- Moving averages & trend
                sma20            FLOAT,
                sma50            FLOAT,
                ema12            FLOAT,
                ema26            FLOAT,
                price_vs_sma20   FLOAT,
                price_vs_sma50   FLOAT,

                -- Volatility
                atr              FLOAT,
                volatility_10    FLOAT,
                volatility_20    FLOAT,
                bb_upper         FLOAT,
                bb_lower         FLOAT,
                bb_width         FLOAT,
                bb_pct           FLOAT,

                -- Oscillators
                rsi              FLOAT,
                macd             FLOAT,
                macd_signal      FLOAT,
                macd_hist        FLOAT,
                stoch_k          FLOAT,
                stoch_d          FLOAT,

                -- Volume
                obv              FLOAT,
                volume_ratio     FLOAT,

                -- Candlestick structure
                body_size        FLOAT,
                upper_wick       FLOAT,
                lower_wick       FLOAT,

                -- Regime
                regime           INTEGER,

                -- Label (for training)
                label            VARCHAR(10),

                created_at       TIMESTAMP DEFAULT NOW(),
                updated_at       TIMESTAMP DEFAULT NOW()
            );
        """))
        conn.commit()
    logger.info(f"[db_data] Table '{OHLCV_TABLE}' ready.")


def get_features_df(days: int = None) -> pd.DataFrame:
    """
    Fetch engineered features from DB as a DataFrame (same format as nsei_features.csv).
    
    Args:
        days: if set, only fetch last N days. None = fetch all.
    
    Returns:
        DataFrame indexed by date, sorted ascending.
    """
    query = f"SELECT * FROM {OHLCV_TABLE} ORDER BY date ASC"
    if days:
        query = f"""
            SELECT * FROM {OHLCV_TABLE}
            WHERE date >= NOW() - INTERVAL '{days} days'
            ORDER BY date ASC
        """
    with engine.connect() as conn:
        df = pd.read_sql(text(query), conn, index_col="date", parse_dates=["date"])
    
    # Drop metadata columns
    for col in ["created_at", "updated_at"]:
        if col in df.columns:
            df = df.drop(columns=[col])
    
    # Rename 'close' → 'Close' etc. to match your existing code
    rename_map = {"open": "Open", "high": "High", "low": "Low",
                  "close": "Close", "volume": "Volume"}
    df = df.rename(columns=rename_map)
    
    logger.info(f"[db_data] Loaded {len(df)} rows from '{OHLCV_TABLE}'.")
    return df


def get_latest_features_row() -> pd.Series:
    """Returns the most recent row — used for live signal generation."""
    with engine.connect() as conn:
        df = pd.read_sql(
            text(f"SELECT * FROM {OHLCV_TABLE} ORDER BY date DESC LIMIT 1"),
            conn, index_col="date", parse_dates=["date"]
        )
    for col in ["created_at", "updated_at"]:
        if col in df.columns:
            df = df.drop(columns=[col])
    rename_map = {"open": "Open", "high": "High", "low": "Low",
                  "close": "Close", "volume": "Volume"}
    df = df.rename(columns=rename_map)
    return df.iloc[-1]


def upsert_ohlcv_row(row: dict):
    """
    Insert or update a single day's OHLCV + features row.
    row keys must match column names (lowercase).
    """
    cols   = ", ".join(row.keys())
    vals   = ", ".join([f":{k}" for k in row.keys()])
    update = ", ".join([f"{k} = EXCLUDED.{k}" for k in row.keys() if k != "date"])
    sql = text(f"""
        INSERT INTO {OHLCV_TABLE} ({cols})
        VALUES ({vals})
        ON CONFLICT (date) DO UPDATE SET {update}, updated_at = NOW();
    """)
    with engine.begin() as conn:
        conn.execute(sql, row)
    logger.info(f"[db_data] Upserted row for {row.get('date')}.")


def upsert_ohlcv_bulk(df: pd.DataFrame):
    """
    Bulk upsert a DataFrame into ohlcv_features.
    df must have date as index or column, lowercase column names.
    """
    if df.index.name == "date" or df.index.name == "Date":
        df = df.reset_index()
    
    # Lowercase all column names
    df.columns = [c.lower() for c in df.columns]
    df["date"] = pd.to_datetime(df["date"]).dt.date
    
    rows = df.to_dict(orient="records")
    if not rows:
        return
    
    cols   = ", ".join(rows[0].keys())
    vals   = ", ".join([f":{k}" for k in rows[0].keys()])
    update = ", ".join([f"{k} = EXCLUDED.{k}" for k in rows[0].keys() if k != "date"])
    sql = text(f"""
        INSERT INTO {OHLCV_TABLE} ({cols})
        VALUES ({vals})
        ON CONFLICT (date) DO UPDATE SET {update}, updated_at = NOW();
    """)
    with engine.begin() as conn:
        conn.executemany(sql, rows)
    logger.info(f"[db_data] Bulk upserted {len(rows)} rows into '{OHLCV_TABLE}'.")


def get_last_stored_date() -> str | None:
    """Returns the most recent date in ohlcv_features, or None if table is empty."""
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT MAX(date) FROM {OHLCV_TABLE}")).scalar()
    return str(result) if result else None


# ═══════════════════════════════════════════════════════════════════════════════
# PORTFOLIO + TRADES — read from existing DB tables (signals, trades, equity_curve)
# ═══════════════════════════════════════════════════════════════════════════════

def get_trades_df(profile: str = None) -> pd.DataFrame:
    """
    Fetch trade log from DB as DataFrame.
    Mirrors the old trades_log.csv format.
    """
    from src.database import Trade
    db = SessionLocal()
    try:
        q = db.query(Trade)
        if profile:
            q = q.filter(Trade.profile == profile.upper())
        trades = q.order_by(Trade.id).all()
        return pd.DataFrame([{
            "date":       t.entry_date,
            "action":     "BUY" if t.status == "OPEN" else "SELL",
            "price":      t.entry_price if t.status == "OPEN" else t.exit_price,
            "pnl":        t.pnl_abs or 0,
            "confidence": t.signal_confidence or 0,
            "profile":    t.profile,
            "status":     t.status,
            "exit_reason": t.exit_reason,
        } for t in trades])
    finally:
        db.close()


def get_portfolio_df(profile: str = "STRATEGY") -> pd.DataFrame:
    """
    Fetch equity curve from DB as DataFrame.
    Mirrors the old portfolio.csv format.
    """
    from src.database import EquityCurvePoint
    db = SessionLocal()
    try:
        points = (db.query(EquityCurvePoint)
                    .filter(EquityCurvePoint.profile == profile)
                    .order_by(EquityCurvePoint.id)
                    .all())
        return pd.DataFrame([{
            "date":         p.date,
            "value":        p.equity,
            "daily_return": p.daily_return,
            "drawdown":     p.drawdown,
        } for p in points])
    finally:
        db.close()