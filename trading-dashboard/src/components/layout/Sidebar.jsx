const mono = "'Courier New', monospace"

const NAV = [
  { id: "dashboard",  icon: "▦", label: "DASHBOARD" },
  { id: "trades",     icon: "⇄", label: "TRADE LOG" },
  { id: "indicators", icon: "◈", label: "INDICATORS" },
  { id: "psychology", icon: "🧠", label: "PSYCHOLOGY" },
  { id: "market",     icon: "◉", label: "MKT STATUS" },
  { id: "explainer",  icon: "⬡", label: "ML EXPLAIN" },
  { id: "drawdown",   icon: "↘", label: "DRAWDOWN" },
  { id: "backtest",   icon: "⟳", label: "BACKTEST" },
  { id: "simulator",  icon: "◎", label: "SIMULATOR" },
  { id: "risk",       icon: "⚠", label: "RISK CALC" },
  { id: "heatmap",    icon: "▦", label: "HEATMAP" },
  { id: "screener",   icon: "◐", label: "SCREENER" },
  { id: "news",       icon: "📰", label: "NEWS" },
  { id: "clients", icon: "⚖", label: "CLIENTS" },
]

export default function Sidebar({ page, setPage }) {
  return (
    <div className="flex flex-col bg-base-200 border-r border-base-300 min-h-full"
      style={{ width: 185, flexShrink: 0 }}>

      <ul className="menu menu-md p-2 gap-0.5 flex-1">
        {NAV.map(({ id, icon, label }) => (
          <li key={id}>
            <a onClick={() => setPage(id)}
              className={page === id ? "active" : ""}
              style={{
                fontFamily: mono, fontSize: 13, letterSpacing: 0.5,
                borderLeft: page === id ? "3px solid #ff6600" : "3px solid transparent",
                color: page === id ? "#ff6600" : undefined,
                cursor: "pointer"
              }}>
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="p-3 border-t border-base-300">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 3 }}>AUTO REFRESH</div>
        <div className="badge badge-warning" style={{ fontFamily: mono, fontSize: 12 }}>30s</div>
      </div>
    </div>
  )
}