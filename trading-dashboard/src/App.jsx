/**
 * src/App.jsx
 *
 * Changes vs original:
 *  1. useBackendWake() — gates ALL data fetching behind a health-check ping
 *  2. WakeScreen — shown while backend cold-starts, with progress + retry
 *  3. fetchWithRetry — 3-attempt retry with 2 s delay for every API call
 */

import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "./components/shared/PageLayout";
import WakeScreen from "./components/shared/WakeScreen";
import { useBackendWake } from "./hooks/useBackendWake";

// Pages
import LandingPage    from "./components/pages/LandingPage";
import Dashboard      from "./components/pages/Dashboard";
import TradePage      from "./components/pages/TradePage";
import IndicatorsPage from "./components/pages/IndicatorsPage";
import PsychPage      from "./components/pages/PsychPage";
import MarketPage     from "./components/pages/MarketPage";
import ExplainerPage  from "./components/pages/ExplainerPage";
import DrawdownPage   from "./components/pages/DrawdownPage";
import BacktestPage   from "./components/pages/BacktestPage";
import SimulatorPage  from "./components/pages/SimulatorPage";
import RiskPage       from "./components/pages/RiskPage";
import HeatmapPage    from "./components/pages/HeatmapPage";
import ScreenerPage   from "./components/pages/ScreenerPage";
import NewsPage       from "./components/pages/NewsPage";
import ClientsPage    from "./components/pages/ClientsPage";

const API = "https://algo-trading-terminal.onrender.com";

/** Fetch with up to `retries` attempts, 2 s delay between each. */
async function fetchWithRetry(url, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return res.json();
    } catch {
      // swallow — retry below
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return null; // graceful null on all failures
}

// ─── AppWrapper ────────────────────────────────────────────────────────────────
// Gated behind <WakeGate> so it only mounts once the backend is confirmed alive.
// That means every fetch here hits a warm server — no more infinite pending.

function AppWrapper({ Component }) {
  const navigate = useNavigate();

  const [signal,     setSignal]     = useState(null);
  const [stats,      setStats]      = useState(null);
  const [pnl,        setPnl]        = useState(null);
  const [portfolio,  setPortfolio]  = useState([]);
  const [psych,      setPsych]      = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [trades,     setTrades]     = useState([]);
  const [shap,       setShap]       = useState(null);
  const [compare,    setCompare]    = useState(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    const [sig, st, p, port, psy, ind, tr, sh] = await Promise.all([
      fetchWithRetry(`${API}/signal`),
      fetchWithRetry(`${API}/stats`),
      fetchWithRetry(`${API}/pnl`),
      fetchWithRetry(`${API}/portfolio`),
      fetchWithRetry(`${API}/psychology`),
      fetchWithRetry(`${API}/indicators`),
      fetchWithRetry(`${API}/trades`),
      fetchWithRetry(`${API}/shap`),
    ]);

    if (sig)  setSignal(sig);
    if (st)   setStats(st);
    if (p)    setPnl(p);
    if (port) setPortfolio(port);
    if (psy)  setPsych(psy);
    if (ind)  setIndicators(ind);
    if (tr)   setTrades(tr);
    if (sh)   setShap(sh);
    setLoading(false);

    // non-critical — load after main data
    const cmp = await fetchWithRetry(`${API}/clients/compare`);
    if (cmp) setCompare(cmp);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const props = {
    signal, stats, pnl, portfolio, psych, indicators, trades, shap, compare,
    onBack:  () => navigate("/"),
    setPage: (pg) => navigate(`/${pg}`),
  };

  return (
    <PageLayout>
      {loading ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "60px 0", color: "rgba(231,240,234,0.4)",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        }}>
          <div style={{
            width: 14, height: 14,
            border: "2px solid #22C55E", borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
          }} />
          Loading data…
        </div>
      ) : (
        <Component {...props} />
      )}
    </PageLayout>
  );
}

// ─── WakeGate ──────────────────────────────────────────────────────────────────
// Sits in front of every dashboard route.
// Shows WakeScreen until the backend responds, then renders children normally.

function WakeGate({ children }) {
  const { awake, elapsed, failed } = useBackendWake();
  const [retryKey, setRetryKey] = useState(0);

  if (!awake) {
    return (
      <WakeScreen
        elapsed={elapsed}
        failed={failed}
        onRetry={() => setRetryKey(k => k + 1)}  // remount hook to restart ping
      />
    );
  }

  return children;
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      {/* Landing — no sidebar, no wake gate */}
      <Route path="/" element={<LandingPage />} />

      {/* All dashboard pages — gated behind WakeGate */}
      <Route path="/dashboard"  element={<WakeGate><AppWrapper Component={Dashboard} /></WakeGate>} />
      <Route path="/trades"     element={<WakeGate><AppWrapper Component={TradePage} /></WakeGate>} />
      <Route path="/indicators" element={<WakeGate><AppWrapper Component={IndicatorsPage} /></WakeGate>} />
      <Route path="/psychology" element={<WakeGate><AppWrapper Component={PsychPage} /></WakeGate>} />
      <Route path="/market"     element={<WakeGate><AppWrapper Component={MarketPage} /></WakeGate>} />
      <Route path="/explainer"  element={<WakeGate><AppWrapper Component={ExplainerPage} /></WakeGate>} />
      <Route path="/drawdown"   element={<WakeGate><AppWrapper Component={DrawdownPage} /></WakeGate>} />
      <Route path="/backtest"   element={<WakeGate><AppWrapper Component={BacktestPage} /></WakeGate>} />
      <Route path="/simulator"  element={<WakeGate><AppWrapper Component={SimulatorPage} /></WakeGate>} />
      <Route path="/risk"       element={<WakeGate><AppWrapper Component={RiskPage} /></WakeGate>} />
      <Route path="/heatmap"    element={<WakeGate><AppWrapper Component={HeatmapPage} /></WakeGate>} />
      <Route path="/screener"   element={<WakeGate><AppWrapper Component={ScreenerPage} /></WakeGate>} />
      <Route path="/news"       element={<WakeGate><AppWrapper Component={NewsPage} /></WakeGate>} />
      <Route path="/clients"    element={<WakeGate><AppWrapper Component={ClientsPage} /></WakeGate>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}