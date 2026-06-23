"""
fix_ohlcv_columns.py
--------------------
Adds all 27 model feature columns to the ohlcv_features table
if they don't already exist. Safe to run multiple times.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from src.database import engine
from sqlalchemy import text

COLUMNS = [
    ("sma_cross",      "FLOAT"),
    ("rsi",            "FLOAT"),
    ("macd",           "FLOAT"),
    ("macd_signal",    "FLOAT"),
    ("macd_diff",      "FLOAT"),
    ("bb_width",       "FLOAT"),
    ("bb_pos",         "FLOAT"),
    ("volume_ratio",   "FLOAT"),
    ("day_of_week",    "INTEGER"),
    ("month",          "INTEGER"),
    ("atr_ratio",      "FLOAT"),
    ("volatility_10",  "FLOAT"),
    ("volatility_20",  "FLOAT"),
    ("dist_60d_high",  "FLOAT"),
    ("dist_60d_low",   "FLOAT"),
    ("weekly_return",  "FLOAT"),
    ("monthly_return", "FLOAT"),
    ("obv_ratio",      "FLOAT"),
    ("wick_ratio",     "FLOAT"),
    ("regime_vol",     "FLOAT"),
    ("trend_strength", "FLOAT"),
    ("returns",        "FLOAT"),
    ("mom_5",          "FLOAT"),
    ("mom_10",         "FLOAT"),
    ("body_size",      "FLOAT"),
    ("rsi_divergence", "FLOAT"),
    ("upper_wick",     "FLOAT"),
]

with engine.begin() as conn:
    for col_name, col_type in COLUMNS:
        conn.execute(text(
            f"ALTER TABLE ohlcv_features ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
        ))
        print(f"  OK: {col_name} ({col_type})")

print("\nAll 27 feature columns ready in ohlcv_features.")