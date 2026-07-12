"""
benchmark_stocks.py

Buy-and-hold benchmark over the SAME held-out test period used by
backtest_stocks.py, so the two are directly comparable.

Approach: equal-weight basket of all 49 Nifty stocks, bought on the first
test-period date and held to the last test-period date, with the same
realistic delivery-trading costs (one buy, one sell per stock — this is
about as low-turnover as it gets, which is exactly the point of a benchmark).

This answers the real question: is the active strategy's stock-picking and
rotation actually earning its complexity, or would you have done as well (or
better) just buying and holding everything?
"""

import pandas as pd
import numpy as np

INITIAL_CAPITAL = 100_000
BROKERAGE = 0.0005
SLIPPAGE  = 0.0005


def main():
    df = pd.read_csv('data/nifty50_features.csv', index_col=0, parse_dates=True)
    df = df.dropna()

    unique_dates = np.sort(df.index.unique())
    split_date = unique_dates[int(len(unique_dates) * 0.8)]
    test_df = df[df.index >= split_date].copy()

    start_date = test_df.index.min()
    end_date   = test_df.index.max()
    symbols = sorted(test_df['symbol'].unique())

    print("=" * 50)
    print("  BUY & HOLD BENCHMARK — Equal-weight, all 49 stocks")
    print("=" * 50)
    print(f"Period: {start_date.date()} to {end_date.date()}")
    print(f"Symbols: {len(symbols)}")

    capital_per_stock = INITIAL_CAPITAL / len(symbols)
    total_final_value = 0
    skipped = []

    for sym in symbols:
        sym_rows = test_df[test_df['symbol'] == sym].sort_index()
        if sym_rows.empty:
            skipped.append(sym)
            total_final_value += capital_per_stock
            continue

        entry_price = sym_rows['Close'].iloc[0] * (1 + SLIPPAGE)
        exit_price  = sym_rows['Close'].iloc[-1] * (1 - SLIPPAGE)

        qty = int(capital_per_stock // (entry_price * (1 + BROKERAGE)))
        if qty <= 0:
            # Can't afford even 1 share at this allocation (e.g. high-priced
            # stocks like MARUTI/ULTRACEMCO/BAJAJ-AUTO relative to a ~₹2,041
            # per-stock slice). This capital does NOT disappear — it just
            # stays as un-invested cash and still counts toward the final total.
            skipped.append(sym)
            total_final_value += capital_per_stock
            continue

        cost = qty * entry_price * (1 + BROKERAGE)
        proceeds = qty * exit_price * (1 - BROKERAGE)
        leftover_cash = capital_per_stock - cost  # un-invested remainder, e.g. odd lot rounding

        total_final_value += proceeds + leftover_cash

    total_return = (total_final_value - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
    n_days = len(unique_dates[unique_dates >= split_date])
    years = max(n_days / 252, 1e-6)
    cagr = ((total_final_value / INITIAL_CAPITAL) ** (1 / years) - 1) * 100

    print(f"\nInitial Capital  : ₹{INITIAL_CAPITAL:,.0f}")
    print(f"Final Value      : ₹{total_final_value:,.0f}")
    print(f"Total Return     : {total_return:.2f}%")
    print(f"CAGR             : {cagr:.2f}%")
    if skipped:
        print(f"Held as idle cash (couldn't afford 1 share at this allocation): {', '.join(skipped)}")
        print(f"  → {len(skipped)}/{len(symbols)} stocks — this is a real limitation of splitting")
        print(f"    only ₹{INITIAL_CAPITAL:,.0f} equally across 49 stocks, some priced ₹10,000+/share.")
    print("=" * 50)
    print("\nCompare this to backtest_stocks.py's results:")
    print("If the active strategy's CAGR/Sharpe don't clear this benchmark by a")
    print("meaningful margin, the added complexity of ranking + rotation isn't")
    print("earning its keep yet, given the extra risk (idiosyncratic stock risk,")
    print("model risk, execution complexity) it introduces vs. just holding everything.")


if __name__ == "__main__":
    main()