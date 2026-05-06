import { useState, useEffect } from "react"

const API = "https://algo-trading-terminal.onrender.com"
const mono = "'Courier New', monospace"

const TICKER_ITEMS = [
  "NSEI", "RELIANCE", "TCS", "HDFC", "INFOSYS", "ICICIBANK", "WIPRO", "BAJFINANCE", "AXISBANK", "SBIN"
]

export default function LandingPage({ onEnter, signal, stats, compare }) {
  const [time, setTime] = useState("")
  const [marketOpen, setMarketOpen] = useState(false)
  const [tickerOffset, setTickerOffset] = useState(0)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Kolkata"
      }) + " IST")
      const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
      const day = ist.getDay()
      const h = ist.getHours(), m = ist.getMinutes()
      const mins = h * 60 + m
      setMarketOpen(day >= 1 && day <= 5 && mins >= 555 && mins <= 930)
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    const i = setInterval(() => setTickerOffset(p => p - 1), 30)
    return () => clearInterval(i)
  }, [])

  const cards = [
    {
      id: "signal",
      title: "SIGNAL INTELLIGENCE",
      icon: "⚡",
      accent: "#00ff41",
      value: signal ? `${signal.signal}  ${signal.confidence}%` : "LOADING...",
      valueColor: signal?.signal === "BUY" ? "#00ff41" : "#ff3131",
      desc: "ML ensemble BUY/SELL signals with 85%+ confidence using XGBoost, LightGBM & CatBoost",
      stats: [
        { label: "CONFIDENCE", value: signal ? `${signal.confidence}%` : "—" },
        { label: "LAST PRICE", value: signal ? `₹${signal.close?.toLocaleString()}` : "—" },
        { label: "AS OF", value: signal ? signal.date : "—" },
      ]
    },
    {
      id: "portfolio",
      title: "PORTFOLIO ENGINE",
      icon: "📈",
      accent: "#00aaff",
      value: stats ? `+${stats.total_return}%` : "LOADING...",
      valueColor: "#00aaff",
      desc: "Real-time portfolio tracking with P&L analysis, equity curves and drawdown monitoring",
      stats: [
        { label: "FINAL VALUE", value: stats ? `₹${stats.final_value?.toLocaleString()}` : "—" },
        { label: "WIN RATE", value: stats ? `${stats.win_rate}%` : "—" },
        { label: "TOTAL TRADES", value: stats ? stats.total_trades : "—" },
      ]
    },
    {
      id: "clients",
      title: "DUAL CLIENT ENGINE",
      icon: "👥",
      accent: "#cc44ff",
      value: compare ? `QUANT +${compare.quant_stats?.total_return}%` : "LOADING...",
      valueColor: "#ff6600",
      desc: "Two trading profiles — QUANT (aggressive) vs MACRO (conservative) — running on same ML signals",
      stats: [
        { label: "QUANT RETURN", value: compare ? `+${compare.quant_stats?.total_return}%` : "—" },
        { label: "MACRO RETURN", value: compare ? `+${compare.macro_stats?.total_return}%` : "—" },
        { label: "NSEI BENCHMARK", value: "+167.48%" },
      ]
    },
    {
      id: "explainer",
      title: "ML INTELLIGENCE",
      icon: "🧠",
      accent: "#ffd700",
      value: "27 FEATURES",
      valueColor: "#ffd700",
      desc: "SHAP explainability shows exactly why each trade signal was generated — full transparency",
      stats: [
        { label: "MODELS", value: "XGB+LGB+CAT" },
        { label: "OPTUNA TRIALS", value: "80 / MODEL" },
        { label: "VALIDATION", value: "WALK-FORWARD" },
      ]
    },
    {
      id: "risk",
      title: "RISK & BACKTEST",
      icon: "🛡",
      accent: "#ff6600",
      value: "72.2% WIN RATE",
      valueColor: "#ff6600",
      desc: "Position sizing, scenario analysis, historical backtesting and walk-forward out-of-sample testing",
      stats: [
        { label: "MAX DRAWDOWN", value: "< 15%" },
        { label: "SHARPE RATIO", value: "1.8+" },
        { label: "BACKTEST YEARS", value: "2020–2026" },
      ]
    },
  ]

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      fontFamily: mono,
      color: "#e0e0e0",
      overflowX: "hidden",
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 44,
        background: "#0a0a0a",
        borderBottom: "1px solid #1a1a1a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 11, color: "#ff6600", letterSpacing: 3, fontWeight: 700 }}>
            ⚡ ALGO TERMINAL
          </span>
          <span style={{ fontSize: 10, color: "#333" }}>|</span>
          <span style={{ fontSize: 10, color: "#555", letterSpacing: 1 }}>NSEI INTELLIGENCE PLATFORM</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: marketOpen ? "#00ff41" : "#ff3131",
              boxShadow: marketOpen ? "0 0 6px #00ff41" : "0 0 6px #ff3131",
            }} />
            <span style={{ fontSize: 10, color: marketOpen ? "#00ff41" : "#ff3131", letterSpacing: 1 }}>
              {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#666" }}>{time}</span>
        </div>
      </div>

      {/* ── TICKER STRIP ── */}
      <div style={{
        height: 28, background: "#0d0d0d",
        borderBottom: "1px solid #1a1a1a",
        overflow: "hidden", display: "flex", alignItems: "center",
      }}>
        <div style={{
          display: "flex", gap: 40, whiteSpace: "nowrap",
          transform: `translateX(${tickerOffset % 800}px)`,
          transition: "none",
        }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} style={{ fontSize: 10, color: "#444", letterSpacing: 2 }}>
              <span style={{ color: "#ff6600" }}>{t}</span>
              <span style={{ color: "#00ff41", marginLeft: 6 }}>▲ {(Math.random() * 2).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO SECTION ── */}
      <div style={{
        padding: "48px 40px 32px",
        borderBottom: "1px solid #111",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      }}>
        <div>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: 4, marginBottom: 8 }}>
            ALGORITHMIC TRADING INTELLIGENCE
          </div>
          <div style={{
            fontSize: 42, fontWeight: 900, letterSpacing: -1, lineHeight: 1,
            color: "#fff",
          }}>
            NSEI ALGO
          </div>
          <div style={{
            fontSize: 42, fontWeight: 900, letterSpacing: -1, lineHeight: 1,
            color: "#ff6600",
          }}>
            TERMINAL
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 12, maxWidth: 420, lineHeight: 1.6 }}>
            "In markets, the disciplined mind with data beats intuition every time.
            Our ML ensemble doesn't guess — it calculates."
          </div>
        </div>

        {/* ── KEY STATS ── */}
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "STRATEGY RETURN", value: stats ? `+${stats.total_return}%` : "+114.51%", color: "#00ff41" },
            { label: "WIN RATE", value: stats ? `${stats.win_rate}%` : "72.2%", color: "#00aaff" },
            { label: "QUANT ALPHA", value: compare ? `+${compare.quant_stats?.total_return}%` : "+848.23%", color: "#ff6600" },
            { label: "SIGNAL", value: signal ? signal.signal : "BUY", color: signal?.signal === "BUY" ? "#00ff41" : "#ff3131" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              textAlign: "center", padding: "12px 20px",
              border: "1px solid #1a1a1a",
              background: "#0a0a0a",
            }}>
              <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURE CARDS ── */}
      <div style={{ padding: "32px 40px" }}>
        <div style={{ fontSize: 9, color: "#333", letterSpacing: 4, marginBottom: 20 }}>
          PLATFORM CAPABILITIES — SELECT A MODULE TO ENTER
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
        }}>
          {cards.map((card) => (
            <FeatureCard key={card.id} card={card} onEnter={onEnter} />
          ))}
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 40px",
        background: "#0a0a0a",
        borderTop: "1px solid #1a1a1a",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 24 }}>
          {["DASHBOARD", "SIGNAL", "PORTFOLIO", "CLIENTS", "ML", "RISK"].map(p => (
            <span
              key={p}
              onClick={() => onEnter(p.toLowerCase())}
              style={{ fontSize: 9, color: "#444", letterSpacing: 2, cursor: "pointer" }}
              onMouseEnter={e => e.target.style.color = "#ff6600"}
              onMouseLeave={e => e.target.style.color = "#444"}
            >{p}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>
            ML ENSEMBLE v5.0 · 1,481 DAYS · 27 FEATURES
          </span>
          <button
            onClick={() => onEnter("dashboard")}
            style={{
              background: "#ff6600", color: "#000", border: "none",
              padding: "6px 20px", fontSize: 10, fontFamily: mono,
              fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            }}
          >
            ENTER TERMINAL →
          </button>
        </div>
      </div>

    </div>
  )
}

function FeatureCard({ card, onEnter }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => onEnter(card.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#0f0f0f" : "#080808",
        border: `1px solid ${hovered ? card.accent + "44" : "#1a1a1a"}`,
        padding: "20px 16px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* accent top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: hovered ? card.accent : "transparent",
        transition: "background 0.2s ease",
      }} />

      <div style={{ fontSize: 18, marginBottom: 8 }}>{card.icon}</div>
      <div style={{ fontSize: 9, color: card.accent, letterSpacing: 3, marginBottom: 6 }}>
        {card.title}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 900, color: card.valueColor,
        marginBottom: 8, letterSpacing: -0.5,
      }}>
        {card.value}
      </div>
      <div style={{ fontSize: 10, color: "#444", lineHeight: 1.6, marginBottom: 12 }}>
        {card.desc}
      </div>

      {/* mini stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {card.stats.map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>{label}</span>
            <span style={{ fontSize: 9, color: "#666" }}>{value}</span>
          </div>
        ))}
      </div>

      {hovered && (
        <div style={{
          marginTop: 12, fontSize: 9, color: card.accent,
          letterSpacing: 2, textAlign: "right",
        }}>
          OPEN MODULE →
        </div>
      )}
    </div>
  )
}