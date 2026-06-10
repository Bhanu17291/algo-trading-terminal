cimport { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "./components/shared/PageLayout";

// Landing — no layout wrapper
import LandingPage    from "./components/pages/LandingPage";

// All dashboard pages — rendered inside LegacyWrapper which provides PageLayout + data
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

// ALL dashboard pages go through this wrapper
// It provides: PageLayout (single sidebar+topbar) + fetched data as props
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

  useEffect(() => {
    async function load() {
      const [sig, st, p, port, psy, ind, tr, sh] = await Promise.allSettled([
        fetch(`${API}/signal`).then(r => r.json()),
        fetch(`${API}/stats`).then(r => r.json()),
        fetch(`${API}/pnl`).then(r => r.json()),
        fetch(`${API}/portfolio`).then(r => r.json()),
        fetch(`${API}/psychology`).then(r => r.json()),
        fetch(`${API}/indicators`).then(r => r.json()),
        fetch(`${API}/trades`).then(r => r.json()),
        fetch(`${API}/shap`).then(r => r.json()),
      ]);
      if (sig.status  === "fulfilled") setSignal(sig.value);
      if (st.status   === "fulfilled") setStats(st.value);
      if (p.status    === "fulfilled") setPnl(p.value);
      if (port.status === "fulfilled") setPortfolio(port.value);
      if (psy.status  === "fulfilled") setPsych(psy.value);
      if (ind.status  === "fulfilled") setIndicators(ind.value);
      if (tr.status   === "fulfilled") setTrades(tr.value);
      if (sh.status   === "fulfilled") setShap(sh.value);
      setLoading(false);
      try {
        const cmp = await fetch(`${API}/clients/compare`).then(r => r.json());
        setCompare(cmp);
      } catch {}
    }
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const props = {
    signal, stats, pnl, portfolio, psych, indicators, trades, shap, compare,
    onBack: () => navigate("/"),
    setPage: (pg) => navigate(`/${pg}`),
  };

  return (
    <PageLayout>
      {loading ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "60px 0", color: "rgba(231,240,234,0.4)",
          fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
        }}>
          <div style={{
            width: 14, height: 14,
            border: "2px solid #22C55E", borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
          }} />
          Loading data...
        </div>
      ) : (
        <Component {...props} />
      )}
    </PageLayout>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Landing — no sidebar */}
      <Route path="/"           element={<LandingPage />} />

      {/* All dashboard pages — single PageLayout via AppWrapper */}
      <Route path="/dashboard"  element={<AppWrapper Component={Dashboard} />} />
      <Route path="/trades"     element={<AppWrapper Component={TradePage} />} />
      <Route path="/indicators" element={<AppWrapper Component={IndicatorsPage} />} />
      <Route path="/psychology" element={<AppWrapper Component={PsychPage} />} />
      <Route path="/market"     element={<AppWrapper Component={MarketPage} />} />
      <Route path="/explainer"  element={<AppWrapper Component={ExplainerPage} />} />
      <Route path="/drawdown"   element={<AppWrapper Component={DrawdownPage} />} />
      <Route path="/backtest"   element={<AppWrapper Component={BacktestPage} />} />
      <Route path="/simulator"  element={<AppWrapper Component={SimulatorPage} />} />
      <Route path="/risk"       element={<AppWrapper Component={RiskPage} />} />
      <Route path="/heatmap"    element={<AppWrapper Component={HeatmapPage} />} />
      <Route path="/screener"   element={<AppWrapper Component={ScreenerPage} />} />
      <Route path="/news"       element={<AppWrapper Component={NewsPage} />} />
      <Route path="/clients"    element={<AppWrapper Component={ClientsPage} />} />

      {/* Catch-all */}
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}