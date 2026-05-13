const mono = "'Courier New', monospace"

const ALL_NAV = [
  { id: "dashboard",  icon: "▦",  label: "DASHBOARD" },
  { id: "trades",     icon: "⇄",  label: "TRADE LOG" },
  { id: "indicators", icon: "◈",  label: "INDICATORS" },
  { id: "psychology", icon: "🧠", label: "PSYCHOLOGY" },
  { id: "market",     icon: "◉",  label: "MKT STATUS" },
  { id: "explainer",  icon: "⬡",  label: "ML EXPLAIN" },
  { id: "drawdown",   icon: "↘",  label: "DRAWDOWN" },
  { id: "backtest",   icon: "⟳",  label: "BACKTEST" },
  { id: "simulator",  icon: "◎",  label: "SIMULATOR" },
  { id: "risk",       icon: "⚠",  label: "RISK CALC" },
  { id: "heatmap",    icon: "▦",  label: "HEATMAP" },
  { id: "screener",   icon: "◐",  label: "SCREENER" },
  { id: "news",       icon: "📰", label: "NEWS" },
  { id: "clients",    icon: "⚖",  label: "CLIENTS" },
]

// Section groups — keyed by entry section from landing page
const SECTION_GROUPS = {
  signal: {
    label: "⚡ SIGNAL MODULE",
    color: "#00ff41",
    ids: ["explainer", "indicators", "screener", "market"],
  },
  portfolio: {
    label: "📈 PORTFOLIO MODULE",
    color: "#00aaff",
    ids: ["dashboard", "trades", "drawdown", "heatmap", "backtest", "simulator"],
  },
  clients: {
    label: "👥 CLIENTS MODULE",
    color: "#cc44ff",
    ids: ["clients", "psychology", "risk", "simulator"],
  },
  ml: {
    label: "🧠 ML MODULE",
    color: "#ffd700",
    ids: ["explainer", "indicators", "screener"],
  },
  risk: {
    label: "🛡 RISK MODULE",
    color: "#ff6600",
    ids: ["risk", "backtest", "simulator", "drawdown"],
  },
}

const navById = Object.fromEntries(ALL_NAV.map(n => [n.id, n]))

export default function Sidebar({ page, setPage, section, onHome }) {
  const group = SECTION_GROUPS[section] || SECTION_GROUPS["portfolio"]
  const navItems = group.ids.map(id => navById[id]).filter(Boolean)

  return (
    <div
      className="flex flex-col bg-base-200 border-r border-base-300 min-h-full"
      style={{ width: 185, flexShrink: 0 }}
    >
      {/* Section label */}
      <div style={{
        padding: "10px 14px 8px",
        fontSize: 9,
        color: group.color,
        fontFamily: mono,
        letterSpacing: 3,
        borderBottom: "1px solid #1a1a1a",
      }}>
        {group.label}
      </div>

      {/* Nav items */}
      <ul className="menu menu-md p-2 gap-0.5 flex-1">
        {navItems.map(({ id, icon, label }) => (
          <li key={id}>
            <a
              onClick={() => setPage(id)}
              className={page === id ? "active" : ""}
              style={{
                fontFamily: mono,
                fontSize: 13,
                letterSpacing: 0.5,
                borderLeft: page === id ? `3px solid ${group.color}` : "3px solid transparent",
                color: page === id ? group.color : undefined,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* HOME button */}
      <div
        onClick={onHome}
        style={{
          padding: "10px 14px",
          borderTop: "1px solid #1a1a1a",
          fontSize: 10,
          color: "#ff6600",
          fontFamily: mono,
          letterSpacing: 2,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#ff660011"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        ← HOME
      </div>

      {/* Auto refresh badge */}
      <div className="p-3 border-t border-base-300">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 3 }}>AUTO REFRESH</div>
        <div className="badge badge-warning" style={{ fontFamily: mono, fontSize: 12 }}>30s</div>
      </div>
    </div>
  )
}