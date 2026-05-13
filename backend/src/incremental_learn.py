"""
incremental_learn.py
--------------------
Runs every market day at 3:35 PM IST via APScheduler.
1. Fetches today's OHLCV from yfinance
2. Engineers all 27 features (same pipeline as train_model_v5.py)
3. Labels yesterday's candle (confirmed outcome now available)
4. Loads saved XGBoost + LightGBM + CatBoost models
5. Runs one warm-start round on the new labelled row
6. Saves updated models with bumped version number
7. Runs inference → generates tomorrow's signal
8. Persists signal + model version to DB
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
import yfinance as yf
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostClassifier
from datetime import datetime, date
import pytz
from src.database import get_db, Signal, ModelVersion  # your DB module (see database.py)

TICKER = "^NSEI"
MODEL_DIR = "models"
DATA_DIR = "data"
IST = pytz.timezone("Asia/Kolkata")

XGB_PATH = os.path.join(MODEL_DIR, "xgb_model.json")
LGB_PATH = os.path.join(MODEL_DIR, "lgb_model.txt")
CAT_PATH = os.path.join(MODEL_DIR, "cat_model.cbm")
META_PATH = os.path.join(MODEL_DIR, "model_meta.json")

FEATURE_COLS = [
    "open", "high", "low", "close", "volume",
    "rsi_14", "macd", "macd_signal", "macd_diff",
    "bb_upper", "bb_lower", "bb_width",
    "sma_20", "sma_50", "sma_200",
    "ema_12", "ema_26",
    "atr_14", "obv",
    "vol_ratio_20",
    "body_ratio", "upper_shadow", "lower_shadow",
    "momentum_5", "momentum_10",
    "regime_vol", "day_of_week"
]

XGB_WEIGHTS = 0.4
LGB_WEIGHTS = 0.35
CAT_WEIGHTS = 0.25


def fetch_recent_ohlcv(lookback_days: int = 250) -> pd.DataFrame:
    """Fetch enough history for feature engineering."""
    df = yf.download(TICKER, period=f"{lookback_days}d", interval="1d", progress=False)
    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index)
    df = df[["open", "high", "low", "close", "volume"]].dropna()
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replicates your data_pipeline_v3.py feature engineering.
    Returns df with all 27 feature columns.
    """
    import ta

    df = df.copy()

    # Momentum indicators
    df["rsi_14"] = ta.momentum.RSIIndicator(df["close"], window=14).rsi()

    macd = ta.trend.MACD(df["close"])
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_diff"] = macd.macd_diff()

    # Bollinger Bands
    bb = ta.volatility.BollingerBands(df["close"], window=20)
    df["bb_upper"] = bb.bollinger_hband()
    df["bb_lower"] = bb.bollinger_lband()
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["close"]

    # Moving averages
    df["sma_20"] = df["close"].rolling(20).mean()
    df["sma_50"] = df["close"].rolling(50).mean()
    df["sma_200"] = df["close"].rolling(200).mean()
    df["ema_12"] = df["close"].ewm(span=12).mean()
    df["ema_26"] = df["close"].ewm(span=26).mean()

    # Volatility / volume
    df["atr_14"] = ta.volatility.AverageTrueRange(
        df["high"], df["low"], df["close"], window=14
    ).average_true_range()
    df["obv"] = ta.volume.OnBalanceVolumeIndicator(df["close"], df["volume"]).on_balance_volume()
    df["vol_ratio_20"] = df["volume"] / df["volume"].rolling(20).mean()

    # Candlestick structure
    body = (df["close"] - df["open"]).abs()
    full_range = df["high"] - df["low"] + 1e-9
    df["body_ratio"] = body / full_range
    df["upper_shadow"] = (df["high"] - df[["close", "open"]].max(axis=1)) / full_range
    df["lower_shadow"] = (df[["close", "open"]].min(axis=1) - df["low"]) / full_range

    # Momentum
    df["momentum_5"] = df["close"].pct_change(5)
    df["momentum_10"] = df["close"].pct_change(10)

    # Regime detection (20-day rolling vol)
    df["regime_vol"] = df["close"].pct_change().rolling(20).std()

    # Calendar
    df["day_of_week"] = df.index.dayofweek

    return df.dropna()


def dynamic_label(df: pd.DataFrame) -> pd.Series:
    """
    Replicates your dynamic volatility-based labelling from train_model_v5.py.
    BUY = 1 if next-day return > volatility threshold, else HOLD = 0.
    Uses the PREVIOUS day's confirmed close — no look-ahead.
    """
    fwd_return = df["close"].shift(-1) / df["close"] - 1
    vol_threshold = df["close"].pct_change().rolling(20).std() * 0.5
    labels = (fwd_return > vol_threshold).astype(int)
    return labels


def load_model_meta() -> dict:
    if os.path.exists(META_PATH):
        with open(META_PATH, "r") as f:
            return json.load(f)
    return {"version": 1, "total_updates": 0, "last_update": None}


def save_model_meta(meta: dict):
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2, default=str)


def incremental_update_xgb(X_new: np.ndarray, y_new: np.ndarray) -> xgb.Booster:
    """Warm-start XGBoost with 1 new row."""
    booster = xgb.Booster()
    booster.load_model(XGB_PATH)
    dtrain = xgb.DMatrix(X_new, label=y_new)
    # Add 5 trees on top of the existing model
    params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "learning_rate": 0.01,   # small lr for incremental updates
        "max_depth": 5,
        "verbosity": 0,
    }
    updated = xgb.train(
        params,
        dtrain,
        num_boost_round=5,
        xgb_model=booster,  # warm-start: continues from existing trees
        verbose_eval=False,
    )
    updated.save_model(XGB_PATH)
    return updated


def incremental_update_lgb(X_new: np.ndarray, y_new: np.ndarray) -> lgb.Booster:
    """Warm-start LightGBM with 1 new row."""
    dtrain = lgb.Dataset(X_new, label=y_new)
    params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "learning_rate": 0.01,
        "num_leaves": 31,
        "verbosity": -1,
    }
    updated = lgb.train(
        params,
        dtrain,
        num_boost_round=5,
        init_model=LGB_PATH,  # warm-start: continues from existing model
    )
    updated.save_model(LGB_PATH)
    return updated


def incremental_update_cat(X_new: np.ndarray, y_new: np.ndarray) -> CatBoostClassifier:
    """
    CatBoost incremental update via snapshot continuation.
    Loads existing model, continues training on new data.
    """
    cat = CatBoostClassifier()
    cat.load_model(CAT_PATH)
    cat.fit(
        X_new, y_new,
        init_model=cat,
        verbose=False,
    )
    cat.save_model(CAT_PATH)
    return cat


def run_ensemble_inference(X: np.ndarray) -> tuple[float, str]:
    """
    Weighted ensemble: XGB 40% + LGB 35% + CAT 25%.
    Returns (confidence_score, signal).
    """
    xgb_model = xgb.Booster()
    xgb_model.load_model(XGB_PATH)
    lgb_model = lgb.Booster(model_file=LGB_PATH)
    cat_model = CatBoostClassifier()
    cat_model.load_model(CAT_PATH)

    dx = xgb.DMatrix(X)
    xgb_prob = xgb_model.predict(dx)[0]
    lgb_prob = lgb_model.predict(X)[0]
    cat_prob = cat_model.predict_proba(X)[0][1]

    confidence = (
        XGB_WEIGHTS * xgb_prob +
        LGB_WEIGHTS * lgb_prob +
        CAT_WEIGHTS * cat_prob
    )
    signal = "BUY" if confidence >= 0.55 else "HOLD"
    return float(round(confidence, 4)), signal


def run_daily_update():
    """
    Main entry point — called by APScheduler at 3:35 PM IST every weekday.
    """
    print(f"[{datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S IST')}] Starting daily incremental update...")

    # 1. Fetch recent data
    df_raw = fetch_recent_ohlcv(lookback_days=250)
    df = engineer_features(df_raw)
    labels = dynamic_label(df)
    df["label"] = labels
    df = df.dropna(subset=["label"])

    if len(df) < 2:
        print("Not enough data rows. Skipping update.")
        return

    # 2. Training row = yesterday's confirmed candle (index -2, since -1 has no confirmed label yet)
    # Inference row = today's candle (index -1) for tomorrow's signal
    train_row = df.iloc[[-2]]
    infer_row = df.iloc[[-1]]

    X_train = train_row[FEATURE_COLS].values
    y_train = train_row["label"].values
    X_infer = infer_row[FEATURE_COLS].values

    print(f"Training on {train_row.index[-1].date()} | Label: {'BUY' if y_train[0]==1 else 'HOLD'}")

    # 3. Incremental model updates
    meta = load_model_meta()
    try:
        incremental_update_xgb(X_train, y_train)
        incremental_update_lgb(X_train, y_train)
        incremental_update_cat(X_train, y_train)
        meta["version"] += 1
        meta["total_updates"] += 1
        meta["last_update"] = datetime.now(IST).isoformat()
        save_model_meta(meta)
        print(f"Models updated → version {meta['version']}")
    except Exception as e:
        print(f"Model update failed: {e}. Running inference on existing model.")

    # 4. Inference for tomorrow's signal
    confidence, signal = run_ensemble_inference(X_infer)
    today = date.today().isoformat()
    print(f"Signal for {today}: {signal} @ {confidence*100:.1f}% confidence (model v{meta['version']})")

    # 5. Persist to DB
    try:
        db = next(get_db())
        new_signal = Signal(
            date=today,
            signal=signal,
            confidence=confidence,
            model_version=meta["version"],
            created_at=datetime.now(IST),
        )
        db.add(new_signal)
        db.commit()
        print(f"Signal saved to DB.")
    except Exception as e:
        print(f"DB write failed: {e}")

    # 6. Check yesterday's signal accuracy (compare to actual close)
    _check_previous_signal_accuracy(df, today)

    print("Daily update complete.")


def _check_previous_signal_accuracy(df: pd.DataFrame, today: str):
    """Compare yesterday's signal to actual outcome and update win rate."""
    try:
        db = next(get_db())
        yesterday = df.index[-2].date().isoformat()
        prev_signal = db.query(Signal).filter(Signal.date == yesterday).first()
        if not prev_signal or prev_signal.actual_outcome is not None:
            return

        # Actual return: today's close vs yesterday's close
        actual_return = (df["close"].iloc[-1] - df["close"].iloc[-2]) / df["close"].iloc[-2]
        vol_threshold = df["close"].pct_change().rolling(20).std().iloc[-1] * 0.5
        actual_outcome = "BUY" if actual_return > vol_threshold else "HOLD"
        was_correct = int(prev_signal.signal == actual_outcome)

        prev_signal.actual_outcome = actual_outcome
        prev_signal.was_correct = was_correct
        prev_signal.actual_return = float(round(actual_return, 6))
        db.commit()
        print(f"Yesterday's signal ({prev_signal.signal}) was {'CORRECT' if was_correct else 'WRONG'} (actual: {actual_outcome})")
    except Exception as e:
        print(f"Accuracy check failed: {e}")


if __name__ == "__main__":
    run_daily_update()