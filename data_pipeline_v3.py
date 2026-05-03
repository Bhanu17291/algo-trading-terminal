import pandas as pd
import numpy as np
import yfinance as yf
import ta
import os

print("Fetching NSEI data...")
df = yf.download("^NSEI", start="2020-01-01", end="2026-04-01", interval="1d")
df.dropna(inplace=True)
df.columns = df.columns.droplevel(1)
print(f"✅ Downloaded {len(df)} rows")

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

# Volatility features
df['returns']       = df['Close'].pct_change()
df['volatility_10'] = df['returns'].rolling(10).std()
df['volatility_20'] = df['returns'].rolling(20).std()

# Price levels
df['high_60d']      = df['High'].rolling(60).max()
df['low_60d']       = df['Low'].rolling(60).min()
df['dist_60d_high'] = (df['Close'] - df['high_60d']) / df['high_60d']
df['dist_60d_low']  = (df['Close'] - df['low_60d'])  / df['low_60d']

# Multi-timeframe
df['weekly_return']  = df['Close'].pct_change(5)
df['monthly_return'] = df['Close'].pct_change(21)

# OBV
df['obv']       = (np.sign(df['Close'].diff()) * df['Volume']).cumsum()
df['obv_ratio'] = df['obv'] / (df['obv'].rolling(20).mean() + 1e-9)

# Candlestick
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
df['mom_5']          = df['Close'].pct_change(5)
df['mom_10']         = df['Close'].pct_change(10)
df['rsi_divergence'] = np.sign(df['rsi'].diff(3)) - np.sign(df['Close'].pct_change(3))

print("✅ Features engineered")

# ── SMARTER LABELS — 2 class ───────────────────────────────────
print("Generating labels...")

FORWARD_DAYS = 5
df['future_return'] = df['Close'].shift(-FORWARD_DAYS) / df['Close'] - 1

# Dynamic threshold based on volatility
df['vol_threshold'] = df['volatility_10'].rolling(20).mean() * 0.6
df['vol_threshold'] = df['vol_threshold'].clip(lower=0.006, upper=0.03)

# 2-class: 1 = BUY (strong up move expected), 0 = HOLD/AVOID
df['label'] = 0
df.loc[df['future_return'] > df['vol_threshold'], 'label'] = 1

# Also keep original 3-class for compatibility
df['label_3class'] = 0
df.loc[df['future_return'] >  df['vol_threshold'], 'label_3class'] =  1
df.loc[df['future_return'] < -df['vol_threshold'], 'label_3class'] = -1

print("2-class label distribution:")
print(df['label'].value_counts())
print("\n3-class label distribution:")
print(df['label_3class'].value_counts())

df.dropna(inplace=True)
df.drop(columns=['vol_threshold'], inplace=True)

os.makedirs("data", exist_ok=True)
df.to_csv("data/nsei_features.csv")

print(f"\n✅ Saved {len(df)} rows")
print(f"   Date range: {df.index[0].date()} to {df.index[-1].date()}")