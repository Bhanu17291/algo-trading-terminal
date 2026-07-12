"""
backtest_stocks.py

Multi-position portfolio backtest for the Nifty 50 ranking model.

Key differences vs. your original backtest.py:
  1. Tracks MULTIPLE simultaneous positions (one portfolio across many
     stocks), not a single position on one index.
  2. Uses the ranker model's continuous score to rank stocks each day and
     rotate into the top-K, rather than a discrete BUY/SELL signal. This
     sidesteps the bug in the original backtest.py where `signal == -1`
     could never fire against a 2-class model — there's no discrete SELL
     signal here to get out of sync in the first place.
  3. Built as a reusable function (run_backtest) so Phase 4's three
     strategies can each call it with different top_k / position sizing /
     stock universe and get back comparable metrics.

Run directly for a demo backtest with sensible defaults, or import
`run_backtest()` from strategy_engine.py later.
"""

import pandas as pd
import numpy as np
import joblib
import json

# ── DEFAULT PARAMETERS (Phase 4 will override these per-strategy) ────
INITIAL_CAPITAL = 100_000
# NOTE ON COSTS: the original backtest.py's 0.2% brokerage + 0.1% slippage
# (~0.6% round trip) reflects index/futures-style trading costs. Most Indian
# discount brokers (Zerodha, Groww, Upstox) charge ZERO brokerage on equity
# DELIVERY trades — real costs are mostly STT (~0.1% on the sell leg) plus
# small exchange/SEBI/stamp charges, roughly 0.15-0.2% round trip in total.
# These defaults reflect that more realistic delivery-trading cost structure.
# Verify against your actual broker's charges before treating this as final.
BROKERAGE        = 0.0005  # ~0.05% per leg (covers exchange/SEBI/stamp charges)
SLIPPAGE         = 0.0005  # ~0.05% per leg fill slippage
MAX_HOLD_DAYS    = 15      # force exit after N days, same as original
TOP_K            = 10      # how many stocks to hold at once
MIN_HOLD_DAYS    = 3       # don't rotate a position out before this many days
                            # (prevents excessive whipsaw/churn from daily re-ranking)


def load_ranker_predictions():
    """Load the trained ranker ensemble and score the full dataset."""
    df = pd.read_csv('data/nifty50_features.csv', index_col=0, parse_dates=True)
    df = df.dropna()

    symbol_encoder = joblib.load('models/symbol_encoder_stocks_ranker.pkl')
    df['symbol_id'] = symbol_encoder.transform(df['symbol'])

    FEATURES = joblib.load('models/features_stocks_ranker.pkl')
    weights  = joblib.load('models/ensemble_weights_stocks_ranker.pkl')

    xgb_model  = joblib.load('models/xgb_model_stocks_ranker.pkl')
    lgbm_model = joblib.load('models/lgbm_model_stocks_ranker.pkl')
    cat_model  = joblib.load('models/cat_model_stocks_ranker.pkl')

    X = df[FEATURES]
    df['pred_score'] = (
        weights['w_xgb']  * xgb_model.predict(X) +
        weights['w_lgbm'] * lgbm_model.predict(X) +
        weights['w_cat']  * cat_model.predict(X)
    )

    # Only backtest on the same held-out test period the model was
    # evaluated on — testing on training-period data would be look-ahead.
    unique_dates = np.sort(df.index.unique())
    split_date = unique_dates[int(len(unique_dates) * 0.8)]
    test_df = df[df.index >= split_date].copy()

    return test_df


def run_backtest(
    scored_df,
    top_k=TOP_K,
    max_hold_days=MAX_HOLD_DAYS,
    min_hold_days=MIN_HOLD_DAYS,
    rebalance_every=10,   # matches the validated Phase 3 result (10d beat 5d)
    initial_capital=INITIAL_CAPITAL,
    brokerage=BROKERAGE,
    slippage=SLIPPAGE,
    allowed_symbols=None,
    select_fn=None,       # optional custom selector: (day_rows, top_k) -> ranked symbol list.
                          # Defaults to plain top-K by pred_score if not given.
    sizing="equal",       # "equal" or "conviction" (weight new positions by relative pred_score)
    equity_exposure_pct=1.0,  # cap on what fraction of total portfolio value stays invested
                              # in equities; the rest is held as a cash buffer. 1.0 = fully
                              # invested (default, unchanged behavior). e.g. 0.7 = defensive
                              # posture — same stock selection, just less market exposure.
    label="Strategy",
):
    """
    scored_df: DataFrame indexed by date, with columns ['symbol', 'Close', 'pred_score']
               (plus whatever extra columns a custom select_fn needs, e.g. 'sector', 'volatility_20').
    allowed_symbols: optional list to restrict the universe.
    select_fn: optional function(day_rows: DataFrame, top_k: int) -> list[str] of symbols,
               best-first. Lets Phase 4 express sector caps / volatility filters that a
               plain top-K sort can't.
    Returns a dict of performance stats + the trades/portfolio DataFrames.
    """
    df = scored_df.copy()
    if allowed_symbols is not None:
        df = df[df['symbol'].isin(allowed_symbols)]

    def default_select(day_rows, k):
        return list(day_rows.sort_values('pred_score', ascending=False)['symbol'].head(k))

    selector = select_fn if select_fn is not None else default_select

    dates = np.sort(df.index.unique())
    cash = initial_capital
    positions = {}   # symbol -> {'qty', 'entry_price', 'entry_day', 'entry_idx'}
    trades = []
    portfolio_curve = []
    last_top_syms = []  # cached ranking, used to redeploy cash between rebalance days

    for day_idx, date in enumerate(dates):
        day_rows = df.loc[[date]] if date in df.index else pd.DataFrame()
        if isinstance(day_rows, pd.Series):
            day_rows = day_rows.to_frame().T
        prices_today = day_rows.set_index('symbol')['Close'].to_dict()

        # ── 1. Force-exit positions held too long, or missing today's price ──
        to_close = []
        for sym, pos in positions.items():
            held_days = day_idx - pos['entry_idx']
            if sym not in prices_today:
                continue  # no data today, skip (don't force-close on a data gap)
            if held_days >= max_hold_days:
                to_close.append(sym)

        # ── 2. Rank today's universe, decide rotations ──
        # Only re-rank and rotate on rebalance days — matches the model's
        # actual 5-day prediction horizon instead of chasing daily noise.
        is_rebalance_day = (day_idx % rebalance_every == 0)

        if is_rebalance_day:
            top_syms = selector(day_rows, top_k)
            last_top_syms = top_syms

            # positions eligible to rotate out: held >= min_hold_days AND no longer in top_k
            for sym, pos in positions.items():
                if sym in to_close:
                    continue
                held_days = day_idx - pos['entry_idx']
                if held_days >= min_hold_days and sym not in top_syms and sym in prices_today:
                    to_close.append(sym)
        else:
            # No new rotation decisions, but reuse the last known ranking to
            # fill any slots freed up by a forced (max_hold_days) exit today —
            # otherwise that capital sits idle until the next rebalance day.
            top_syms = last_top_syms

        for sym in to_close:
            pos = positions.pop(sym)
            price = prices_today[sym]
            sell_fill = price * (1 - slippage)
            revenue = pos['qty'] * sell_fill * (1 - brokerage)
            pnl = revenue - (pos['qty'] * pos['entry_price'])
            cash += revenue
            trades.append({
                'date': date, 'symbol': sym, 'action': 'SELL',
                'price': round(sell_fill, 2), 'qty': pos['qty'],
                'pnl': round(pnl, 2), 'held_days': day_idx - pos['entry_idx'],
            })

        # ── 3. Open new positions to fill empty slots, from top-ranked, not-held stocks ──
        open_slots = top_k - len(positions)
        if open_slots > 0:
            candidates = [s for s in top_syms if s not in positions and s in prices_today]
            candidates = candidates[:open_slots]
            if candidates:
                # Cap total deployable capital at equity_exposure_pct of current total
                # portfolio value — keeps a cash buffer instead of investing 100%.
                holdings_value_now = sum(
                    pos['qty'] * prices_today.get(sym, pos['entry_price'])
                    for sym, pos in positions.items()
                )
                total_value_now = cash + holdings_value_now
                target_equity_value = equity_exposure_pct * total_value_now
                deployable = max(0.0, min(cash, target_equity_value - holdings_value_now))

                if sizing == "conviction":
                    # Weight capital by relative pred_score among candidates being
                    # bought (only positive scores count; floor at a small epsilon
                    # so a candidate with a weak-but-selected score still gets some
                    # allocation rather than zero).
                    scores = day_rows.set_index('symbol')['pred_score'].to_dict()
                    raw_weights = np.array([max(scores.get(s, 0), 1e-6) for s in candidates])
                    norm_weights = raw_weights / raw_weights.sum()
                else:
                    norm_weights = np.array([1 / len(candidates)] * len(candidates))

                for sym, w in zip(candidates, norm_weights):
                    capital_for_slot = deployable * w / norm_weights.sum() if sizing == "conviction" else deployable / len(candidates)
                    price = prices_today[sym]
                    buy_fill = price * (1 + slippage)
                    qty = int(capital_for_slot // (buy_fill * (1 + brokerage)))
                    if qty <= 0:
                        continue
                    cost = qty * buy_fill * (1 + brokerage)
                    if cost > cash:
                        continue
                    cash -= cost
                    positions[sym] = {'qty': qty, 'entry_price': buy_fill, 'entry_idx': day_idx}
                    trades.append({
                        'date': date, 'symbol': sym, 'action': 'BUY',
                        'price': round(buy_fill, 2), 'qty': qty,
                        'pnl': 0, 'held_days': 0,
                    })

        # ── 4. Track portfolio value ──
        holdings_value = sum(
            pos['qty'] * prices_today.get(sym, pos['entry_price'])
            for sym, pos in positions.items()
        )
        portfolio_curve.append({'date': date, 'value': cash + holdings_value})

    # ── Force-close anything still open at the end, at last known price ──
    if positions:
        last_date = dates[-1]
        last_rows = df.loc[[last_date]] if last_date in df.index else pd.DataFrame()
        last_prices = last_rows.set_index('symbol')['Close'].to_dict() if not last_rows.empty else {}
        for sym, pos in list(positions.items()):
            price = last_prices.get(sym, pos['entry_price'])
            sell_fill = price * (1 - slippage)
            revenue = pos['qty'] * sell_fill * (1 - brokerage)
            pnl = revenue - (pos['qty'] * pos['entry_price'])
            cash += revenue
            trades.append({
                'date': last_date, 'symbol': sym, 'action': 'SELL (final)',
                'price': round(sell_fill, 2), 'qty': pos['qty'],
                'pnl': round(pnl, 2), 'held_days': len(dates) - 1 - pos['entry_idx'],
            })

    portfolio_df = pd.DataFrame(portfolio_curve).set_index('date')
    trades_df = pd.DataFrame(trades)

    final_value = portfolio_df['value'].iloc[-1] if len(portfolio_df) else initial_capital
    total_return = (final_value - initial_capital) / initial_capital * 100

    n_days = len(portfolio_df)
    years = max(n_days / 252, 1e-6)
    cagr = ((final_value / initial_capital) ** (1 / years) - 1) * 100 if final_value > 0 else -100

    daily_returns = portfolio_df['value'].pct_change().dropna()
    sharpe = (daily_returns.mean() / daily_returns.std() * np.sqrt(252)) if daily_returns.std() > 0 else 0

    peak = initial_capital
    max_dd = 0
    for v in portfolio_df['value']:
        if v > peak:
            peak = v
        dd = (peak - v) / peak * 100
        max_dd = max(max_dd, dd)

    sells = trades_df[trades_df['action'].str.startswith('SELL')] if len(trades_df) else pd.DataFrame()
    wins = len(sells[sells['pnl'] > 0]) if len(sells) else 0
    losses = len(sells[sells['pnl'] <= 0]) if len(sells) else 0
    win_rate = (wins / len(sells) * 100) if len(sells) else 0

    stats = {
        'label': label,
        'initial_capital': initial_capital,
        'final_value': round(final_value, 2),
        'total_return_pct': round(total_return, 2),
        'cagr_pct': round(cagr, 2),
        'sharpe': round(sharpe, 2),
        'max_drawdown_pct': round(max_dd, 2),
        'total_trades': len(trades_df),
        'win_rate_pct': round(win_rate, 1),
        'wins': wins,
        'losses': losses,
    }

    return stats, trades_df, portfolio_df


def print_report(stats):
    print("\n" + "=" * 50)
    print(f"  BACKTEST RESULTS — {stats['label']}")
    print("=" * 50)
    print(f"Initial Capital  : ₹{stats['initial_capital']:,.0f}")
    print(f"Final Value      : ₹{stats['final_value']:,.0f}")
    print(f"Total Return     : {stats['total_return_pct']}%")
    print(f"CAGR             : {stats['cagr_pct']}%")
    print(f"Sharpe Ratio     : {stats['sharpe']}")
    print(f"Max Drawdown     : {stats['max_drawdown_pct']}%")
    print(f"Total Trades     : {stats['total_trades']}")
    print(f"Win Rate         : {stats['win_rate_pct']}% ({stats['wins']}W / {stats['losses']}L)")
    print("=" * 50)


if __name__ == "__main__":
    print("Loading ranker predictions on held-out test period...")
    scored_df = load_ranker_predictions()
    print(f"Test rows: {len(scored_df)} | Dates: {scored_df.index.nunique()} | Symbols: {scored_df['symbol'].nunique()}")

    # Run 1: realistic delivery-trading costs, rebalance every 5 days (matches signal horizon)
    stats_real, trades_real, portfolio_real = run_backtest(
        scored_df, rebalance_every=5, label="Realistic costs, rebalance every 5 days"
    )
    print_report(stats_real)

    # Run 2: same realistic costs, but rebalance every 10 days — the validated
    # baseline going into Phase 4 (this beat both the 5-day version and buy-and-hold).
    stats_slow, trades_slow, portfolio_slow = run_backtest(
        scored_df, rebalance_every=10, label="Realistic costs, rebalance every 10 days"
    )
    print_report(stats_slow)

    # Run 3: zero costs — diagnostic only, NOT deployable. Isolates whether
    # remaining losses are cost-driven or the signal itself is just this thin.
    stats_zero, trades_zero, portfolio_zero = run_backtest(
        scored_df, brokerage=0.0, slippage=0.0, rebalance_every=10,
        label="DIAGNOSTIC ONLY — zero costs (not a real strategy)"
    )
    print_report(stats_zero)

    print("\n" + "=" * 50)
    print("  SUMMARY")
    print("=" * 50)
    print(f"{'Rebalance every 5d, realistic costs:':<42} {stats_real['total_return_pct']:>7}%  ({stats_real['total_trades']} trades)")
    print(f"{'Rebalance every 10d, realistic costs:':<42} {stats_slow['total_return_pct']:>7}%  ({stats_slow['total_trades']} trades)")
    print(f"{'Zero costs (diagnostic only):':<42} {stats_zero['total_return_pct']:>7}%  ({stats_zero['total_trades']} trades)")
    print("=" * 50)

    print("\nLast 10 trades (realistic costs, rebalance every 5d):")
    print(trades_real.tail(10).to_string(index=False))

    trades_real.to_csv("data/trades_log_stocks.csv", index=False)
    portfolio_real.to_csv("data/portfolio_stocks.csv")
    with open("data/backtest_stats_stocks.json", "w") as f:
        json.dump({
            'rebalance_5d': stats_real,
            'rebalance_10d': stats_slow,
            'zero_costs_diagnostic': stats_zero,
        }, f, indent=2)

    print("\n✅ Saved data/trades_log_stocks.csv, data/portfolio_stocks.csv, data/backtest_stats_stocks.json")