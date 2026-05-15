"""
incremental_learn.py
--------------------
Daily incremental model update — runs at 3:35 PM IST after market close.

What it does:
  1. Fetches today's OHLCV from yfinance
  2. Engineers features (same 27 as training)
  3. Upserts row into PostgreSQL ohlcv_features table
  4. Resolves yesterday's signal (was it correct?)
  5. Incrementally updates XGBoost + LightGBM with only new data
  6. Detects model drift → triggers full retrain if needed
  7. Generates tomorrow's signal and writes to DB
  8. Bumps model version in DB + model_meta.json
"""

import os
import json
import logging
import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, date, timedelta
import pytz

from src.db_data import (
    get_features_df,
    get_last_stored_date,
    upsert_ohlcv_row,
    upsert_ohlcv_bulk,
    get_latest_features_row,
)
from src.database import SessionLocal, Signal, ModelVersion

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")

# ── Paths ─────────────────────────────────────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
META_PATH  = os.path.join(MODELS_DIR, "model_meta.json")

# ── Drift detection config ────────────────────────────────────────────────────
DRIFT_WINDOW        = 20    # look at last N resolved signals
DRIFT_THRESHOLD     = 0.45  # if win rate drops below 45% → full retrain
FULL_RETRAIN_AFTER  = 30    # also full retrain every 30 incremental updates


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE ENGINEERING  (mirrors data_pipeline_v3.py)
# ═══════════════════════════════════════════════════════════════════════════════

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all 27 features on a raw OHLCV DataFrame.
    df must have columns: Open, High, Low, Close, Volume (index = date).
    Returns df with all feature columns added.
    """
    import ta

    df = df.copy()

    # Returns & momentum
    df["returns"]      = df["Close"].pct_change()
    df["log_returns"]  = np.log(df["Close"] / df["Close"].shift(1))
    for w in [3, 5, 10, 20]:
        df[f"momentum_{w}"] = df["Close"].pct_change(w)

    # Moving averages
    df["sma20"] = df["Close"].rolling(20).mean()
    df["sma50"] = df["Close"].rolling(50).mean()
    df["ema12"] = df["Close"].ewm(span=12, adjust=False).mean()
    df["ema26"] = df["Close"].ewm(span=26, adjust=False).mean()
    df["price_vs_sma20"] = (df["Close"] - df["sma20"]) / df["sma20"]
    df["price_vs_sma50"] = (df["Close"] - df["sma50"]) / df["sma50"]

    # Volatility + Bollinger
    df["atr"]          = ta.volatility.average_true_range(df["High"], df["Low"], df["Close"], window=14)
    df["volatility_10"]= df["returns"].rolling(10).std()
    df["volatility_20"]= df["returns"].rolling(20).std()
    bb = ta.volatility.BollingerBands(df["Close"], window=20, window_dev=2)
    df["bb_upper"] = bb.bollinger_hband()
    df["bb_lower"] = bb.bollinger_lband()
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["sma20"]
    df["bb_pct"]   = bb.bollinger_pband()

    # Oscillators
    df["rsi"]        = ta.momentum.rsi(df["Close"], window=14)
    macd_ind         = ta.trend.MACD(df["Close"])
    df["macd"]       = macd_ind.macd()
    df["macd_signal"]= macd_ind.macd_signal()
    df["macd_hist"]  = macd_ind.macd_diff()
    stoch            = ta.momentum.StochasticOscillator(df["High"], df["Low"], df["Close"])
    df["stoch_k"]    = stoch.stoch()
    df["stoch_d"]    = stoch.stoch_signal()

    # Volume
    df["obv"]          = ta.volume.on_balance_volume(df["Close"], df["Volume"])
    df["volume_ratio"] = df["Volume"] / df["Volume"].rolling(20).mean()

    # Candlestick structure
    df["body_size"]  = abs(df["Close"] - df["Open"]) / (df["High"] - df["Low"] + 1e-9)
    df["upper_wick"] = (df["High"] - df[["Open", "Close"]].max(axis=1)) / (df["High"] - df["Low"] + 1e-9)
    df["lower_wick"] = (df[["Open", "Close"]].min(axis=1) - df["Low"]) / (df["High"] - df["Low"] + 1e-9)

    # Regime (1 = above both MAs, 0 = below)
    df["regime"] = ((df["Close"] > df["sma20"]) & (df["Close"] > df["sma50"])).astype(int)

    return df


def make_label(df: pd.DataFrame, threshold_multiplier: float = 0.5) -> pd.DataFrame:
    """
    Dynamic volatility-based label (same as train_model_v5.py).
    BUY = next day return > threshold, else HOLD.
    """
    df = df.copy()
    future_return = df["Close"].shift(-1) / df["Close"] - 1
    threshold     = df["volatility_20"] * threshold_multiplier
    df["label"]   = np.where(future_return > threshold, "BUY", "HOLD")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# FETCH NEW DATA FROM YFINANCE + PUSH TO DB
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_and_store_latest():
    """
    Checks what's already in DB, fetches only missing days from yfinance,
    engineers features, and upserts into ohlcv_features table.
    Returns the updated full feature DataFrame.
    """
    last_date = get_last_stored_date()

    if last_date is None:
        # DB is empty — fetch full history
        logger.info("[incremental] DB empty — fetching full history (2020-present)...")
        raw = yf.download("^NSEI", start="2020-01-01", progress=False)
    else:
        # Fetch only from day after last stored date
        start = (pd.to_datetime(last_date) + timedelta(days=1)).strftime("%Y-%m-%d")
        today = datetime.now(IST).strftime("%Y-%m-%d")
        if start > today:
            logger.info("[incremental] DB already up to date.")
            return get_features_df()
        logger.info(f"[incremental] Fetching {start} → {today} from yfinance...")
        raw = yf.download("^NSEI", start=start, progress=False)

    if raw.empty:
        logger.warning("[incremental] yfinance returned empty data.")
        return get_features_df()

    # yfinance multi-index fix
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.droplevel(1)
    raw.index.name = "date"

    # If DB has existing data, prepend it for rolling calculations
    if last_date is not None:
        existing = get_features_df(days=120)  # need history for rolling windows
        existing.index.name = "date"
        existing = existing.rename(columns={"Open": "open", "High": "high",
                                             "Low": "low", "Close": "close",
                                             "Volume": "volume"})
        raw.columns = [c.lower() for c in raw.columns]
        combined = pd.concat([existing, raw]).sort_index()
        combined = combined[~combined.index.duplicated(keep="last")]
    else:
        raw.columns = [c.lower() for c in raw.columns]
        # Rename back to uppercase for engineer_features
        combined = raw.rename(columns={"open": "Open", "high": "High",
                                        "low": "Low", "close": "Close", "volume": "Volume"})

    # Engineer features on full combined set
    featured = engineer_features(combined)
    featured  = make_label(featured)
    featured  = featured.dropna()

    # Only store the genuinely new rows
    if last_date is not None:
        new_rows = featured[featured.index > pd.to_datetime(last_date)]
    else:
        new_rows = featured

    if new_rows.empty:
        logger.info("[incremental] No new rows to store.")
        return get_features_df()

    # Lowercase columns for DB
    store_df = new_rows.copy()
    store_df.columns = [c.lower() for c in store_df.columns]
    store_df = store_df.rename(columns={"open": "open", "high": "high",
                                         "low": "low", "close": "close",
                                         "volume": "volume"})
    upsert_ohlcv_bulk(store_df)
    logger.info(f"[incremental] Stored {len(new_rows)} new rows in DB.")

    return get_features_df()


# ═══════════════════════════════════════════════════════════════════════════════
# DRIFT DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

def check_drift() -> tuple[bool, float]:
    """
    Looks at last DRIFT_WINDOW resolved signals in DB.
    Returns (drift_detected: bool, recent_win_rate: float).
    """
    db = SessionLocal()
    try:
        resolved = (db.query(Signal)
                      .filter(Signal.was_correct.isnot(None))
                      .order_by(Signal.id.desc())
                      .limit(DRIFT_WINDOW)
                      .all())
        if len(resolved) < 10:
            return False, 1.0  # not enough data yet

        win_rate = sum(1 for s in resolved if s.was_correct == 1) / len(resolved)
        drift    = win_rate < DRIFT_THRESHOLD
        if drift:
            logger.warning(f"[drift] Win rate {win_rate:.2%} < {DRIFT_THRESHOLD:.2%} — DRIFT DETECTED")
        else:
            logger.info(f"[drift] Win rate {win_rate:.2%} — OK")
        return drift, win_rate
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL META
# ═══════════════════════════════════════════════════════════════════════════════

def load_meta() -> dict:
    if os.path.exists(META_PATH):
        with open(META_PATH) as f:
            return json.load(f)
    return {"version": 1, "total_updates": 0, "last_update": None}


def save_meta(meta: dict):
    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)


def bump_model_version(db, trees_added: int = 5, notes: str = ""):
    meta = load_meta()
    meta["version"]       = meta.get("version", 1) + 1
    meta["total_updates"] = meta.get("total_updates", 0) + 1
    meta["last_update"]   = datetime.now(IST).isoformat()
    save_meta(meta)

    mv = ModelVersion(
        version       = meta["version"],
        update_date   = date.today().isoformat(),
        total_updates = meta["total_updates"],
        xgb_trees_added = trees_added,
        lgb_trees_added = trees_added,
        notes         = notes,
    )
    db.add(mv)
    db.commit()
    logger.info(f"[meta] Model version bumped to {meta['version']} (update #{meta['total_updates']})")
    return meta["version"]


# ═══════════════════════════════════════════════════════════════════════════════
# INCREMENTAL UPDATE (XGBoost + LightGBM)
# CatBoost doesn't support true incremental learning — kept as-is, retrained
# only on full retrain cycles.
# ═══════════════════════════════════════════════════════════════════════════════

def incremental_update(df: pd.DataFrame, new_rows: int = 5):
    """
    Adds `new_rows` trees to XGBoost and LightGBM using only the most recent data.
    Loads models from disk, updates in-place, saves back.

    Args:
        df: full feature DataFrame from DB
        new_rows: how many of the latest rows to train on
    """
    import xgboost as xgb
    import lightgbm as lgb
    from sklearn.preprocessing import LabelEncoder

    xgb_model  = joblib.load(os.path.join(MODELS_DIR, "xgb_model.pkl"))
    lgbm_model = joblib.load(os.path.join(MODELS_DIR, "lgbm_model.pkl"))
    FEATURES   = joblib.load(os.path.join(MODELS_DIR, "features.pkl"))

    recent = df.dropna(subset=FEATURES + ["label"]).tail(new_rows)
    if len(recent) == 0:
        logger.warning("[incremental] No new labelled rows — skipping model update.")
        return

    le = LabelEncoder()
    le.fit(["BUY", "HOLD"])
    y = le.transform(recent["label"])
    X = recent[FEATURES]

    # XGBoost incremental: pass xgb_model as starting point
    logger.info(f"[incremental] XGBoost — adding 5 trees on {len(X)} rows...")
    dtrain = xgb.DMatrix(X, label=y)
    xgb_model = xgb.train(
        params={
            "objective":  "binary:logistic",
            "eval_metric":"logloss",
            "max_depth":  4,
            "eta":        0.03,         # lower LR for incremental
            "subsample":  0.8,
        },
        dtrain           = dtrain,
        num_boost_round  = 5,
        xgb_model        = xgb_model,   # continues from existing trees
        verbose_eval     = False,
    )

    # LightGBM incremental: refit with warm start via additional iterations
    logger.info(f"[incremental] LightGBM — adding 5 trees on {len(X)} rows...")
    lgb_train = lgb.Dataset(X, label=y)
    lgbm_model = lgb.train(
        params={
            "objective":   "binary",
            "metric":      "binary_logloss",
            "num_leaves":  31,
            "learning_rate": 0.03,
            "verbose":     -1,
        },
        train_set        = lgb_train,
        num_boost_round  = 5,
        init_model       = lgbm_model,  # continues from existing trees
    )

    # Save updated models
    joblib.dump(xgb_model,  os.path.join(MODELS_DIR, "xgb_model.pkl"))
    joblib.dump(lgbm_model, os.path.join(MODELS_DIR, "lgbm_model.pkl"))
    logger.info("[incremental] Models updated and saved.")


def full_retrain(df: pd.DataFrame):
    """
    Full retrain from scratch on all DB data.
    Triggered when drift detected or every FULL_RETRAIN_AFTER updates.
    Uses same hyperparameters as train_model_v5.py.
    """
    import xgboost as xgb
    import lightgbm as lgb
    from catboost import CatBoostClassifier
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import TimeSeriesSplit

    logger.info("[full_retrain] Starting full retrain on all DB data...")

    FEATURES = joblib.load(os.path.join(MODELS_DIR, "features.pkl"))
    df_clean = df.dropna(subset=FEATURES + ["label"])

    le = LabelEncoder()
    y  = le.fit_transform(df_clean["label"])
    X  = df_clean[FEATURES]

    # XGBoost
    dtrain    = xgb.DMatrix(X, label=y)
    xgb_model = xgb.train(
        {"objective": "binary:logistic", "eval_metric": "logloss",
         "max_depth": 4, "eta": 0.05, "subsample": 0.8, "colsample_bytree": 0.8},
        dtrain, num_boost_round=300, verbose_eval=False
    )

    # LightGBM
    lgb_train  = lgb.Dataset(X, label=y)
    lgbm_model = lgb.train(
        {"objective": "binary", "metric": "binary_logloss",
         "num_leaves": 63, "learning_rate": 0.05, "verbose": -1},
        lgb_train, num_boost_round=300
    )

    # CatBoost
    cat_model = CatBoostClassifier(
        iterations=300, depth=6, learning_rate=0.05,
        loss_function="Logloss", verbose=0, random_seed=42
    )
    cat_model.fit(X, y)

    # Recompute ensemble weights via last 20% of data
    split     = int(len(X) * 0.8)
    X_val, y_val = X.iloc[split:], y[split:]
    from sklearn.metrics import accuracy_score
    p_xgb  = xgb_model.predict(xgb.DMatrix(X_val))
    p_lgb  = lgbm_model.predict(X_val)
    p_cat  = cat_model.predict_proba(X_val)[:, 1]
    a_xgb  = accuracy_score(y_val, (p_xgb  >= 0.5).astype(int))
    a_lgb  = accuracy_score(y_val, (p_lgb  >= 0.5).astype(int))
    a_cat  = accuracy_score(y_val, (p_cat  >= 0.5).astype(int))
    total  = a_xgb + a_lgb + a_cat
    weights = {"w_xgb": a_xgb / total, "w_lgbm": a_lgb / total, "w_cat": a_cat / total}

    # Save everything
    joblib.dump(xgb_model,  os.path.join(MODELS_DIR, "xgb_model.pkl"))
    joblib.dump(lgbm_model, os.path.join(MODELS_DIR, "lgbm_model.pkl"))
    joblib.dump(cat_model,  os.path.join(MODELS_DIR, "cat_model.pkl"))
    joblib.dump(le,         os.path.join(MODELS_DIR, "label_encoder.pkl"))
    joblib.dump(weights,    os.path.join(MODELS_DIR, "ensemble_weights.pkl"))
    logger.info(f"[full_retrain] Done. Weights → {weights}")


# ═══════════════════════════════════════════════════════════════════════════════
# SIGNAL GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_and_store_signal(df: pd.DataFrame):
    """
    Runs ensemble on latest row, writes signal to DB.
    Also resolves yesterday's signal (actual_outcome + was_correct).
    """
    import xgboost as xgb

    xgb_model  = joblib.load(os.path.join(MODELS_DIR, "xgb_model.pkl"))
    lgbm_model = joblib.load(os.path.join(MODELS_DIR, "lgbm_model.pkl"))
    cat_model  = joblib.load(os.path.join(MODELS_DIR, "cat_model.pkl"))
    FEATURES   = joblib.load(os.path.join(MODELS_DIR, "features.pkl"))
    weights    = joblib.load(os.path.join(MODELS_DIR, "ensemble_weights.pkl"))
    meta       = load_meta()

    latest = df.dropna(subset=FEATURES).iloc[-1:]
    X      = latest[FEATURES]

    p_xgb  = xgb_model.predict(xgb.DMatrix(X))
    p_lgb  = lgbm_model.predict(X)
    p_cat  = cat_model.predict_proba(X)[:, 1]

    buy_prob = (weights["w_xgb"] * p_xgb[0] +
                weights["w_lgbm"] * p_lgb[0] +
                weights["w_cat"]  * p_cat[0])

    signal     = "BUY" if buy_prob >= 0.55 else "HOLD"
    confidence = float(buy_prob)
    today_str  = date.today().isoformat()

    db = SessionLocal()
    try:
        # Resolve yesterday's signal
        yesterday_str = (date.today() - timedelta(days=1)).isoformat()
        prev_signal   = db.query(Signal).filter(Signal.date == yesterday_str).first()
        if prev_signal and prev_signal.actual_outcome is None:
            # Look up today's actual close vs yesterday's
            if len(df) >= 2:
                today_close     = float(df["Close"].iloc[-1])
                yesterday_close = float(df["Close"].iloc[-2])
                actual_return   = (today_close - yesterday_close) / yesterday_close
                actual_outcome  = "BUY" if actual_return > 0 else "HOLD"
                was_correct     = int(prev_signal.signal == actual_outcome)
                prev_signal.actual_outcome = actual_outcome
                prev_signal.was_correct    = was_correct
                prev_signal.actual_return  = actual_return
                db.commit()
                logger.info(f"[signal] Resolved {yesterday_str}: signal={prev_signal.signal}, "
                            f"actual={actual_outcome}, correct={bool(was_correct)}")

        # Store today's signal (upsert)
        existing = db.query(Signal).filter(Signal.date == today_str).first()
        if existing:
            existing.signal        = signal
            existing.confidence    = confidence
            existing.model_version = meta["version"]
        else:
            db.add(Signal(
                date          = today_str,
                signal        = signal,
                confidence    = confidence,
                model_version = meta["version"],
            ))
        db.commit()
        logger.info(f"[signal] Today's signal: {signal} (confidence={confidence:.3f})")

    finally:
        db.close()

    return signal, confidence


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — called by scheduler at 3:35 PM IST
# ═══════════════════════════════════════════════════════════════════════════════

def run_daily_update():
    """
    Full daily pipeline:
      1. Fetch new OHLCV + engineer features → DB
      2. Check drift
      3. Incremental update OR full retrain
      4. Generate + store signal
      5. Bump model version
    """
    logger.info("=" * 60)
    logger.info(f"[daily_update] Starting at {datetime.now(IST).strftime('%H:%M:%S IST')}")

    try:
        # Step 1: fetch + store latest data
        df = fetch_and_store_latest()
        if df.empty:
            logger.error("[daily_update] No data available — aborting.")
            return

        # Step 2: drift check
        drift_detected, win_rate = check_drift()
        meta = load_meta()
        total_updates = meta.get("total_updates", 0)
        force_full    = (total_updates > 0 and total_updates % FULL_RETRAIN_AFTER == 0)

        # Step 3: retrain decision
        db = SessionLocal()
        try:
            if drift_detected or force_full:
                reason = "drift" if drift_detected else f"scheduled (every {FULL_RETRAIN_AFTER} updates)"
                logger.info(f"[daily_update] Full retrain triggered — reason: {reason}")
                full_retrain(df)
                notes = f"Full retrain — {reason} — win_rate={win_rate:.2%}"
                bump_model_version(db, trees_added=0, notes=notes)
            else:
                logger.info("[daily_update] Incremental update...")
                incremental_update(df, new_rows=5)
                bump_model_version(db, trees_added=5, notes=f"Incremental — win_rate={win_rate:.2%}")
        finally:
            db.close()

        # Step 4: generate signal
        signal, confidence = generate_and_store_signal(df)

        logger.info(f"[daily_update] Complete. Signal={signal}, confidence={confidence:.3f}")
        logger.info("=" * 60)

    except Exception as e:
        logger.exception(f"[daily_update] FAILED: {e}")
        raise