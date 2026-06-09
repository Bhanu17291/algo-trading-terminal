import { Routes, Route, Navigate } from "react-router-dom";

// All paths relative to src/ (where this file lives)
import LandingPage    from "./components/pages/LandingPage";
import Dashboard      from "./components/pages/Dashboard";
import DrawdownPage   from "./components/pages/DrawdownPage";
import ExplainerPage  from "./components/pages/ExplainerPage";
import HeatmapPage    from "./components/pages/HeatmapPage";
import IndicatorsPage from "./components/pages/IndicatorsPage";
import MarketPage     from "./components/pages/MarketPage";
import NewsPage       from "./components/pages/NewsPage";
import PsychPage      from "./components/pages/PsychPage";
import RiskPage       from "./components/pages/RiskPage";
import ScreenerPage   from "./components/pages/ScreenerPage";
import SimulatorPage  from "./components/pages/SimulatorPage";
import TradePage      from "./components/pages/TradePage";
import ClientsPage    from "./components/pages/ClientsPage";
import BacktestPage   from "./components/pages/BacktestPage";

export default function App() {
  return (
    <Routes>
      <Route path="/"           element={<LandingPage />} />
      <Route path="/dashboard"  element={<Dashboard />} />
      <Route path="/trades"     element={<TradePage />} />
      <Route path="/indicators" element={<IndicatorsPage />} />
      <Route path="/psychology" element={<PsychPage />} />
      <Route path="/market"     element={<MarketPage />} />
      <Route path="/explainer"  element={<ExplainerPage />} />
      <Route path="/drawdown"   element={<DrawdownPage />} />
      <Route path="/backtest"   element={<BacktestPage />} />
      <Route path="/simulator"  element={<SimulatorPage />} />
      <Route path="/risk"       element={<RiskPage />} />
      <Route path="/heatmap"    element={<HeatmapPage />} />
      <Route path="/screener"   element={<ScreenerPage />} />
      <Route path="/news"       element={<NewsPage />} />
      <Route path="/clients"    element={<ClientsPage />} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}