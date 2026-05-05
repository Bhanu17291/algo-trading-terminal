# NSEI Algo Trading Terminal

A full-stack algorithmic trading platform for the NSEI (Nifty 50) index, built with a production-grade ML ensemble and a real-time trading dashboard.

## 🚀 Live Demo

| Service | URL |
|---|---|
| **Dashboard (Frontend)** | [algo-trading-terminal.vercel.app](https://algo-trading-terminal.vercel.app) |
| **API (Backend)** | [algo-trading-terminal.onrender.com](https://algo-trading-terminal.onrender.com) |

> ⚠️ The backend is hosted on Render's free tier — it may take 30–50 seconds to wake up on first visit. Subsequent requests are instant.

---

## 🤖 ML Model

| Property | Detail |
|---|---|
| **Architecture** | Weighted ensemble — XGBoost + LightGBM + CatBoost |
| **Features** | 27 engineered features including ATR, volatility, OBV, candlestick structure, multi-timeframe momentum, regime detection |
| **Training Data** | 1,481 days (2020–2026) of NSEI daily OHLCV data |
| **Label Strategy** | Dynamic volatility-based threshold, 2-class (BUY / HOLD) |
| **Hyperparameter Tuning** | Optuna (80 trials per model) |
| **Validation** | Time-series walk-forward cross-validation (no look-ahead bias) |

---

## 👥 Dual Client Engine

Two simulated trading profiles running on the same ML signals:

| Profile | Style | Confidence Threshold | Position Size | Stop Loss |
|---|---|---|---|---|
| **QUANT** | Aggressive | 55% | 95% of capital | 3% |
| **MACRO** | Conservative | 65% | 60% of capital | 1.5% |

---

## 📊 Dashboard Pages (15 total)

- **Dashboard** — Live signal, portfolio metrics, PnL tracker, 3-way equity curve
- **Trade Log** — Full trade history with STRATEGY / QUANT / MACRO tabs
- **Indicators** — RSI, MACD, Bollinger Bands, SMA overlays
- **Psychology** — Behavioural bias detection (revenge trading, loss aversion)
- **Market Status** — Live IST clock, market open/close detection
- **ML Explain** — SHAP feature importance (local + global)
- **Drawdown** — 3-way drawdown comparison vs NSEI benchmark
- **Backtest** — Historical strategy performance
- **Simulator** — Scale any strategy to custom capital
- **Risk Calc** — Position sizing with QUANT/MACRO presets
- **Heatmap** — Monthly returns heatmap
- **Screener** — Signal screener
- **News** — Market news feed
- **Clients** — Full QUANT vs MACRO head-to-head comparison
- **Walk-Forward** — Out-of-sample rolling window backtest

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **ML** | XGBoost, LightGBM, CatBoost, SHAP, Optuna |
| **Backend** | FastAPI, APScheduler, pandas, numpy |
| **Frontend** | React, Vite, Recharts, TailwindCSS, DaisyUI |
| **Data** | yfinance, ta (technical analysis) |
| **Deployment** | Render (backend) + Vercel (frontend) |

---

## ⚙️ Local Setup

### Backend
```bash
cd backend
pip install fastapi uvicorn pandas numpy joblib xgboost lightgbm catboost shap optuna apscheduler yfinance ta pytz
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd trading-dashboard
npm install
npm run dev
```

### Retrain Model
```bash
python data_pipeline_v3.py   # fetch and engineer features
python train_model_v5.py     # train ensemble
```

---

## 📈 Results

| Metric | Value |
|---|---|
| **Strategy Return** | +114.51% |
| **Win Rate** | 72.2% |
| **QUANT Client** | +848.23% |
| **MACRO Client** | +251.2% |
| **NSEI Benchmark** | +167.48% |

---

## 👤 Author

**Bhanu** — [@Bhanu17291](https://github.com/Bhanu17291)