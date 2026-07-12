/**
 * src/App.jsx
 *
 * Changes vs original:
 *  1. useBackendWake() — gates ALL data fetching behind a health-check ping
 *  2. WakeScreen — shown while backend cold-starts, with progress + retry
 *  3. fetchWithRetry — 3-attempt retry with 2 s delay for every API call
 *  4. Consolidated 9 separate pages into 4 tabbed pages (Signal & Model,
 *     Performance Lab, Market Scanner, Risk & Psychology) — see PageLayout.jsx
 *     for the updated 6-item sidebar. Retired the standalone Market page
 *     since its content (NSEI open/closed + IST clock) is already shown
 *     live in the top bar.
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
import ClientsPage    from "./components/pages/ClientsPage";
import OnboardingQuestionnaire from "./components/pages/OnboardingQuestionnaire";
import StrategiesPage from "./components/pages/StrategiesPage";

// Merged tabbed pages (each internally imports its constituent sub-pages)
import SignalModelPage      from "./components/pages/SignalModelPage";
import PerformanceLabPage   from "./components/pages/PerformanceLabPage";
import MarketScannerPage    from "./components/pages/MarketScannerPage";
import RiskPsychologyPage   from "./components/pages/RiskPsychologyPage";

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

      {/* Onboarding questionnaire — no wake gate, no backend calls, just a form */}
      <Route path="/onboarding" element={<OnboardingQuestionnaire />} />

      {/* Strategies page — needs the backend (WakeGate), but manages its own
          fetch rather than going through AppWrapper's shared data-loading */}
      <Route path="/strategies" element={<WakeGate><StrategiesPage /></WakeGate>} />

      {/* Core pages */}
      <Route path="/dashboard"  element={<WakeGate><AppWrapper Component={Dashboard} /></WakeGate>} />
      <Route path="/trades"     element={<WakeGate><AppWrapper Component={TradePage} /></WakeGate>} />
      <Route path="/clients"    element={<WakeGate><AppWrapper Component={ClientsPage} /></WakeGate>} />

      {/* Consolidated tabbed pages — replace the old 9 separate routes:
          /signal-model    = Indicators + ML Explain
          /performance-lab = Backtest + Drawdown + Simulator
          /market-scanner  = Heatmap + Screener + News
          /risk-psychology = Risk Calc + Psychology
          (old /market route retired — its content is already in the top bar) */}
      <Route path="/signal-model"    element={<WakeGate><AppWrapper Component={SignalModelPage} /></WakeGate>} />
      <Route path="/performance-lab" element={<WakeGate><AppWrapper Component={PerformanceLabPage} /></WakeGate>} />
      <Route path="/market-scanner"  element={<WakeGate><AppWrapper Component={MarketScannerPage} /></WakeGate>} />
      <Route path="/risk-psychology" element={<WakeGate><AppWrapper Component={RiskPsychologyPage} /></WakeGate>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}