import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar, Cell } from "recharts"
import Panel from "../shared/Panel"
import Metric from "../shared/Metric"
import ChartTooltip from "../shared/ChartTooltip"
import BackButton from "../layout/BackButton"

const mono = "'Courier New', monospace"

function calcDrawdown(portfolioArr) {
  let peak = 0
  return (portfolioArr || []).map(row => {
    if (row.value > peak) peak = row.value
    const dd = peak > 0 ? ((row.value - peak) / peak) * 100 : 0
    return { date: row.date?.slice(2, 7), drawdown: parseFloat(dd.toFixed(2)), value: row.value }
  })
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

  const minStrategy = Math.min(...strategyDD.map(d => d.drawdown))
  const minQuant    = Math.min(...quantDD.map(d => d.drawdown))
  const minMacro    = Math.min(...macroDD.map(d => d.drawdown))

  const sells      = trades?.filter(t => t.action === "SELL" && t.pnl < 0) || []
  const quantSells = (compare?.quant_trades || []).filter(t => t.action === "SELL" && t.pnl < 0)
  const macroSells = (compare?.macro_trades || []).filter(t => t.action === "SELL" && t.pnl < 0)

  const summaryRows = [
    ["MAX DRAWDOWN",   `${minStrategy.toFixed(2)}%`, `${minQuant.toFixed(2)}%`,    `${minMacro.toFixed(2)}%`,    "#ff3131"],
    ["LOSING TRADES",  sells.length,                  quantSells.length,             macroSells.length,            "#cc44ff"],
    ["WORST LOSS",     `₹${sells.length    ? Math.min(...sells.map(t => t.pnl)).toLocaleString()      : 0}`,
                       `₹${quantSells.length ? Math.min(...quantSells.map(t => t.pnl)).toLocaleString() : 0}`,
                       `₹${macroSells.length ? Math.min(...macroSells.map(t => t.pnl)).toLocaleString() : 0}`, "#ff3131"],
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
            <BarChart data={quantSells.map((t, i) => ({ trade: i + 1, loss: t.pnl }))}>
              <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#444" />
              <Bar dataKey="loss" name="Loss" fill="#ff6600" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="MACRO — LOSING TRADES" accent="#00aaff">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={macroSells.map((t, i) => ({ trade: i + 1, loss: t.pnl }))}>
              <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`} />
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