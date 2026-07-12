"""
data_pipeline_stocks.py

Nifty 50 stock-level version of data_pipeline_v3.py.

Reuses the EXACT same feature engineering + labeling logic as the existing
NSEI index pipeline — just applied per stock instead of per index, with a
`symbol` column added so the combined file can train one pooled cross-sectional
model (see plan: pooling beats 50 separate models on only 4 years of data each).

Output: data/nifty50_features.csv — one row per (symbol, date), same 27+
engineered columns as data/nsei_features.csv, plus `symbol`.

NOTE ON NETWORK ACCESS: this needs to reach Yahoo Finance (yfinance), which
isn't reachable from this sandboxed environment's network allowlist — run
this file locally / in your own environment, not here.
"""

import pandas as pd
import numpy as np
import yfinance as yf
import ta
import os
import time

from nifty50_universe import NIFTY50_SYMBOLS

START_DATE = "2022-01-01"   # ~4 years back from mid-2026
END_DATE   = "2026-07-01"
MIN_ROWS   = 200            # skip a symbol if too little history to be useful
SLEEP_BETWEEN_CALLS = 1.0   # be polite to yfinance / avoid rate limiting


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Identical feature + label engineering to data_pipeline_v3.py, factored
    into a function so it can run once per stock instead of once per index.
    """
    df = df.copy()

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

    # ── LABELS — same dynamic volatility-threshold, 2-class + 3-class ──
    FORWARD_DAYS = 5
    df['future_return'] = df['Close'].shift(-FORWARD_DAYS) / df['Close'] - 1

    df['vol_threshold'] = df['volatility_10'].rolling(20).mean() * 0.6
    df['vol_threshold'] = df['vol_threshold'].clip(lower=0.006, upper=0.03)

    df['label'] = 0
    df.loc[df['future_return'] > df['vol_threshold'], 'label'] = 1

    df['label_3class'] = 0
    df.loc[df['future_return'] >  df['vol_threshold'], 'label_3class'] =  1
    df.loc[df['future_return'] < -df['vol_threshold'], 'label_3class'] = -1

    df.dropna(inplace=True)
    df.drop(columns=['vol_threshold'], inplace=True)
    return df


def fetch_one(symbol: str):
    """Download + engineer features for a single symbol. Returns None on failure
    or insufficient history, so one bad symbol never kills the whole run."""
    try:
        raw = yf.download(symbol, start=START_DATE, end=END_DATE, interval="1d", progress=False)
        if raw is None or raw.empty:
            print(f"  \u26a0\ufe0f  {symbol}: no data returned, skipping")
            return None

        raw = raw.dropna()
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.droplevel(1)

        if len(raw) < MIN_ROWS:
            print(f"  \u26a0\ufe0f  {symbol}: only {len(raw)} rows (<{MIN_ROWS}), skipping")
            return None

        feats = engineer_features(raw)
        if feats.empty:
            print(f"  \u26a0\ufe0f  {symbol}: no rows left after feature engineering, skipping")
            return None

        feats['symbol'] = symbol
        print(f"  \u2705 {symbol}: {len(feats)} rows")
        return feats

    except Exception as e:
        print(f"  \u274c {symbol}: failed ({e})")
        return None


def main():
    print("=" * 60)
    print(f"NIFTY 50 STOCK DATA PIPELINE \u2014 {len(NIFTY50_SYMBOLS)} symbols")
    print(f"Range: {START_DATE} to {END_DATE}")
    print("=" * 60)

    frames = []
    failed = []

    for i, symbol in enumerate(NIFTY50_SYMBOLS, 1):
        print(f"[{i}/{len(NIFTY50_SYMBOLS)}] Fetching {symbol}...")
        result = fetch_one(symbol)
        if result is not None:
            frames.append(result)
        else:
            failed.append(symbol)
        time.sleep(SLEEP_BETWEEN_CALLS)

    if not frames:
        print("\n\u274c No symbols downloaded successfully. Aborting.")
        return

    combined = pd.concat(frames, axis=0)
    combined.sort_index(inplace=True)

    os.makedirs("data", exist_ok=True)
    out_path = "data/nifty50_features.csv"
    combined.to_csv(out_path)

    print("\n" + "=" * 60)
    print("DONE")
    print(f"Symbols succeeded : {len(frames)}/{len(NIFTY50_SYMBOLS)}")
    if failed:
        print(f"Symbols failed    : {', '.join(failed)}")
    print(f"Total rows        : {len(combined)}")
    print(f"Saved to          : {out_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()