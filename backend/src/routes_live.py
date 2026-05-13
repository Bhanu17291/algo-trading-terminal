"""
routes_live.py
--------------
Add these routes to your existing backend/main.py via:
    from routes_live import router as live_router
    app.include_router(live_router, prefix="/api")

Endpoints:
  GET /api/signals/history          — all logged signals with accuracy
  GET /api/signals/today            — today's signal
  GET /api/trades/live              — all trades (open + closed) per profile
  GET /api/performance/live         — live equity curve + win rate + PnL stats
  GET /api/model/version            — current model version + update history
  GET /api/price/live               — current NSEI price (polled every 60s)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
import yfinance as yf
from src.database import get_db, Signal, Trade, EquityCurvePoint, ModelVersion
import json, os

router = APIRouter()
META_PATH = os.path.join("models", "model_meta.json")

PROFILES = ["QUANT", "MACRO"]
INITIAL_CAPITAL = 1_000_000


# ─── Signal history ──────────────────────────────────────────────────────────

@router.get("/signals/history")
def get_signal_history(limit: int = 60, db: Session = Depends(get_db)):
    signals = (
        db.query(Signal)
        .order_by(Signal.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date": s.date,
            "signal": s.signal,
            "confidence": round(s.confidence * 100, 1),
            "model_version": s.model_version,
            "actual_outcome": s.actual_outcome,
            "was_correct": s.was_correct,
            "actual_return": round(s.actual_return * 100, 3) if s.actual_return else None,
        }
        for s in reversed(signals)
    ]


@router.get("/signals/today")
def get_todays_signal(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    s = db.query(Signal).filter(Signal.date == today).first()
    if not s:
        raise HTTPException(status_code=404, detail="No signal generated yet today")
    return {
        "date": s.date,
        "signal": s.signal,
        "confidence": round(s.confidence * 100, 1),
        "model_version": s.model_version,
    }


# ─── Win rate ─────────────────────────────────────────────────────────────────

@router.get("/signals/winrate")
def get_live_win_rate(db: Session = Depends(get_db)):
    resolved = db.query(Signal).filter(Signal.was_correct.isnot(None)).all()
    total = len(resolved)
    correct = sum(1 for s in resolved if s.was_correct == 1)
    win_rate = round(correct / total * 100, 1) if total > 0 else None
    return {
        "total_signals": total,
        "correct": correct,
        "win_rate": win_rate,
        "live": True,
    }


# ─── Trades ───────────────────────────────────────────────────────────────────

@router.get("/trades/live")
def get_live_trades(profile: str = None, db: Session = Depends(get_db)):
    q = db.query(Trade)
    if profile:
        q = q.filter(Trade.profile == profile.upper())
    trades = q.order_by(Trade.id.desc()).all()
    return [
        {
            "id": t.id,
            "profile": t.profile,
            "entry_date": t.entry_date,
            "entry_price": t.entry_price,
            "exit_date": t.exit_date,
            "exit_price": t.exit_price,
            "status": t.status,
            "exit_reason": t.exit_reason,
            "pnl_pct": round(t.pnl_pct * 100, 2) if t.pnl_pct else None,
            "pnl_abs": round(t.pnl_abs, 0) if t.pnl_abs else None,
            "confidence": round(t.signal_confidence * 100, 1) if t.signal_confidence else None,
        }
        for t in trades
    ]


# ─── Live performance ─────────────────────────────────────────────────────────

@router.get("/performance/live")
def get_live_performance(db: Session = Depends(get_db)):
    result = {}
    for profile in PROFILES:
        points = (
            db.query(EquityCurvePoint)
            .filter(EquityCurvePoint.profile == profile)
            .order_by(EquityCurvePoint.id)
            .all()
        )
        if not points:
            result[profile] = {"equity": INITIAL_CAPITAL, "return_pct": 0, "equity_curve": []}
            continue

        current_equity = points[-1].equity
        total_return = (current_equity - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
        max_drawdown = min((p.drawdown for p in points), default=0)

        trades = db.query(Trade).filter(
            Trade.profile == profile, Trade.status == "CLOSED"
        ).all()
        closed_count = len(trades)
        winners = [t for t in trades if t.pnl_pct and t.pnl_pct > 0]
        win_rate = round(len(winners) / closed_count * 100, 1) if closed_count > 0 else None

        result[profile] = {
            "equity": round(current_equity, 0),
            "return_pct": round(total_return, 2),
            "max_drawdown_pct": round(max_drawdown * 100, 2),
            "total_trades": closed_count,
            "win_rate": win_rate,
            "equity_curve": [
                {"date": p.date, "equity": p.equity, "drawdown": round(p.drawdown * 100, 2)}
                for p in points
            ],
        }
    return result


# ─── Model version ────────────────────────────────────────────────────────────

@router.get("/model/version")
def get_model_version():
    if not os.path.exists(META_PATH):
        return {"version": 1, "total_updates": 0, "last_update": None}
    with open(META_PATH, "r") as f:
        meta = json.load(f)
    return {
        "version": meta.get("version", 1),
        "total_updates": meta.get("total_updates", 0),
        "last_update": meta.get("last_update"),
        "message": f"Model has self-updated {meta.get('total_updates', 0)} times since deployment",
    }


# ─── Live price ───────────────────────────────────────────────────────────────

_price_cache = {"price": None, "timestamp": None}

@router.get("/price/live")
def get_live_price():
    """
    Returns current NSEI price. Cached for 60s to avoid hammering yfinance.
    Frontend should poll this every 60s during market hours.
    """
    from datetime import datetime
    import pytz
    IST = pytz.timezone("Asia/Kolkata")
    now = datetime.now(IST)

    # Refresh cache if older than 60s
    if (
        _price_cache["timestamp"] is None
        or (now - _price_cache["timestamp"]).seconds > 60
    ):
        try:
            df = yf.download("^NSEI", period="1d", interval="1m", progress=False)
            price = float(df["Close"].iloc[-1])
            prev_close = float(yf.download("^NSEI", period="2d", interval="1d", progress=False)["Close"].iloc[-2])
            _price_cache["price"] = price
            _price_cache["prev_close"] = prev_close
            _price_cache["timestamp"] = now
        except Exception:
            pass

    price = _price_cache.get("price")
    prev = _price_cache.get("prev_close")
    change_pct = round((price - prev) / prev * 100, 2) if price and prev else None

    return {
        "price": price,
        "prev_close": prev,
        "change_pct": change_pct,
        "direction": "up" if change_pct and change_pct > 0 else "down",
        "market_open": 9 <= now.hour < 15 or (now.hour == 15 and now.minute <= 30),
        "timestamp": now.isoformat(),
    }