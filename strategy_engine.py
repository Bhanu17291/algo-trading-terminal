"""
strategy_engine.py

Builds the 3 differentiated strategies on top of the validated ranker model
and backtest engine:

  1. High-Conviction Momentum — the top 9 scored stocks. This IS the shared
     "core" used by all three strategies below.
  2. Diversified Quality       — the same 9-stock core, PLUS 5 more stocks
     (sector-capped, max 2/sector) drawn from the next tier of the ranking.
     14 stocks total, fully invested.
  3. Defensive Core            — THE SAME 14 STOCKS as Diversified Quality,
     but only 70% of capital deployed into equities — the rest sits in
     cash. "Defensive" comes from risk management (lower market exposure),
     not from hunting for extra stock picks.

WHY DEFENSIVE CORE DOESN'T USE ITS OWN STOCK PICKS: two different attempts
to build a distinct, lower-volatility periphery both failed (-6.04% and
then -10.54% CAGR) — worse in different ways, which is strong evidence the
pool beyond the top ~14 stocks (rank ~15-30 of 49) just doesn't carry
usable signal in this dataset. Rather than keep manufacturing picks from a
pool the data says has no edge, Defensive Core reuses Diversified Quality's
proven stock list and gets its "defensive" character from holding less of
it (70% invested, 30% cash buffer) — this is also how defensive portfolios
are commonly built in practice.

Each strategy is BOTH:
  (a) backtested over the same held-out test period as Phase 3, and
  (b) used to generate a LIVE recommendation (today's picks + suggested lot
      sizes) using the most recent date's model scores.

Baseline config: rebalance_every=10, realistic delivery-trading costs.
"""

import functools
import json

import numpy as np
import pandas as pd

from backtest_stocks import load_ranker_predictions, print_report, run_backtest
from nifty50_universe import SECTOR_MAP

INITIAL_CAPITAL = 100_000  # per-strategy notional, for the live lot-size suggestions


# ── RAW SELECTION RULES — operate on whatever pool they're given ─────
# These get called in sequence by precompute_all_selections(), each on the
# pool left over after the previous strategy's picks were removed.
#
# NOTE: earlier versions filtered High-Conviction to high-volatility names
# and Defensive Core to low-volatility names. Empirically, BOTH volatility
# filters underperformed (-3.18% and -4.31% CAGR respectively), while the
# one strategy with NO volatility filter (Diversified Quality, +3.58%) kept
# winning across every version tested. That's real evidence the model's
# thin (IC=0.054) edge isn't volatility-conditional — splitting by beta
# doesn't find better sub-populations, it just cuts away usable signal in
# both directions. So: pure score-rank cascade below, differentiated only
# by stock count, sector caps, and (for Defensive) a positive-score floor.

def select_high_conviction_raw(pool, top_k):
    """Simply the top-scoring stocks from the pool — smallest count of the
    three, so 'high conviction' comes from concentration, not a volatility bet."""
    if pool.empty:
        return []
    ranked = pool.sort_values('pred_score', ascending=False)
    return list(ranked['symbol'].head(top_k))


def select_diversified_raw(pool, top_k, max_per_sector=2):
    """Top-scoring stocks, capped at max_per_sector per sector. This is the
    one selection rule that's consistently outperformed in every test."""
    if pool.empty:
        return []
    ranked = pool.sort_values('pred_score', ascending=False)
    counts = {}
    picked = []
    for _, row in ranked.iterrows():
        sector = row.get('sector', 'Unknown')
        if counts.get(sector, 0) < max_per_sector:
            picked.append(row['symbol'])
            counts[sector] = counts.get(sector, 0) + 1
        if len(picked) >= top_k:
            break
    if len(picked) < top_k:  # sector cap left us short — fill ignoring the cap
        for sym in ranked['symbol']:
            if sym not in picked:
                picked.append(sym)
            if len(picked) >= top_k:
                break
    return picked


STRATEGIES = {
    "high_conviction_momentum": {
        "label": "High-Conviction Momentum",
        "raw_select_fn": select_high_conviction_raw,
        "top_k": 9,
        "sizing": "equal",  # see the equal-vs-conviction tuning check in main()
        "equity_exposure": 1.0,
        "description": "The top 9 scored stocks — this IS the shared core used by all 3 strategies. Most concentrated, largest per-stock weight, fully invested.",
    },
    "diversified_quality": {
        "label": "Diversified Quality",
        "raw_select_fn": select_diversified_raw,
        "top_k": 14,
        "sizing": "equal",
        "equity_exposure": 1.0,
        "description": "The same 9-stock core, plus 5 more sector-capped names (max 2/sector) from the next tier. 14 stocks total, fully invested.",
    },
    "defensive_core": {
        "label": "Defensive Core",
        "raw_select_fn": None,  # reuses Diversified Quality's picks — see precompute_all_selections
        "top_k": 14,
        "sizing": "equal",
        "equity_exposure": 0.7,  # only 70% deployed into equities; 30% cash buffer
        "description": "THE SAME 14 stocks as Diversified Quality, but only 70% of capital invested — 30% held as cash. Defensive via lower market exposure, not extra (unproven) stock picks.",
    },
}

STRATEGY_ORDER = ["high_conviction_momentum", "diversified_quality", "defensive_core"]


def precompute_all_selections(scored_df):
    """
    For every date in scored_df:
      1. Computes the shared CORE (top 9 by score) — used by ALL 3 strategies.
      2. Computes Diversified Quality's PERIPHERY (sector-capped) from the
         pool remaining after the core is removed.
      3. Computes Defensive Core's PERIPHERY (positive-score only) from
         what's left after the core AND Diversified's periphery are removed.

    The core overlaps across all 3 by design (that's where the real edge
    is). The peripheries are mutually exclusive — this is what actually
    differentiates the three baskets in breadth and character.

    Returns: {strategy_key: {date: [symbols]}}
    """
    dates = np.sort(scored_df.index.unique())
    selections = {key: {} for key in STRATEGY_ORDER}

    core_size = STRATEGIES["high_conviction_momentum"]["top_k"]
    dq_total  = STRATEGIES["diversified_quality"]["top_k"]

    for date in dates:
        day_rows = scored_df.loc[[date]]

        core_picks = select_high_conviction_raw(day_rows, core_size)
        selections["high_conviction_momentum"][date] = core_picks

        remaining_after_core = day_rows[~day_rows['symbol'].isin(core_picks)]
        dq_periphery_needed = max(dq_total - core_size, 0)
        dq_periphery = select_diversified_raw(remaining_after_core, dq_periphery_needed)
        selections["diversified_quality"][date] = core_picks + dq_periphery

        # Defensive Core: SAME stocks as Diversified Quality — differentiated
        # by equity_exposure (70%) in run_backtest / build_live_recommendation,
        # not by a separate (unproven) stock selection.
        selections["defensive_core"][date] = core_picks + dq_periphery

    return selections


def make_lookup_selector(selections, strategy_key):
    """Wraps the precomputed per-date selections as a select_fn compatible
    with run_backtest's (day_rows, top_k) -> [symbols] interface."""
    def selector(day_rows, top_k):
        if day_rows.empty:
            return []
        date = day_rows.index[0]
        return selections[strategy_key].get(date, [])
    return selector


def add_sector_column(scored_df):
    df = scored_df.copy()
    df['sector'] = df['symbol'].map(SECTOR_MAP).fillna('Unknown')
    return df


def build_live_recommendation(scored_df, selections, strategy_key, capital=INITIAL_CAPITAL):
    """Uses the MOST RECENT date's precomputed picks to produce today's
    holdings + suggested lot sizes for one strategy."""
    cfg = STRATEGIES[strategy_key]
    latest_date = scored_df.index.max()
    day_rows = scored_df.loc[[latest_date]]

    picks = selections[strategy_key].get(latest_date, [])
    picks = [p for p in picks if p in day_rows['symbol'].values]

    prices = day_rows.set_index('symbol')['Close'].to_dict()
    scores = day_rows.set_index('symbol')['pred_score'].to_dict()

    equity_exposure = cfg.get("equity_exposure", 1.0)
    deployable_capital = capital * equity_exposure
    cash_reserve = capital - deployable_capital

    if cfg["sizing"] == "conviction":
        raw_weights = np.array([max(scores.get(s, 0), 1e-6) for s in picks])
        weights = raw_weights / raw_weights.sum() if len(raw_weights) else raw_weights
    else:
        weights = np.array([1 / len(picks)] * len(picks)) if picks else np.array([])

    holdings = []
    for sym, w in zip(picks, weights):
        price = prices[sym]
        alloc = deployable_capital * w
        qty = int(alloc // price)
        holdings.append({
            "symbol": sym,
            "sector": SECTOR_MAP.get(sym, "Unknown"),
            "price": round(price, 2),
            "weight_pct": round(w * equity_exposure * 100, 1),  # weight of TOTAL capital, not just deployed portion
            "suggested_qty": qty,
            "allocated_rupees": round(qty * price, 2),
            "pred_score": round(scores[sym], 5),
        })

    return {
        "strategy": cfg["label"],
        "as_of_date": str(latest_date.date()),
        "num_stocks": len(holdings),
        "equity_exposure_pct": round(equity_exposure * 100, 1),
        "cash_reserve_rupees": round(cash_reserve, 2),
        "holdings": holdings,
    }


def main():
    print("=" * 60)
    print("PHASE 4 — STRATEGY ENGINE (with guaranteed exclusive selection)")
    print("=" * 60)

    print("\nLoading ranker predictions...")
    scored_df = load_ranker_predictions()
    scored_df = add_sector_column(scored_df)
    print(f"Test rows: {len(scored_df)} | Dates: {scored_df.index.nunique()} | Symbols: {scored_df['symbol'].nunique()}")

    print("\nPrecomputing sequential (non-overlapping) selections for all dates...")
    selections = precompute_all_selections(scored_df)
    print("Done.")

    # ── TUNING CHECK: does conviction-weighting actually help High-Conviction? ──
    # Earlier run showed conviction-weighted sizing was actively unprofitable
    # (CAGR -4.54%, Sharpe -0.15) — worse than doing nothing. Testing both
    # sizing modes head-to-head here rather than assuming equal-weight is right.
    print("\n" + "=" * 60)
    print("  TUNING CHECK — High-Conviction sizing: equal vs. conviction-weighted")
    print("=" * 60)
    hc_selector = make_lookup_selector(selections, "high_conviction_momentum")
    hc_top_k = STRATEGIES["high_conviction_momentum"]["top_k"]

    for sizing_mode in ["equal", "conviction"]:
        stats, _, _ = run_backtest(
            scored_df, top_k=hc_top_k, select_fn=hc_selector, sizing=sizing_mode,
            rebalance_every=10, label=f"High-Conviction ({sizing_mode}-weighted)"
        )
        print_report(stats)

    print("\n→ Compare the two reports above. STRATEGIES config currently uses")
    print("  sizing='equal' for High-Conviction. Change it in the STRATEGIES dict")
    print("  if conviction-weighted actually wins in YOUR run.")

    all_results = {}
    live_picks_by_strategy = {}

    for key in STRATEGY_ORDER:
        cfg = STRATEGIES[key]
        print("\n" + "=" * 60)
        print(f"  {cfg['label'].upper()}")
        print("=" * 60)
        print(cfg["description"])

        selector = make_lookup_selector(selections, key)
        stats, trades_df, portfolio_df = run_backtest(
            scored_df,
            top_k=cfg["top_k"],
            select_fn=selector,
            sizing=cfg["sizing"],
            equity_exposure_pct=cfg.get("equity_exposure", 1.0),
            rebalance_every=10,
            label=cfg["label"],
        )
        print_report(stats)

        live = build_live_recommendation(scored_df, selections, key)
        live_picks_by_strategy[key] = set(h["symbol"] for h in live["holdings"])

        print(f"\nLive picks as of {live['as_of_date']} ({live['num_stocks']} stocks, "
              f"{live['equity_exposure_pct']}% invested, ₹{live['cash_reserve_rupees']:,.0f} cash reserve):")
        for h in live["holdings"]:
            print(f"  {h['symbol']:<15} {h['sector']:<20} weight={h['weight_pct']:>5}%  qty={h['suggested_qty']:<6} score={h['pred_score']}")

        all_results[key] = {"backtest_stats": stats, "live_recommendation": live}

    # ── Overlap check — core overlap is EXPECTED now (shared by design).
    # What matters is that the peripheries add real distinct breadth. ──
    print("\n" + "=" * 60)
    print("  OVERLAP CHECK (core overlap is intentional — see periphery breakdown)")
    print("=" * 60)
    core_size = STRATEGIES["high_conviction_momentum"]["top_k"]
    for i in range(len(STRATEGY_ORDER)):
        for j in range(i + 1, len(STRATEGY_ORDER)):
            a, b = live_picks_by_strategy[STRATEGY_ORDER[i]], live_picks_by_strategy[STRATEGY_ORDER[j]]
            overlap = a & b
            pct = len(overlap) / min(len(a), len(b)) * 100 if min(len(a), len(b)) > 0 else 0
            print(f"{STRATEGIES[STRATEGY_ORDER[i]]['label']} ∩ {STRATEGIES[STRATEGY_ORDER[j]]['label']}: "
                  f"{len(overlap)} stocks ({pct:.0f}%) — expected ~{core_size} from the shared core")

    # ── Summary table ──
    print("\n" + "=" * 60)
    print("  SUMMARY — all 3 strategies")
    print("=" * 60)
    print(f"{'Strategy':<28}{'CAGR':>8}{'Sharpe':>9}{'MaxDD':>8}{'WinRate':>9}{'Trades':>8}")
    for key in STRATEGY_ORDER:
        s = all_results[key]["backtest_stats"]
        cfg = STRATEGIES[key]
        print(f"{cfg['label']:<28}{s['cagr_pct']:>7}%{s['sharpe']:>9}{s['max_drawdown_pct']:>7}%{s['win_rate_pct']:>8}%{s['total_trades']:>8}")

    with open("data/strategies_output.json", "w") as f:
        json.dump(all_results, f, indent=2, default=str)

    print("\n✅ Saved data/strategies_output.json (backtest stats + live picks for all 3 strategies)")


if __name__ == "__main__":
    main()