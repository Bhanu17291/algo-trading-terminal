import { XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar } from "recharts"
import Panel from "../shared/Panel"
import BackButton from "../layout/BackButton"
import ChartTooltip from "../shared/ChartTooltip"

const mono = "'Courier New', monospace"

function calcDrawdown(portfolioArr) {
  let peak = 0
  return (portfolioArr || []).map(row => {
    const val = Number(row.value) || 0
    if (val > peak) peak = val
    const dd = peak > 0 ? parseFloat(((val - peak) / peak * 100).toFixed(2)) : 0
    return { date: row.date?.slice(2, 7), drawdown: dd, value: val }
  })
}

function safeMin(arr) {
  if (!arr || arr.length === 0) return 0
  const vals = arr.map(d => d.drawdown).filter(v => isFinite(v))
  return vals.length ? Math.min(...vals) : 0
}

function safeWorstLoss(trades) {
  if (!trades || trades.length === 0) return 0
  const losses = trades.map(t => Number(t.pnl)).filter(v => isFinite(v))
  return losses.length ? Math.min(...losses) : 0
}

export default function DrawdownPage({ portfolio, trades, compare, onBack }) {
  const strategyDD = calcDrawdown(portfolio)
  const quantDD    = calcDrawdown(compare?.quant_portfolio)
  const macroDD    = calcDrawdown(compare?.macro_portfolio)

  const combinedDD = strategyDD.map((row, i) => ({
    date:     row.date,
    STRATEGY: row.drawdown,
    QUANT:    quantDD[i]?.drawdown ?? null,
    MACRO:    macroDD[i]?.drawdown ?? null,
  })).filter((_, i) => i % 3 === 0)

  const minStrategy = safeMin(strategyDD)
  const minQuant    = safeMin(quantDD)
  const minMacro    = safeMin(macroDD)

  const sells      = (trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0)
  const quantSells = (compare?.quant_trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0)
  const macroSells = (compare?.macro_trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0)

  const fmt = v => isFinite(v) && v !== 0 ? `₹${Number(v).toLocaleString()}` : "₹0"

  const summaryRows = [
    ["MAX DRAWDOWN",  `${minStrategy.toFixed(2)}%`, `${minQuant.toFixed(2)}%`, `${minMacro.toFixed(2)}%`, "#ff3131"],
    ["LOSING TRADES", sells.length,                  quantSells.length,         macroSells.length,         "#cc44ff"],
    ["WORST LOSS",    fmt(safeWorstLoss(sells)),      fmt(safeWorstLoss(quantSells)), fmt(safeWorstLoss(macroSells)), "#ff3131"],
  ]

  return (
    <div className="flex flex-col gap-3">
      <BackButton onBack={onBack} />

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["STRATEGY MAX DD", `${minStrategy.toFixed(2)}%`, "#ff3131"],
          ["QUANT MAX DD",    `${minQuant.toFixed(2)}%`,    "#ff6600"],
          ["MACRO MAX DD",    `${minMacro.toFixed(2)}%`,    "#00aaff"],
        ].map(([l, v, c]) => (
          <div key={l} className="stat bg-base-200 rounded-box border border-base-300"
            style={{ borderTop: `2px solid ${c}` }}>
            <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>{l}</div>
            <div className="stat-value" style={{ color: c, fontFamily: mono, fontSize: 26 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Combined drawdown chart */}
      <Panel title="DRAWDOWN COMPARISON — STRATEGY vs QUANT vs MACRO" accent="#ff3131">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 10 }}>
          All three shown as % decline from their respective all-time peaks
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={combinedDD}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
            <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `${v}%`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0}  stroke="#333" strokeDasharray="4 4" />
            <ReferenceLine y={-5} stroke="#ff3131" strokeDasharray="2 2"
              label={{ value: "-5% DANGER", fill: "#ff3131", fontSize: 9 }} />
            <Legend wrapperStyle={{ fontFamily: mono, fontSize: 11 }} />
            <Line type="monotone" dataKey="STRATEGY" stroke="#ff3131" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="QUANT"    stroke="#ff6600" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="MACRO"    stroke="#00aaff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Comparison table */}
      <Panel title="DRAWDOWN ANALYSIS — SIDE BY SIDE" accent="#ff3131">
        <div className="overflow-x-auto">
          <table className="table table-sm" style={{ fontFamily: mono }}>
            <thead>
              <tr style={{ fontSize: 11, letterSpacing: 1 }}>
                <th style={{ color: "#666" }}>METRIC</th>
                <th style={{ color: "#ff3131" }}>STRATEGY</th>
                <th style={{ color: "#ff6600" }}>QUANT</th>
                <th style={{ color: "#00aaff" }}>MACRO</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(([label, s, q, m, c]) => (
                <tr key={label} className="hover">
                  <td style={{ color: "#666", fontSize: 12 }}>{label}</td>
                  <td style={{ color: c, fontWeight: 700, fontSize: 12 }}>{s}</td>
                  <td style={{ color: c, fontWeight: 700, fontSize: 12 }}>{q}</td>
                  <td style={{ color: c, fontWeight: 700, fontSize: 12 }}>{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Individual losing trade bars */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="QUANT — LOSING TRADES" accent="#ff6600">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={quantSells.map((t, i) => ({ trade: i + 1, loss: Number(t.pnl) }))}>
              <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(1)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#444" />
              <Bar dataKey="loss" name="Loss" fill="#ff6600" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="MACRO — LOSING TRADES" accent="#00aaff">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={macroSells.map((t, i) => ({ trade: i + 1, loss: Number(t.pnl) }))}>
              <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(1)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#444" />
              <Bar dataKey="loss" name="Loss" fill="#00aaff" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  )
}