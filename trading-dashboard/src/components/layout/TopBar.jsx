const mono = "'Courier New', monospace"

export default function TopBar({ signal, stats, time, onLogoClick }) {
  const sigColor =
    signal?.signal === "BUY"  ? "#00ff41" :
    signal?.signal === "SELL" ? "#ff3131" : "#ffd700"

  return (
    <div
      className="navbar bg-base-200 border-b-2 px-6 min-h-0 py-3"
      style={{ borderColor: "#ff6600" }}
    >
      <div className="navbar-start gap-3" style={{ alignItems: "center" }}>
        {/* Logo — click to go home */}
        <button
          onClick={onLogoClick}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          title="Back to Home"
        >
          <span style={{
            color: "#ff6600",
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: 2,
          }}>
            ⚡ NSEI ALGO TERMINAL
          </span>
        </button>

        <div className="badge badge-success gap-1" style={{ fontSize: 12 }}>● LIVE</div>

        {/* Explicit HOME button */}
        <button
          onClick={onLogoClick}
          style={{
            background: "transparent",
            border: "1px solid #333",
            color: "#888",
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: 2,
            padding: "3px 10px",
            cursor: "pointer",
            marginLeft: 8,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "#ff6600"
            e.currentTarget.style.color = "#ff6600"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "#333"
            e.currentTarget.style.color = "#888"
          }}
        >
          ← HOME
        </button>
      </div>

      <div className="navbar-end gap-6" style={{ fontFamily: mono, fontSize: 14 }}>
        {signal && (
          <div
            className="badge badge-outline badge-lg"
            style={{ color: sigColor, borderColor: sigColor, fontWeight: 700, fontSize: 13 }}
          >
            SIG: {signal.signal} ({signal.confidence}%)
          </div>
        )}
        {stats && (
          <>
            <span className="text-base-content/60">
              RTN: <span style={{ color: "#00ff41" }}>+{stats.total_return}%</span>
            </span>
            <span className="text-base-content/60">
              WIN: <span style={{ color: "#00ff41" }}>{stats.win_rate}%</span>
            </span>
            <span className="text-base-content/60">
              TRADES: <span className="text-white">{stats.total_trades}</span>
            </span>
          </>
        )}
        <span className="text-base-content/40">{time}</span>
      </div>
    </div>
  )
}