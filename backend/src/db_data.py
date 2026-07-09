"""
db_data.py — Fixed: includes all 27 model features in DB schema
"""

import logging
import pandas as pd
from sqlalchemy import text
from src.database import engine, SessionLocal

logger = logging.getLogger(__name__)
OHLCV_TABLE = "ohlcv_features"

OHLCV_COLUMNS = [
    "date",
    "open", "high", "low", "close", "volume",
    "returns", "log_returns",
    "momentum_3", "momentum_5", "momentum_10", "momentum_20",
    "sma20", "sma50", "ema12", "ema26",
    "price_vs_sma20", "price_vs_sma50",
    "atr", "volatility_10", "volatility_20",
    "bb_upper", "bb_lower", "bb_width", "bb_pct",
    "rsi", "macd", "macd_signal", "macd_hist",
    "stoch_k", "stoch_d",
    "obv", "volume_ratio",
    "body_size", "upper_wick", "lower_wick",
    "regime", "label",
    # ── 17 model features missing from original schema ──
    "sma_cross", "macd_diff", "bb_pos",
    "day_of_week", "month",
    "atr_ratio", "dist_60d_high", "dist_60d_low",
    "weekly_return", "monthly_return",
    "obv_ratio", "wick_ratio", "regime_vol", "trend_strength",
    "mom_5", "mom_10", "rsi_divergence",
]

# All columns that must be float for XGBoost
NUMERIC_COLUMNS = [c for c in OHLCV_COLUMNS if c not in ("date", "label")]


def _cast_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Force all numeric columns to float — PostgreSQL can return object dtype."""
    for col in NUMERIC_COLUMNS:
        for c in [col, col.capitalize(), col.upper()]:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(float)
    return df


def ensure_ohlcv_table():
    """Creates or migrates the OHLCV + features table."""
    # Create base table if not exists
    sql = f"""
    CREATE TABLE IF NOT EXISTS {OHLCV_TABLE} (
        date            DATE PRIMARY KEY,
        open FLOAT, high FLOAT, low FLOAT, close FLOAT, volume FLOAT,
        returns FLOAT, log_returns FLOAT,
        momentum_3 FLOAT, momentum_5 FLOAT, momentum_10 FLOAT, momentum_20 FLOAT,
        sma20 FLOAT, sma50 FLOAT, ema12 FLOAT, ema26 FLOAT,
        price_vs_sma20 FLOAT, price_vs_sma50 FLOAT,
        atr FLOAT, volatility_10 FLOAT, volatility_20 FLOAT,
        bb_upper FLOAT, bb_lower FLOAT, bb_width FLOAT, bb_pct FLOAT,
        rsi FLOAT, macd FLOAT, macd_signal FLOAT, macd_hist FLOAT,
        stoch_k FLOAT, stoch_d FLOAT,
        obv FLOAT, volume_ratio FLOAT,
        body_size FLOAT, upper_wick FLOAT, lower_wick FLOAT,
        regime INTEGER, label VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """
    with engine.begin() as conn:
        conn.execute(text(sql))

    # Add missing feature columns if they don't exist (safe migration)
    new_cols = [
        ("sma_cross",      "FLOAT"),
        ("macd_diff",      "FLOAT"),
        ("bb_pos",         "FLOAT"),
        ("day_of_week",    "FLOAT"),
        ("month",          "FLOAT"),
        ("atr_ratio",      "FLOAT"),
        ("dist_60d_high",  "FLOAT"),
        ("dist_60d_low",   "FLOAT"),
        ("weekly_return",  "FLOAT"),
        ("monthly_return", "FLOAT"),
        ("obv_ratio",      "FLOAT"),
        ("wick_ratio",     "FLOAT"),
        ("regime_vol",     "FLOAT"),
        ("trend_strength", "FLOAT"),
        ("mom_5",          "FLOAT"),
        ("mom_10",         "FLOAT"),
        ("rsi_divergence", "FLOAT"),
    ]
    with engine.begin() as conn:
        for col_name, col_type in new_cols:
            try:
                conn.execute(text(
                    f"ALTER TABLE {OHLCV_TABLE} ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
            except Exception as e:
                logger.warning(f"[db_data] Could not add column {col_name}: {e}")

    logger.info("[db_data] Table '%s' ready with all 27 features.", OHLCV_TABLE)


def get_features_df(days: int = None) -> pd.DataFrame:
    if days:
        query = text(f"""
            SELECT * FROM {OHLCV_TABLE}
            WHERE date >= CURRENT_DATE - INTERVAL '{int(days)} days'
            ORDER BY date ASC
        """)
    else:
        query = text(f"SELECT * FROM {OHLCV_TABLE} ORDER BY date ASC")

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, index_col="date", parse_dates=["date"])

    for col in ["created_at", "updated_at"]:
        if col in df.columns:
            df.drop(columns=[col], inplace=True)

    df = _cast_numeric(df)

    df.rename(columns={
        "open": "Open", "high": "High",
        "low": "Low", "close": "Close", "volume": "Volume",
    }, inplace=True)

    df = _cast_numeric(df)
    logger.info("[db_data] Loaded %d rows.", len(df))
    return df


def get_latest_features_row() -> pd.Series:
    query = text(f"SELECT * FROM {OHLCV_TABLE} ORDER BY date DESC LIMIT 1")
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, index_col="date", parse_dates=["date"])

    for col in ["created_at", "updated_at"]:
        if col in df.columns:
            df.drop(columns=[col], inplace=True)

    df = _cast_numeric(df)
    df.rename(columns={
        "open": "Open", "high": "High",
        "low": "Low", "close": "Close", "volume": "Volume",
    }, inplace=True)
    df = _cast_numeric(df)
    return df.iloc[-1]


def upsert_ohlcv_bulk(df: pd.DataFrame):
    if df.index.name in ("date", "Date"):
        df = df.reset_index()

    df.columns = [c.lower() for c in df.columns]
    df["date"] = pd.to_datetime(df["date"]).dt.date

    valid_cols = [c for c in OHLCV_COLUMNS if c in df.columns]
    df = df[valid_cols]

    rows = df.to_dict(orient="records")
    if not rows:
        logger.warning("[db_data] No rows to upsert.")
        return

    cols   = ", ".join(valid_cols)
    vals   = ", ".join(f":{c}" for c in valid_cols)
    update = ", ".join(f"{c}=EXCLUDED.{c}" for c in valid_cols if c != "date")

    sql = text(f"""
        INSERT INTO {OHLCV_TABLE} ({cols})
        VALUES ({vals})
        ON CONFLICT (date)
        DO UPDATE SET {update}, updated_at = NOW()
    """)

    with engine.begin() as conn:
        conn.execute(sql, rows)

    logger.info("[db_data] Bulk upserted %d rows.", len(rows))


def upsert_ohlcv_row(row: dict):
    valid_cols = [c for c in OHLCV_COLUMNS if c in row]
    clean_row  = {c: row[c] for c in valid_cols}

    cols   = ", ".join(valid_cols)
    vals   = ", ".join(f":{c}" for c in valid_cols)
    update = ", ".join(f"{c}=EXCLUDED.{c}" for c in valid_cols if c != "date")

    sql = text(f"""
        INSERT INTO {OHLCV_TABLE} ({cols})
        VALUES ({vals})
        ON CONFLICT (date)
        DO UPDATE SET {update}, updated_at = NOW()
    """)

    with engine.begin() as conn:
        conn.execute(sql, clean_row)

    logger.info("[db_data] Upserted row for %s.", row.get("date"))


def get_last_stored_date() -> str | None:
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT MAX(date) FROM {OHLCV_TABLE}")
        ).scalar()
    return str(result) if result else None


def get_trades_df(profile: str = None) -> pd.DataFrame:
    from src.database import Trade
    db = SessionLocal()
    try:
        q = db.query(Trade)
        if profile:
            q = q.filter(Trade.profile == profile.upper())
        trades = q.order_by(Trade.id).all()
        return pd.DataFrame([{
            "date":        str(t.entry_date if t.status == "OPEN" else t.exit_date),
            "action":      "BUY" if t.status == "OPEN" else "SELL",
            "price":       t.entry_price if t.status == "OPEN" else t.exit_price,
            "pnl":         t.pnl_abs or 0,
            "confidence":  t.signal_confidence or 0,
            "profile":     t.profile,
            "status":      t.status,
            "exit_reason": t.exit_reason,
        } for t in trades])
    finally:
        db.close()


def get_portfolio_df(profile: str = "QUANT") -> pd.DataFrame:
    from src.database import EquityCurvePoint
    db = SessionLocal()
    try:
        points = (db.query(EquityCurvePoint)
                    .filter(EquityCurvePoint.profile == profile)
                    .order_by(EquityCurvePoint.id).all())
        return pd.DataFrame([{
            "date":         str(p.date),
            "value":        p.equity,
            "daily_return": p.daily_return,
            "drawdown":     p.drawdown,
        } for p in points])
    finally:
        db.close()