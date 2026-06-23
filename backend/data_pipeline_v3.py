"""
data_pipeline_v3.py
-------------------
Fetches NSEI OHLCV data, engineers ALL 27 model features,
and upserts everything into the ohlcv_features PostgreSQL table.
"""

import pandas as pd
import numpy as np
import yfinance as yf
import ta
import os
import sys

# Allow running from project root or backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from src.db_data import upsert_ohlcv_bulk

print("Fetching NSEI data...")
df = yf.download(
    "^NSEI",
    start="2020-01-01",
    end="2026-06-01",
    interval="1d",
    auto_adjust=False,
)
df.dropna(inplace=True)
df.columns = [c[0].lower() if isinstance(c, tuple) else c.lower() for c in df.columns]
df.index = pd.to_datetime(df.index)
df = df[["open", "high", "low", "close", "volume"]].copy()
print(f"  Fetched {len(df)} rows")

# ── Feature Engineering ────────────────────────────────────────────────────

close = df["close"]
high  = df["high"]
low   = df["low"]
vol   = df["volume"]

# 1. sma_cross — SMA20 > SMA50
sma20 = close.rolling(20).mean()
sma50 = close.rolling(50).mean()
df["sma_cross"] = (sma20 > sma50).astype(int)

# 2. rsi
df["rsi"] = ta.momentum.RSIIndicator(close, window=14).rsi()

# 3-5. macd, macd_signal, macd_diff
macd_ind = ta.trend.MACD(close)
df["macd"]        = macd_ind.macd()
df["macd_signal"] = macd_ind.macd_signal()
df["macd_diff"]   = macd_ind.macd_diff()

# 6-7. bb_width, bb_pos
bb = ta.volatility.BollingerBands(close, window=20)
bb_upper = bb.bollinger_hband()
bb_lower = bb.bollinger_lband()
bb_mid   = bb.bollinger_mavg()
df["bb_width"] = (bb_upper - bb_lower) / bb_mid
df["bb_pos"]   = (close - bb_lower) / (bb_upper - bb_lower + 1e-9)

# 8. volume_ratio — volume vs 20-day avg
df["volume_ratio"] = vol / vol.rolling(20).mean()

# 9-10. day_of_week, month
df["day_of_week"] = df.index.dayofweek
df["month"]       = df.index.month

# 11. atr_ratio
atr = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()
df["atr_ratio"] = atr / close

# 12-13. volatility_10, volatility_20
returns = close.pct_change()
df["returns"]       = returns
df["volatility_10"] = returns.rolling(10).std()
df["volatility_20"] = returns.rolling(20).std()

# 14-15. dist_60d_high, dist_60d_low
df["dist_60d_high"] = (close - high.rolling(60).max())  / close
df["dist_60d_low"]  = (close - low.rolling(60).min())   / close

# 16-17. weekly_return, monthly_return
df["weekly_return"]  = close.pct_change(5)
df["monthly_return"] = close.pct_change(21)

# 18. obv_ratio — OBV normalised
obv = ta.volume.OnBalanceVolumeIndicator(close, vol).on_balance_volume()
df["obv_ratio"] = obv / obv.rolling(20).mean()

# 19. wick_ratio — total wick / body
body = (df["close"] - df["open"]).abs()
wick = (high - low) - body
df["wick_ratio"] = wick / (body + 1e-9)

# 20. regime_vol — 20-day vol percentile (0-1)
vol20 = returns.rolling(20).std()
df["regime_vol"] = vol20.rolling(252).rank(pct=True)

# 21. trend_strength — abs(slope of SMA20 over 5 days)
df["trend_strength"] = sma20.diff(5).abs() / close

# 22-23. mom_5, mom_10
df["mom_5"]  = close.pct_change(5)
df["mom_10"] = close.pct_change(10)

# 24. body_size — body as fraction of range
df["body_size"] = body / (high - low + 1e-9)

# 25. rsi_divergence — RSI change when price is flat
rsi_chg   = df["rsi"].diff(5)
price_chg = close.pct_change(5)
df["rsi_divergence"] = rsi_chg - price_chg * 100

# 26. upper_wick — upper wick / range
upper_wick = high - df[["open", "close"]].max(axis=1)
df["upper_wick"] = upper_wick / (high - low + 1e-9)

# ── Finalise ───────────────────────────────────────────────────────────────

FEATURE_COLS = [
    "sma_cross", "rsi", "macd", "macd_signal", "macd_diff",
    "bb_width", "bb_pos", "volume_ratio", "day_of_week", "month",
    "atr_ratio", "volatility_10", "volatility_20", "dist_60d_high",
    "dist_60d_low", "weekly_return", "monthly_return", "obv_ratio",
    "wick_ratio", "regime_vol", "trend_strength", "returns",
    "mom_5", "mom_10", "body_size", "rsi_divergence", "upper_wick",
]

OHLCV_COLS = ["open", "high", "low", "close", "volume"]
ALL_COLS   = OHLCV_COLS + FEATURE_COLS

df = df[ALL_COLS].copy()
df.dropna(inplace=True)
df.index.name = "date"
df.reset_index(inplace=True)

print(f"  Engineered {len(FEATURE_COLS)} features, {len(df)} clean rows")
print("Upserting to PostgreSQL...")

upsert_ohlcv_bulk(df)

print(f"Done. {len(df)} rows upserted into ohlcv_features.")