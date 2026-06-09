import { useState, useEffect } from "react"
import Panel from "../shared/Panel"
import BackButton from "../layout/BackButton"
import { fetchJson } from "../../config/api"

const mono = "'Courier New', monospace"

export default function MarketPage({ onBack }) {
  const [status, setStatus] = useState(null)
  const [log, setLog] = useState([])

  useEffect(() => {
    const fetch_market = async () => {
      try {
        const [s, l] = await Promise.all([
          fetchJson("/market-status"),
          fetchJson("/live-log"),
        ])
        setStatus(s)
        setLog(l)
      } catch (e) { console.error(e) }
    }
    fetch_market()
    const i = setInterval(fetch_market, 10000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <BackButton onBack={onBack} />

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="MARKET STATUS" accent={status?.is_open ? "#00ff41" : "#ff3131"}>
          <div className="flex flex-col items-center gap-3 py-4">
            <div style={{ fontSize: 64 }}>{status?.is_open ? "🟢" : "🔴"}</div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: mono, color: status?.is_open ? "#00ff41" : "#ff3131" }}>
              MARKET {status?.status}
            </div>
            <div className="badge badge-lg badge-outline" style={{ fontFamily: mono }}>
              IST: {status?.current_time_ist}
            </div>
            <div style={{ fontSize: 12, color: "#666", fontFamily: mono }}>
              Trading hours: 09:15 – 15:30 IST · Mon–Fri
            </div>
          </div>
        </Panel>

        <Panel title="TRADING LOOP INFO">
          <div className="flex flex-col gap-3">
            {[
              ["SCHEDULER", "APScheduler", "#00ff41"],
              ["INTERVAL", "Every 1 minute", "#cccccc"],
              ["MARKET HOURS", "09:15 – 15:30 IST", "#cccccc"],
              ["TRADING DAYS", "Monday – Friday", "#cccccc"],
              ["CURRENT STATUS", status?.is_open ? "ACTIVE" : "STANDBY", status?.is_open ? "#00ff41" : "#ffd700"],
            ].map(([l, v, c]) => (
              <div key={l} className="flex justify-between items-center border-b border-base-300 pb-2">
                <span style={{ fontSize: 12, color: "#666", fontFamily: mono }}>{l}</span>
                <span className="badge badge-outline" style={{ color: c, borderColor: c, fontFamily: mono, fontSize: 11 }}>{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Live Log */}
      <Panel title="LIVE TRADING LOG — Updates every 10s · Only fires during market hours">
        {log.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div style={{ fontSize: 40 }}>⏳</div>
            <div style={{ fontFamily: mono, fontSize: 13, color: "#666", textAlign: "center" }}>
              Market is closed. Live log will populate during trading hours (09:15–15:30 IST).
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {log.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded bg-base-300"
                style={{ borderLeft: `3px solid ${entry.action === "BUY" ? "#00ff41" : entry.action === "SELL" ? "#ff3131" : "#666"}` }}>
                <span style={{ color: "#666", fontFamily: mono, fontSize: 11 }}>[{entry.time}]</span>
                <div className={`badge badge-sm ${entry.action === "BUY" ? "badge-success" : entry.action === "SELL" ? "badge-error" : "badge-warning"}`}>
                  {entry.action}
                </div>
                <span style={{ color: "#ccc", fontFamily: mono, fontSize: 11 }}>
                  p={entry.confidence} · ₹{entry.price?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
