import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt

# ── 1. LOAD ────────────────────────────────────────────────────
df = pd.read_csv("data/nsei_features.csv", index_col=0, parse_dates=True)
model = joblib.load("models/xgb_model.pkl")
le    = joblib.load("models/label_encoder.pkl")

FEATURES = [
    'sma_cross', 'rsi', 'macd', 'macd_signal', 'macd_diff',
    'bb_width', 'bb_pos', 'volume_ratio', 'day_of_week', 'month'
]

# ── 2. GENERATE SIGNALS ────────────────────────────────────────
probs        = model.predict_proba(df[FEATURES])
pred_encoded = model.predict(df[FEATURES])
df['signal']     = le.inverse_transform(pred_encoded)
df['confidence'] = probs.max(axis=1)

# ── 3. BACKTEST ENGINE ─────────────────────────────────────────
INITIAL_CAPITAL  = 100000
BROKERAGE        = 0.002   # 0.2% per trade
SLIPPAGE         = 0.001   # 0.1% slippage on fills — real markets never fill at exact price
MAX_HOLD_DAYS    = 15      # Force exit after 15 days — realistic position management
CONFIDENCE_THRESHOLD = 0.40  # Lower threshold — lets more trades through including losers
RISK_PER_TRADE   = 0.90    # Use 90% of capital per trade

capital     = INITIAL_CAPITAL
position    = 0
entry_price = 0
entry_idx   = 0
portfolio   = []
trades      = []

for i, (idx, row) in enumerate(df.iterrows()):
    price  = row['Close']
    signal = row['signal']
    conf   = row['confidence']

    # Apply slippage to fill price
    buy_fill  = price * (1 + SLIPPAGE)
    sell_fill = price * (1 - SLIPPAGE)

    # Force exit if held too long
    if position > 0 and (i - entry_idx) >= MAX_HOLD_DAYS:
        revenue  = position * sell_fill * (1 - BROKERAGE)
        pnl      = revenue - (position * entry_price)
        capital += revenue
        log_msg  = f"ML → FORCE EXIT (held {MAX_HOLD_DAYS}d) | fill={int(sell_fill)} | realized PnL = {'+' if pnl > 0 else ''}{pnl:.2f}"
        print(log_msg)
        trades.append({
            'date': idx, 'action': 'SELL',
            'price': round(sell_fill, 2), 'qty': position,
            'pnl': round(pnl, 2), 'confidence': round(conf, 3),
            'log': log_msg, 'exit_type': 'forced'
        })
        position = 0

    # BUY signal
    if signal == 1 and position == 0 and capital > buy_fill and conf >= CONFIDENCE_THRESHOLD:
        qty         = int(capital * RISK_PER_TRADE / buy_fill)
        cost        = qty * buy_fill * (1 + BROKERAGE)
        if cost <= capital:
            capital    -= cost
            position    = qty
            entry_price = buy_fill
            entry_idx   = i
            log_msg     = f"ML → BUY  (p={conf:.3f}) | fill={int(buy_fill)} | qty={qty}"
            print(log_msg)
            trades.append({
                'date': idx, 'action': 'BUY',
                'price': round(buy_fill, 2), 'qty': qty,
                'pnl': 0, 'confidence': round(conf, 3),
                'log': log_msg, 'exit_type': ''
            })

    # SELL signal
    elif signal == -1 and position > 0 and conf >= CONFIDENCE_THRESHOLD:
        revenue  = position * sell_fill * (1 - BROKERAGE)
        pnl      = revenue - (position * entry_price)
        capital += revenue
        log_msg  = f"ML → SELL (p={conf:.3f}) | fill={int(sell_fill)} | realized PnL = {'+' if pnl > 0 else ''}{pnl:.2f}"
        print(log_msg)
        trades.append({
            'date': idx, 'action': 'SELL',
            'price': round(sell_fill, 2), 'qty': position,
            'pnl': round(pnl, 2), 'confidence': round(conf, 3),
            'log': log_msg, 'exit_type': 'signal'
        })
        position = 0

    # Track portfolio value
    portfolio_value = capital + (position * price)
    portfolio.append({'date': idx, 'value': portfolio_value})

# ── 4. RESULTS ─────────────────────────────────────────────────
portfolio_df = pd.DataFrame(portfolio).set_index('date')
trades_df    = pd.DataFrame(trades)

final_value  = portfolio_df['value'].iloc[-1]
total_return = (final_value - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
total_trades = len(trades_df)

sell_trades  = trades_df[trades_df['action'] == 'SELL']
wins         = len(sell_trades[sell_trades['pnl'] > 0])
losses       = len(sell_trades[sell_trades['pnl'] <= 0])
win_rate     = round(wins / len(sell_trades) * 100, 1) if len(sell_trades) > 0 else 0

max_drawdown = 0
peak = INITIAL_CAPITAL
for v in portfolio_df['value']:
    if v > peak:
        peak = v
    dd = (peak - v) / peak * 100
    if dd > max_drawdown:
        max_drawdown = dd

print("\n" + "=" * 45)
print("         BACKTEST RESULTS")
print("=" * 45)
print(f"Initial Capital  : ₹{INITIAL_CAPITAL:,.0f}")
print(f"Final Value      : ₹{final_value:,.0f}")
print(f"Total Return     : {total_return:.2f}%")
print(f"Total Trades     : {total_trades}")
print(f"Winning Trades   : {wins}")
print(f"Losing Trades    : {losses}")
print(f"Win Rate         : {win_rate}%")
print(f"Max Drawdown     : {max_drawdown:.2f}%")
print("=" * 45)

if len(sell_trades) > 0:
    print(f"\nBest trade  : +₹{sell_trades['pnl'].max():,.2f}")
    print(f"Worst trade :  ₹{sell_trades['pnl'].min():,.2f}")
    print(f"Avg trade   : +₹{sell_trades['pnl'].mean():,.2f}")

print("\nLast 5 trades:")
print(trades_df.tail())

# ── 5. SAVE ────────────────────────────────────────────────────
trades_df.to_csv("data/trades_log.csv", index=False)
portfolio_df.to_csv("data/portfolio.csv")

# ── 6. PLOT ────────────────────────────────────────────────────
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))

# Equity curve
ax1.plot(portfolio_df.index, portfolio_df['value'], color='royalblue', linewidth=1.5)
ax1.axhline(y=INITIAL_CAPITAL, color='gray', linestyle='--', linewidth=1)
ax1.set_title('Portfolio Value Over Time — NSEI ML Strategy')
ax1.set_ylabel('Portfolio Value (₹)')

# PnL per trade bar chart
sell_df = trades_df[trades_df['action'] == 'SELL'].copy()
colors  = ['#22c55e' if p > 0 else '#ef4444' for p in sell_df['pnl']]
ax2.bar(range(len(sell_df)), sell_df['pnl'], color=colors)
ax2.axhline(y=0, color='gray', linewidth=0.8)
ax2.set_title('PnL Per Trade (Green = Win, Red = Loss)')
ax2.set_ylabel('PnL (₹)')
ax2.set_xlabel('Trade Number')

plt.tight_layout()
plt.savefig("data/equity_curve.png", dpi=150)
plt.show()
print("✅ Equity curve saved to data/equity_curve.png")