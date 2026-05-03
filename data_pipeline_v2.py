import pandas as pd
import numpy as np
import yfinance as yf
import ta
import os

# ── 1. FETCH DATA ──────────────────────────────────────────────
print("Fetching NSEI data...")

df = yf.download("^NSEI", start="2023-01-01", end="2026-04-01", interval="1d")
df.dropna(inplace=True)
df.columns = df.columns.droplevel(1)
print(f"✅ Downloaded {len(df)} rows")

# ── 2. FEATURE ENGINEERING ─────────────────────────────────────
print("Engineering features...")

# Trend
df['sma20']     = df['Close'].rolling(20).mean()
df['sma50']     = df['Close'].rolling(50).mean()
df['sma_cross'] = (df['sma20'] - df['sma50']) / df['Close']

# Momentum
df['rsi'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()

macd = ta.trend.MACD(df['Close'])
df['macd']        = macd.macd()
df['macd_signal'] = macd.macd_signal()
df['macd_diff']   = macd.macd_diff()

# Volatility
bb = ta.volatility.BollingerBands(df['Close'], window=20)
df['bb_upper'] = bb.bollinger_hband()
df['bb_lower'] = bb.bollinger_lband()
df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['Close']
df['bb_pos']   = (df['Close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

# Volume
df['volume_ma20']  = df['Volume'].rolling(20).mean()
df['volume_ratio'] = df['Volume'] / df['volume_ma20']

# Seasonality
df['day_of_week'] = df.index.dayofweek
df['month']       = df.index.month

# ATR
df['atr']       = (df['High'] - df['Low']).rolling(14).mean()
df['atr_ratio'] = df['atr'] / df['Close']

# Volatility
df['returns']       = df['Close'].pct_change()
df['volatility_10'] = df['returns'].rolling(10).std()
df['volatility_20'] = df['returns'].rolling(20).std()

# Price levels — 60 day
df['high_60d']      = df['High'].rolling(60).max()
df['low_60d']       = df['Low'].rolling(60).min()
df['dist_60d_high'] = (df['Close'] - df['high_60d']) / df['high_60d']
df['dist_60d_low']  = (df['Close'] - df['low_60d'])  / df['low_60d']

# Multi-timeframe momentum
df['weekly_return']  = df['Close'].pct_change(5)
df['monthly_return'] = df['Close'].pct_change(21)

# OBV
df['obv']       = (np.sign(df['Close'].diff()) * df['Volume']).cumsum()
df['obv_ratio'] = df['obv'] / (df['obv'].rolling(20).mean() + 1e-9)

# Candlestick structure
df['upper_wick'] = df['High'] - df[['Close', 'Open']].max(axis=1)
df['lower_wick'] = df[['Close', 'Open']].min(axis=1) - df['Low']
df['body_size']  = (df['Close'] - df['Open']).abs()
df['wick_ratio'] = (df['upper_wick'] - df['lower_wick']) / (df['body_size'] + 1e-9)

# Regime
df['regime_vol']     = df['atr_ratio'] / (df['atr_ratio'].rolling(20).mean() + 1e-9)
df['trend_strength'] = (
    abs(df['Close'] - df['Close'].rolling(20).mean()) /
    (df['Close'].rolling(20).std() + 1e-9)
)

# Momentum
df['mom_5']  = df['Close'].pct_change(5)
df['mom_10'] = df['Close'].pct_change(10)

# RSI divergence
df['rsi_diff']      = df['rsi'].diff(3)
df['price_diff']    = df['Close'].pct_change(3)
df['rsi_divergence'] = np.sign(df['rsi_diff']) - np.sign(df['price_diff'])

print("✅ Features engineered")

# ── 3. SMARTER LABEL GENERATION ───────────────────────────────
print("Generating labels...")

# Use 3-day forward return instead of 5 — less noise, more predictable
# Use dynamic threshold based on recent volatility instead of fixed 1%
FORWARD_DAYS = 3

df['future_return'] = df['Close'].shift(-FORWARD_DAYS) / df['Close'] - 1

# Dynamic threshold — use 0.5x recent volatility so labels adapt to market conditions
df['vol_threshold'] = df['volatility_10'].rolling(20).mean() * 0.5
df['vol_threshold'] = df['vol_threshold'].clip(lower=0.005, upper=0.025)

df['label'] = 0  # HOLD
df.loc[df['future_return'] >  df['vol_threshold'], 'label'] =  1   # BUY
df.loc[df['future_return'] < -df['vol_threshold'], 'label'] = -1   # SELL

print("Label distribution:")
print(df['label'].value_counts())
print(f"\nAvg threshold: {df['vol_threshold'].mean():.4f}")

# ── 4. CLEAN & SAVE ────────────────────────────────────────────
df.dropna(inplace=True)
df.drop(columns=['vol_threshold'], inplace=True)

os.makedirs("data", exist_ok=True)
df.to_csv("data/nsei_features.csv")

print(f"\n✅ Saved {len(df)} rows to data/nsei_features.csv")
print(f"   Features ready for train_model_v4.py")