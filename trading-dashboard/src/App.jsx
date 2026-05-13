import { useState, useEffect } from "react"
import LandingPage from "./components/pages/LandingPage"
import TopBar from "./components/layout/TopBar"
import Sidebar from "./components/layout/Sidebar"
import Dashboard from "./components/pages/Dashboard"
import TradePage from "./components/pages/TradePage"
import IndicatorsPage from "./components/pages/IndicatorsPage"
import PsychPage from "./components/pages/PsychPage"
import MarketPage from "./components/pages/MarketPage"
import ExplainerPage from "./components/pages/ExplainerPage"
import DrawdownPage from "./components/pages/DrawdownPage"
import BacktestPage from "./components/pages/BacktestPage"
import SimulatorPage from "./components/pages/SimulatorPage"
import RiskPage from "./components/pages/RiskPage"
import HeatmapPage from "./components/pages/HeatmapPage"
import ScreenerPage from "./components/pages/ScreenerPage"
import NewsPage from "./components/pages/NewsPage"
import ClientsPage from "./components/pages/ClientsPage"

const API = "https://algo-trading-terminal.onrender.com"

// Maps landing card ID → first page to open
const CARD_PAGE_MAP = {
  signal:    "explainer",   // Signal Intelligence → ML Explainer
  portfolio: "dashboard",   // Portfolio Engine    → Dashboard
  clients:   "clients",     // Dual Client Engine  → Clients
  ml:        "explainer",   // ML Intelligence     → ML Explainer
  risk:      "risk",        // Risk & Backtest     → Risk Calc
}

// Maps landing card ID → which section the sidebar should show
const CARD_SECTION_MAP = {
  signal:    "signal",
  portfolio: "portfolio",
  clients:   "clients",
  ml:        "ml",
  risk:      "risk",
}

export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [page, setPage]               = useState("dashboard")
  const [section, setSection]         = useState("portfolio") // tracks which landing card was clicked
  const [time, setTime]               = useState("")
  const [signal, setSignal]           = useState(null)
  const [stats, setStats]             = useState(null)
  const [pnl, setPnl]                 = useState(null)
  const [portfolio, setPortfolio]     = useState([])
  const [psych, setPsych]             = useState(null)
  const [indicators, setIndicators]   = useState([])
  const [trades, setTrades]           = useState([])
  const [shap, setShap]               = useState(null)
  const [compare, setCompare]         = useState(null)
  const [loading, setLoading]         = useState(true)

  // Expose setPage globally for legacy usage
  useEffect(() => { window.__setPage = setPage }, [setPage])

  // IST clock
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Kolkata"
      }) + " IST")
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  const fetchAll = async () => {
    try {
      const [sigRes, statsRes, pnlRes, portRes, psychRes, indRes, tradesRes, shapRes] = await Promise.allSettled([
        fetch(`${API}/signal`).then(r => r.json()),
        fetch(`${API}/stats`).then(r => r.json()),
        fetch(`${API}/pnl`).then(r => r.json()),
        fetch(`${API}/portfolio`).then(r => r.json()),
        fetch(`${API}/psychology`).then(r => r.json()),
        fetch(`${API}/indicators`).then(r => r.json()),
        fetch(`${API}/trades`).then(r => r.json()),
        fetch(`${API}/shap`).then(r => r.json()),
      ])
      if (sigRes.status === "fulfilled")    setSignal(sigRes.value)
      if (statsRes.status === "fulfilled")  setStats(statsRes.value)
      if (pnlRes.status === "fulfilled")    setPnl(pnlRes.value)
      if (portRes.status === "fulfilled")   setPortfolio(portRes.value)
      if (psychRes.status === "fulfilled")  setPsych(psychRes.value)
      if (indRes.status === "fulfilled")    setIndicators(indRes.value)
      if (tradesRes.status === "fulfilled") setTrades(tradesRes.value)
      if (shapRes.status === "fulfilled")   setShap(shapRes.value)
    } catch (e) {
      console.error("Fetch error:", e)
    } finally {
      setLoading(false)
    }
    try {
      const compareRes = await fetch(`${API}/clients/compare`).then(r => r.json())
      setCompare(compareRes)
    } catch (e) {
      console.error("Compare fetch error:", e)
    }
  }

  useEffect(() => {
    fetchAll()
    const i = setInterval(fetchAll, 30000)
    return () => clearInterval(i)
  }, [])

  // Called from LandingPage card clicks & bottom nav
  const handleEnter = (destination) => {
    const targetPage    = CARD_PAGE_MAP[destination] || destination
    const targetSection = CARD_SECTION_MAP[destination] || "portfolio"
    setPage(targetPage)
    setSection(targetSection)
    setShowLanding(false)
  }

  const goHome = () => setShowLanding(true)

  if (showLanding) {
    return (
      <LandingPage
        onEnter={handleEnter}
        signal={signal}
        stats={stats}
        compare={compare}
      />
    )
  }

  const pageProps = {
    signal, stats, pnl, portfolio, psych, indicators, trades, shap, compare,
    onBack: goHome,
    setPage,
  }

  const renderPage = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ minHeight: 400 }}>
        <span className="loading loading-bars loading-lg" style={{ color: "#ff6600" }}></span>
        <span style={{ fontFamily: "'Courier New', monospace", color: "#666", fontSize: 13 }}>
          CONNECTING TO ALGO ENGINE...
        </span>
      </div>
    )
    switch (page) {
      case "dashboard":  return <Dashboard     {...pageProps} />
      case "trades":     return <TradePage     {...pageProps} />
      case "indicators": return <IndicatorsPage {...pageProps} />
      case "psychology": return <PsychPage     {...pageProps} />
      case "market":     return <MarketPage    {...pageProps} />
      case "explainer":  return <ExplainerPage {...pageProps} />
      case "drawdown":   return <DrawdownPage  {...pageProps} />
      case "backtest":   return <BacktestPage  {...pageProps} />
      case "simulator":  return <SimulatorPage {...pageProps} />
      case "risk":       return <RiskPage      {...pageProps} />
      case "heatmap":    return <HeatmapPage   {...pageProps} />
      case "screener":   return <ScreenerPage  {...pageProps} />
      case "news":       return <NewsPage      {...pageProps} />
      case "clients":    return <ClientsPage   {...pageProps} />
      default:           return <Dashboard     {...pageProps} />
    }
  }

  return (
    <div data-theme="dark" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
      <TopBar
        signal={signal}
        stats={stats}
        time={time}
        onLogoClick={goHome}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          page={page}
          setPage={setPage}
          section={section}
          onHome={goHome}
        />
        <main style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {renderPage()}
        </main>
      </div>
    </div>
  )
}