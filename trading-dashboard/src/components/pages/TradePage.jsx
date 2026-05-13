import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts"
import Panel from "../shared/Panel"
import Metric from "../shared/Metric"
import ChartTooltip from "../shared/ChartTooltip"
import BackButton from "../layout/BackButton"

const mono = "'Courier New', monospace"

function TradeTable({ trades }) {
  const sells = trades?.filter(t => t.action === "SELL") || []
  const wins = sells.filter(t => t.pnl > 0)
  const losses = sells.filter(t => t.pnl < 0)
  const pnlData = sells.map((t, i) => ({ trade: i + 1, pnl: t.pnl }))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Panel title="PnL PER TRADE">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pnlData}>
              <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#444" />
              <Bar dataKey="pnl" name="PnL">
                {pnlData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl > 0 ? "#00ff41" : "#ff3131"} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="TRADE SUMMARY">
          <div className="grid grid-cols-2 gap-4">
            <Metric label="BEST TRADE"   value={`+₹${sells.length ? Math.max(...sells.map(t => t.pnl)).toLocaleString() : 0}`} color="#00ff41" size={18} />
            <Metric label="WORST TRADE"  value={`₹${sells.length ? Math.min(...sells.map(t => t.pnl)).toLocaleString() : 0}`}  color="#ff3131" size={18} />
            <Metric label="AVG WIN"      value={`+₹${wins.length ? Math.round(wins.reduce((a, t) => a + t.pnl, 0) / wins.length).toLocaleString() : 0}`} color="#00aaff" size={18} />
            <Metric label="AVG LOSS"     value={`₹${losses.length ? Math.round(losses.reduce((a, t) => a + t.pnl, 0) / losses.length).toLocaleString() : 0}`} color="#ffd700" size={18} />
            <Metric label="TOTAL PnL"    value={`₹${sells.reduce((a, t) => a + t.pnl, 0).toLocaleString()}`} color="#00ff41" size={18} />
            <Metric label="PROFIT FACTOR" value={
              losses.length
                ? (wins.reduce((a, t) => a + t.pnl, 0) / Math.abs(losses.reduce((a, t) => a + t.pnl, 0))).toFixed(2)
                : "∞"
            } color="#cc44ff" size={18} />
          </div>
        </Panel>
      </div>

      <Panel title="FULL TRADE EXECUTION LOG">
        <div className="overflow-x-auto">
          <table className="table table-sm" style={{ fontFamily: mono }}>
            <thead>
              <tr style={{ color: "#ff6600", fontSize: 10, letterSpacing: 1 }}>
                <th>#</th><th>DATE</th><th>ACTION</th><th>FILL PRICE</th><th>QTY</th><th>REALIZED PnL</th><th>CONFIDENCE</th><th>EXIT TYPE</th>
              </tr>
            </thead>
            <tbody>
              {trades?.map((t, i) => (
                <tr key={i} className="hover">
                  <td style={{ color: "#666" }}>{i + 1}</td>
                  <td style={{ color: "#666" }}>{t.date?.slice(0, 10)}</td>
                  <td><div className={`badge badge-sm ${t.action === "BUY" ? "badge-success" : "badge-error"}`}>{t.action}</div></td>
                  <td style={{ color: "#ccc" }}>₹{Number(t.price)?.toLocaleString()}</td>
                  <td style={{ color: "#ccc" }}>{t.qty}</td>
                  <td style={{ color: t.pnl > 0 ? "#00ff41" : t.pnl < 0 ? "#ff3131" : "#666", fontWeight: 700 }}>
                    {t.pnl > 0 ? "+" : ""}₹{Number(t.pnl)?.toLocaleString()}
                  </td>
                  <td style={{ color: "#666" }}>{t.confidence ? `${(t.confidence * 100).toFixed(1)}%` : "—"}</td>
                  <td>
                    {t.exit_type
                      ? <div className={`badge badge-sm badge-outline ${t.exit_type === "forced" || t.exit_type === "stop_loss" ? "badge-warning" : "badge-info"}`}>{t.exit_type}</div>
                      : <span style={{ color: "#444" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

export default function TradePage({ trades, compare, onBack }) {
  const [tab, setTab] = useState("STRATEGY")

  const tabTrades = {
    STRATEGY: trades,
    QUANT:    compare?.quant_trades,
    MACRO:    compare?.macro_trades,
  }

  const tabColor = { STRATEGY: "#ff3131", QUANT: "#ff6600", MACRO: "#00aaff" }
  const currentTrades = tabTrades[tab] || []
  const sells = currentTrades.filter(t => t.action === "SELL")
  const wins  = sells.filter(t => t.pnl > 0)
  const color = tabColor[tab]

  return (
    <div className="flex flex-col gap-3">

      {/* ── BACK BUTTON ── */}
      <BackButton onBack={onBack} />

      {/* Tab switcher */}
      <div className="flex items-center gap-4">
        <div className="join">
          {["STRATEGY", "QUANT", "MACRO"].map(t => (
            <button key={t}
              className={`btn btn-sm join-item ${tab === t ? "btn-active" : "btn-outline"}`}
              style={{ fontFamily: mono, color: tab === t ? "#000" : tabColor[t], borderColor: tabColor[t],
                background: tab === t ? tabColor[t] : "transparent" }}
              onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>
          {tab === "STRATEGY" ? "Original backtest strategy" : tab === "QUANT" ? "Aggressive ML · 45% conf · 95% size" : "Conservative ML · 70% conf · 60% size"}
        </span>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          ["TOTAL TRADES", currentTrades.length,          color],
          ["WINNING",      wins.length,                   "#00ff41"],
          ["LOSING",       sells.length - wins.length,    "#ff3131"],
          ["WIN RATE",     sells.length ? `${((wins.length / sells.length) * 100).toFixed(1)}%` : "—", "#ffd700"],
        ].map(([l, v, c]) => (
          <div key={l} className="stat bg-base-200 rounded-box border border-base-300"
            style={{ borderTop: `2px solid ${c}` }}>
            <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>{l}</div>
            <div className="stat-value" style={{ color: c, fontFamily: mono, fontSize: 28 }}>{v}</div>
          </div>
        ))}
      </div>

      <TradeTable trades={currentTrades} />
    </div>
  )
}