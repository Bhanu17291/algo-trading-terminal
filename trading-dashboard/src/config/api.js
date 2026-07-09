/**
 * src/config/api.js
 * Central API layer — all calls go through fetchJson()
 * Backend: https://algo-trading-terminal.onrender.com
 */

const BASE_URL =
    import.meta.env.VITE_API_URL || "https://algo-trading-terminal.onrender.com";

/**
 * Core fetch helper used by all pages.
 * Usage: const data = await fetchJson("/signal");
 */
export async function fetchJson(path) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
}

/* ── Typed helpers (optional convenience wrappers) ─────────────────── */

export const api = {
    /** GET /signal — latest ML signal */
    signal: () => fetchJson("/signal"),

    /** GET /portfolio — QUANT equity curve */
    portfolio: () => fetchJson("/portfolio"),

    /** GET /trades — last 20 trades */
    trades: () => fetchJson("/trades"),

    /** GET /stats — summary stats */
    stats: () => fetchJson("/stats"),

    /** GET /pnl — cumulative PnL */
    pnl: () => fetchJson("/pnl"),

    /** GET /indicators — OHLCV + RSI + MACD + BB + SMA */
    indicators: () => fetchJson("/indicators"),

    /** GET /psychology — behavioural bias scores */
    psychology: () => fetchJson("/psychology"),

    /** GET /shap — SHAP feature importance */
    shap: () => fetchJson("/shap"),

    /** GET /market-status — IST clock + open/closed */
    marketStatus: () => fetchJson("/market-status"),

    /** GET /live-log — last 10 live trading events */
    liveLog: () => fetchJson("/live-log"),

    /** GET /clients — QUANT vs MACRO full data */
    clients: () => fetchJson("/clients"),

    /** GET /clients/compare — head-to-head comparison */
    clientsCompare: () => fetchJson("/clients/compare"),

    /** GET /walkforward — walk-forward backtest results */
    walkforward: () => fetchJson("/walkforward"),

    /** GET /meta — dynamic model metadata */
    meta: () => fetchJson("/meta"),
};

export default api;