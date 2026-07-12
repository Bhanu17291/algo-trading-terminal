import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// TEMPORARY: pointing at local backend for testing. Switch back to
// "https://algo-trading-terminal.onrender.com" once the new /strategies/recommend
// endpoint is deployed to Render.
const API = "http://localhost:8000";

const T = {
  bg:        "#040A06",
  surface:   "#0D1A13",
  border:    "rgba(34,197,94,0.1)",
  borderMd:  "rgba(34,197,94,0.2)",
  green:     "#22C55E",
  greenDim:  "#16A34A",
  mint:      "#86EFAC",
  pale:      "#BBF7D0",
  text:      "#E7F0EA",
  textDim:   "rgba(231,240,234,0.55)",
  textFaint: "rgba(231,240,234,0.25)",
  red:       "#F87171",
  amber:     "#FBBF24",
  blue:      "#60A5FA",
  mono:      "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans:      "'Inter','Segoe UI',system-ui,sans-serif",
};

const PROFILE_LABELS = {
  QUANT: "Aggressive",
  MACRO: "Conservative",
  BALANCED: "Balanced",
};

async function fetchWithRetry(url, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return res.json();
    } catch {
      // swallow — retry below
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export default function StrategiesPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Profile comes from the onboarding questionnaire's router state.
  // Falls back to BALANCED if someone lands here directly (e.g. skipped onboarding).
  const initialProfile = location.state?.customerProfile || "BALANCED";

  const [profile, setProfile] = useState(initialProfile);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithRetry(`${API}/strategies/recommend?profile=${profile}`).then((result) => {
      if (cancelled) return;
      if (!result || result.error) {
        setError(result?.message || "Couldn't load strategies right now.");
      } else {
        setData(result);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile]);

  const s = {
    root: {
      minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: T.sans, padding: "40px 28px 60px",
    },
    header: { maxWidth: 1100, margin: "0 auto 28px" },
    eyebrow: {
      fontSize: 9, color: T.green, letterSpacing: "2.5px", textTransform: "uppercase",
      fontFamily: T.mono, marginBottom: 10, fontWeight: 600,
    },
    title: { fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: 8 },
    sub: { fontSize: 12.5, color: T.textDim, lineHeight: 1.7, maxWidth: 640 },
    profileRow: { display: "flex", gap: 8, margin: "20px 0" },
    profilePill: (active) => ({
      padding: "6px 16px", borderRadius: 20, fontSize: 10.5, fontFamily: T.mono,
      cursor: "pointer", border: `1px solid ${active ? T.green : T.border}`,
      background: active ? "rgba(34,197,94,0.12)" : "transparent",
      color: active ? T.pale : T.textDim, letterSpacing: "0.5px",
      transition: "all 0.15s",
    }),
    grid: {
      maxWidth: 1100, margin: "0 auto", display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18,
    },
    card: (recommended) => ({
      background: "rgba(13,26,19,0.7)",
      border: `1px solid ${recommended ? T.green : T.border}`,
      borderTop: `2px solid ${recommended ? T.green : T.borderMd}`,
      borderRadius: 10, padding: "20px 20px 22px",
      display: "flex", flexDirection: "column",
      boxShadow: recommended ? "0 0 24px rgba(34,197,94,0.08)" : "none",
    }),
    badge: {
      display: "inline-flex", alignSelf: "flex-start", padding: "3px 10px", borderRadius: 20,
      background: "rgba(34,197,94,0.15)", color: T.green, fontSize: 8.5,
      fontFamily: T.mono, letterSpacing: "1px", textTransform: "uppercase",
      marginBottom: 10, fontWeight: 700,
    },
    cardTitle: { fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 },
    cardMeta: { fontSize: 9.5, color: T.textFaint, fontFamily: T.mono, marginBottom: 14 },
    statsGrid: {
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px",
      padding: "12px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
      marginBottom: 14,
    },
    statLabel: { fontSize: 8, color: T.textFaint, fontFamily: T.mono, letterSpacing: "0.5px", textTransform: "uppercase" },
    statValue: (color) => ({ fontSize: 15, fontWeight: 700, color: color || T.pale, fontFamily: T.mono, marginTop: 2 }),
    exposureNote: {
      fontSize: 9.5, color: T.amber, fontFamily: T.mono, marginBottom: 12,
      padding: "6px 10px", background: "rgba(251,191,36,0.06)", borderRadius: 4,
      border: "1px solid rgba(251,191,36,0.15)",
    },
    holdingsToggle: {
      fontSize: 10, color: T.mint, fontFamily: T.mono, background: "none", border: "none",
      cursor: "pointer", padding: "6px 0", textAlign: "left", letterSpacing: "0.3px",
    },
    holdingRow: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 2px", borderTop: `1px solid rgba(231,240,234,0.05)`, fontSize: 9.5,
    },
    footerRow: { maxWidth: 1100, margin: "32px auto 0", display: "flex", justifyContent: "center" },
    continueBtn: {
      padding: "12px 28px", background: T.green, color: T.bg, border: "none",
      borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
      letterSpacing: "0.5px", fontFamily: T.sans,
    },
  };

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.eyebrow}>● Personalized · Based on your answers</div>
        <div style={s.title}>Your recommended strategies</div>
        <p style={s.sub}>
          Based on your questionnaire, we've tagged you as a <strong style={{ color: T.mint }}>
          {PROFILE_LABELS[profile] || profile}</strong> investor. All 3 strategies are shown below —
          the one that best fits your profile is highlighted first.
        </p>
        <div style={s.profileRow}>
          {["QUANT", "BALANCED", "MACRO"].map((p) => (
            <button key={p} style={s.profilePill(p === profile)} onClick={() => setProfile(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: T.textDim, fontFamily: T.mono, fontSize: 11, padding: "40px 0" }}>
          Loading strategies…
        </div>
      )}

      {!loading && error && (
        <div style={{ textAlign: "center", color: T.red, fontFamily: T.mono, fontSize: 11, padding: "40px 0" }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div style={s.grid}>
            {data.strategies.map((strat) => {
              const isExpanded = expandedKey === strat.key;
              const shownHoldings = isExpanded ? strat.holdings : strat.holdings.slice(0, 5);
              return (
                <div key={strat.key} style={s.card(strat.recommended)}>
                  {strat.recommended && <div style={s.badge}>Recommended for you</div>}
                  <div style={s.cardTitle}>{strat.label}</div>
                  <div style={s.cardMeta}>{strat.num_stocks} stocks · as of {strat.as_of_date}</div>

                  <div style={s.statsGrid}>
                    <div>
                      <div style={s.statLabel}>CAGR</div>
                      <div style={s.statValue(T.mint)}>{strat.backtest_stats.cagr_pct}%</div>
                    </div>
                    <div>
                      <div style={s.statLabel}>Sharpe</div>
                      <div style={s.statValue()}>{strat.backtest_stats.sharpe}</div>
                    </div>
                    <div>
                      <div style={s.statLabel}>Max Drawdown</div>
                      <div style={s.statValue(T.red)}>{strat.backtest_stats.max_drawdown_pct}%</div>
                    </div>
                    <div>
                      <div style={s.statLabel}>Win Rate</div>
                      <div style={s.statValue()}>{strat.backtest_stats.win_rate_pct}%</div>
                    </div>
                  </div>

                  {strat.equity_exposure_pct < 100 && (
                    <div style={s.exposureNote}>
                      {strat.equity_exposure_pct}% invested · ₹{strat.cash_reserve_rupees.toLocaleString("en-IN")} held as cash buffer
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    {shownHoldings.map((h) => (
                      <div key={h.symbol} style={s.holdingRow}>
                        <span style={{ color: T.text, fontFamily: T.mono }}>{h.symbol}</span>
                        <span style={{ color: T.textFaint, fontFamily: T.mono }}>{h.weight_pct}% · qty {h.suggested_qty}</span>
                      </div>
                    ))}
                  </div>

                  {strat.holdings.length > 5 && (
                    <button
                      style={s.holdingsToggle}
                      onClick={() => setExpandedKey(isExpanded ? null : strat.key)}
                    >
                      {isExpanded ? "Show less ↑" : `Show all ${strat.holdings.length} stocks ↓`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={s.footerRow}>
            <button style={s.continueBtn} onClick={() => navigate("/dashboard")}>
              Continue to Dashboard →
            </button>
          </div>
        </>
      )}
    </div>
  );
}