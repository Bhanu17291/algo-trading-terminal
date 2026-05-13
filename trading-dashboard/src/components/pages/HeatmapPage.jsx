import { useState } from "react"
import Panel from "../shared/Panel"
import BackButton from "../layout/BackButton"

const mono = "'Courier New', monospace"
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAYS   = ["Mon","Tue","Wed","Thu","Fri"]
const YEARS  = [2023, 2024, 2025, 2026]

function buildMonthlyPnl(trades) {
  const map = {}
  trades?.filter(t => t.action === "SELL").forEach(t => {
    const d   = new Date(t.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!map[key]) map[key] = { pnl: 0, count: 0, month: d.getMonth(), year: d.getFullYear() }
    map[key].pnl   += t.pnl
    map[key].count += 1
  })
  return map
}

function buildDayPnl(trades) {
  const map = { 0: [], 1: [], 2: [], 3: [], 4: [] }
  trades?.filter(t => t.action === "SELL").forEach(t => {
    const day = new Date(t.date).getDay()
    if (day >= 1 && day <= 5) map[day - 1].push(t.pnl)
  })
  return map
}

function HeatmapGrid({ monthlyPnl }) {
  const maxAbsPnl = Math.max(...Object.values(monthlyPnl).map(v => Math.abs(v.pnl)), 1)
  const getColor  = (pnl) => {
    if (!pnl) return "#1a1a1a"
    const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1)
    return pnl > 0
      ? `rgba(0,255,65,${0.15 + intensity * 0.75})`
      : `rgba(255,49,49,${0.15 + intensity * 0.75})`
  }
  return (
    <div className="overflow-x-auto">
      <table style={{ borderCollapse: "separate", borderSpacing: 4, fontFamily: mono }}>
        <thead>
          <tr>
            <th style={{ fontSize: 10, color: "#666", padding: "4px 8px" }}></th>
            {MONTHS.map(m => <th key={m} style={{ fontSize: 10, color: "#666", padding: "4px 8px", minWidth: 56 }}>{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {YEARS.map(year => (
            <tr key={year}>
              <td style={{ fontSize: 10, color: "#666", padding: "4px 8px", fontWeight: 700 }}>{year}</td>
              {MONTHS.map((_, mi) => {
                const cell = monthlyPnl[`${year}-${mi}`]
                return (
                  <td key={mi} style={{ padding: 2 }}>
                    <div className="tooltip" data-tip={cell ? `₹${cell.pnl.toLocaleString()} (${cell.count} trades)` : "No trades"}>
                      <div style={{ width: 52, height: 34, borderRadius: 4, background: getColor(cell?.pnl), border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {cell && <span style={{ fontSize: 9, color: "#fff", fontFamily: mono, fontWeight: 700 }}>
                          {cell.pnl > 0 ? "+" : ""}₹{Math.abs(cell.pnl / 1000).toFixed(1)}k
                        </span>}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DayBars({ dayPnl, color }) {
  return (
    <div className="flex flex-col gap-3">
      {DAYS.map((day, i) => {
        const pnls = dayPnl[i] || []
        const avg  = pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0
        const barW = Math.min((Math.abs(avg) / 5000) * 100, 100)
        const c    = avg >= 0 ? "#00ff41" : "#ff3131"
        return (
          <div key={day}>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 12, color: "#ccc", fontFamily: mono, width: 40 }}>{day}</span>
              <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>{pnls.length} trades</span>
              <span style={{ fontSize: 12, color: c, fontFamily: mono, fontWeight: 700 }}>
                {avg >= 0 ? "+" : ""}₹{Math.round(avg).toLocaleString()}
              </span>
            </div>
            <div className="w-full rounded overflow-hidden" style={{ height: 8, background: "#1a1a1a" }}>
              <div style={{ width: `${barW}%`, height: "100%", background: color || c }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function HeatmapPage({ trades, compare, onBack }) {
  const [tab, setTab] = useState("STRATEGY")

  const tabTrades = {
    STRATEGY: trades,
    QUANT:    compare?.quant_trades,
    MACRO:    compare?.macro_trades,
  }

  const tabColor  = { STRATEGY: "#ff3131", QUANT: "#ff6600", MACRO: "#00aaff" }
  const current   = tabTrades[tab] || []
  const monthly   = buildMonthlyPnl(current)
  const dayPnl    = buildDayPnl(current)
  const color     = tabColor[tab]

  return (
    <div className="flex flex-col gap-3">

      <BackButton onBack={onBack} />

      {/* Tab switcher */}
      <div className="join">
        {["STRATEGY", "QUANT", "MACRO"].map(t => (
          <button key={t}
            className={`btn btn-sm join-item ${tab === t ? "" : "btn-outline"}`}
            style={{ fontFamily: mono, background: tab === t ? tabColor[t] : "transparent",
              color: tab === t ? "#000" : tabColor[t], borderColor: tabColor[t] }}
            onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Heatmap grid */}
      <Panel title={`MONTHLY PnL HEATMAP — ${tab}`} accent={color}>
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 12 }}>
          Intensity = magnitude · Green = profit · Red = loss
        </div>
        <HeatmapGrid monthlyPnl={monthly} />
      </Panel>

      {/* Day of week */}
      <Panel title={`DAY OF WEEK PERFORMANCE — ${tab}`} accent={color}>
        <DayBars dayPnl={dayPnl} color={color} />
      </Panel>

    </div>
  )
}