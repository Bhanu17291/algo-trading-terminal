import pandas as pd
import numpy as np
import yfinance as yf
import ta
import os

# ── 1. FETCH DATA ──────────────────────────────────────────────
print("Fetching NSEI data...")

df = yf.download("^NSEI", start="2023-01-01", end="2026-04-01", interval="1d")
df.dropna(inplace=True)
df.columns = df.columns.droplevel(1)  # flatten multi-index
print(f"✅ Downloaded {len(df)} rows")

# ── 2. FEATURE ENGINEERING ─────────────────────────────────────
print("Engineering features...")

# Trend
df['sma20']  = df['Close'].rolling(20).mean()
df['sma50']  = df['Close'].rolling(50).mean()
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
df['volume_ma20'] = df['Volume'].rolling(20).mean()
df['volume_ratio'] = df['Volume'] / df['volume_ma20']

# Seasonality
df['day_of_week'] = df.index.dayofweek
df['month']       = df.index.month

print("✅ Features engineered")

# ── 3. LABEL GENERATION ────────────────────────────────────────
print("Generating labels...")

FORWARD_DAYS = 5
THRESHOLD    = 0.01  # 1% move

df['future_return'] = df['Close'].shift(-FORWARD_DAYS) / df['Close'] - 1

df['label'] = 0  # HOLD
df.loc[df['future_return'] >  THRESHOLD, 'label'] =  1  # BUY
df.loc[df['future_return'] < -THRESHOLD, 'label'] = -1  # SELL

print("Label distribution:")
print(df['label'].value_counts())

# ── 4. CLEAN & SAVE ────────────────────────────────────────────
df.dropna(inplace=True)

os.makedirs("data", exist_ok=True)
df.to_csv("data/nsei_features.csv")

print(f"✅ Saved to data/nsei_features.csv — {len(df)} rows ready for training")