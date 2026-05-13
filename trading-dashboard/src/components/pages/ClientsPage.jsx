import { useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, BarChart, Bar, Cell
} from "recharts"
import Panel from "../shared/Panel"
import Metric from "../shared/Metric"
import ChartTooltip from "../shared/ChartTooltip"
import BackButton from "../layout/BackButton"

const mono = "'Courier New', monospace"

function ProfileBadge({ label, value }) {
  return (
    <div className="flex justify-between items-center border-b border-base-300 py-2">
      <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>{label}</span>
      <span style={{ fontSize: 11, color: "#ccc", fontFamily: mono, fontWeight: 700 }}>{value}</span>
    </div>
  )
}

export default function ClientsPage({ compare, onBack }) {
  const [activeTab, setActiveTab] = useState("QUANT")

  if (!compare) return (
    <div className="flex items-center justify-center h-64 gap-3">
      <span className="loading loading-bars loading-lg" style={{ color: "#ff6600" }}></span>
      <span style={{ fontFamily: mono, color: "#666" }}>Loading client data...</span>
    </div>
  )

  const { quant_stats, macro_stats, chart_data, alpha } = compare

  const nsei_return = chart_data.filter(d => d.NSEI).slice(-1)[0]?.NSEI
  const nsei_pct    = nsei_return ? ((nsei_return - 100000) / 100000 * 100).toFixed(2) : "—"

  const ddData = (() => {
    let qPeak = 100000, mPeak = 100000
    return chart_data.map(d => {
      if (d.QUANT && d.QUANT > qPeak) qPeak = d.QUANT
      if (d.MACRO && d.MACRO > mPeak) mPeak = d.MACRO
      return {
        date:  d.date?.slice(2, 7),
        QUANT: d.QUANT ? parseFloat(((d.QUANT - qPeak) / qPeak * 100).toFixed(2)) : null,
        MACRO: d.MACRO ? parseFloat(((d.MACRO - mPeak) / mPeak * 100).toFixed(2)) : null,
      }
    })
  })()

  const barData = [
    { metric: "Return %",   QUANT: quant_stats.total_return,  MACRO: macro_stats.total_return  },
    { metric: "Win Rate %", QUANT: quant_stats.win_rate,      MACRO: macro_stats.win_rate      },
    { metric: "Max DD %",   QUANT: -quant_stats.max_drawdown, MACRO: -macro_stats.max_drawdown },
  ]

  const tradeData = activeTab === "QUANT"
    ? compare.quant_trades
    : compare.macro_trades

  return (
    <div className="flex flex-col gap-3">

      <BackButton onBack={onBack} />

      {/* ── CLIENT HEADER CARDS ── */}
      <div className="grid grid-cols-3 gap-3">

        {/* QUANT card */}
        <div className="card bg-base-200 border border-base-300 p-4"
          style={{ borderTop: "3px solid #ff6600" }}>
          <div className="flex justify-between items-center mb-3">
            <span style={{ fontSize: 20, fontWeight: 900, color: "#ff6600", fontFamily: mono }}>QUANT</span>
            <div className="badge badge-warning" style={{ fontFamily: mono }}>AGGRESSIVE</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Metric label="FINAL VALUE"   value={`₹${quant_stats.final_value?.toLocaleString()}`}  color="#ff6600" size={18} />
            <Metric label="TOTAL RETURN"  value={`+${quant_stats.total_return}%`}                   color="#00ff41" size={18} />
            <Metric label="WIN RATE"      value={`${quant_stats.win_rate}%`}                         color="#ffd700" size={18} />
            <Metric label="TOTAL TRADES"  value={quant_stats.total_trades}                           color="#ccc"    size={18} />
            <Metric label="MAX DRAWDOWN"  value={`-${quant_stats.max_drawdown}%`}                   color="#ff3131" size={18} />
            <Metric label="TOTAL PnL"     value={`₹${quant_stats.total_pnl?.toLocaleString()}`}    color="#00ff41" size={18} />
          </div>
          <div className="border-t border-base-300 pt-3">
            <ProfileBadge label="Confidence Threshold" value="≥ 45%" />
            <ProfileBadge label="Position Size"        value="95% of capital" />
            <ProfileBadge label="Stop Loss"            value="3%" />
            <ProfileBadge label="Max Hold"             value="30 days" />
          </div>
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div style={{ fontSize: 36, fontWeight: 900, color: "#444", fontFamily: mono }}>VS</div>
          <div className="flex flex-col gap-2 w-full">
            <div className="card bg-base-300 p-3 text-center" style={{ borderTop: "2px solid #ff6600" }}>
              <div style={{ fontSize: 10, color: "#666", fontFamily: mono, marginBottom: 4 }}>QUANT α vs NSEI</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: alpha.quant_vs_nsei >= 0 ? "#00ff41" : "#ff3131", fontFamily: mono }}>
                {alpha.quant_vs_nsei >= 0 ? "+" : ""}{alpha.quant_vs_nsei}%
              </div>
            </div>
            <div className="card bg-base-300 p-3 text-center" style={{ borderTop: "2px solid #00aaff" }}>
              <div style={{ fontSize: 10, color: "#666", fontFamily: mono, marginBottom: 4 }}>MACRO α vs NSEI</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: alpha.macro_vs_nsei >= 0 ? "#00ff41" : "#ff3131", fontFamily: mono }}>
                {alpha.macro_vs_nsei >= 0 ? "+" : ""}{alpha.macro_vs_nsei}%
              </div>
            </div>
            <div className="card bg-base-300 p-3 text-center" style={{ borderTop: "2px solid #cc44ff" }}>
              <div style={{ fontSize: 10, color: "#666", fontFamily: mono, marginBottom: 4 }}>NSEI BENCHMARK</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#cc44ff", fontFamily: mono }}>+{nsei_pct}%</div>
            </div>
          </div>
        </div>

        {/* MACRO card */}
        <div className="card bg-base-200 border border-base-300 p-4"
          style={{ borderTop: "3px solid #00aaff" }}>
          <div className="flex justify-between items-center mb-3">
            <span style={{ fontSize: 20, fontWeight: 900, color: "#00aaff", fontFamily: mono }}>MACRO</span>
            <div className="badge badge-info" style={{ fontFamily: mono }}>CONSERVATIVE</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Metric label="FINAL VALUE"   value={`₹${macro_stats.final_value?.toLocaleString()}`}  color="#00aaff" size={18} />
            <Metric label="TOTAL RETURN"  value={`+${macro_stats.total_return}%`}                   color="#00ff41" size={18} />
            <Metric label="WIN RATE"      value={`${macro_stats.win_rate}%`}                         color="#ffd700" size={18} />
            <Metric label="TOTAL TRADES"  value={macro_stats.total_trades}                           color="#ccc"    size={18} />
            <Metric label="MAX DRAWDOWN"  value={`-${macro_stats.max_drawdown}%`}                   color="#ff3131" size={18} />
            <Metric label="TOTAL PnL"     value={`₹${macro_stats.total_pnl?.toLocaleString()}`}    color="#00aaff" size={18} />
          </div>
          <div className="border-t border-base-300 pt-3">
            <ProfileBadge label="Confidence Threshold" value="≥ 70%" />
            <ProfileBadge label="Position Size"        value="60% of capital" />
            <ProfileBadge label="Stop Loss"            value="1.5%" />
            <ProfileBadge label="Max Hold"             value="15 days" />
          </div>
        </div>
      </div>

      {/* ── EQUITY CURVE COMPARISON ── */}
      <Panel title="PORTFOLIO EQUITY CURVE — QUANT vs MACRO vs NSEI BENCHMARK">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 10 }}>
          All three start at ₹1,00,000 · NSEI = buy-and-hold benchmark
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart_data.filter((_, i) => i % 3 === 0)}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }}
              tickFormatter={d => d?.slice(2, 7)} />
            <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={100000} stroke="#333" strokeDasharray="4 4" />
            <Legend wrapperStyle={{ fontFamily: mono, fontSize: 12 }} />
            <Line type="monotone" dataKey="QUANT" stroke="#ff6600" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="MACRO" stroke="#00aaff" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="NSEI"  stroke="#cc44ff" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── DRAWDOWN + BAR COMPARISON ── */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="DRAWDOWN COMPARISON — % FROM PEAK" accent="#ff3131">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ddData.filter((_, i) => i % 3 === 0)}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#333" />
              <Legend wrapperStyle={{ fontFamily: mono, fontSize: 11 }} />
              <Line type="monotone" dataKey="QUANT" stroke="#ff6600" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="MACRO" stroke="#00aaff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="HEAD-TO-HEAD METRICS COMPARISON">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <YAxis dataKey="metric" type="category" tick={{ fontSize: 11, fill: "#ccc", fontFamily: mono }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontFamily: mono, fontSize: 11 }} />
              <Bar dataKey="QUANT" fill="#ff6600" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
              <Bar dataKey="MACRO" fill="#00aaff" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── TRADE LOG ── */}
      <Panel title="TRADE-BY-TRADE LOG">
        <div className="tabs tabs-boxed mb-4" style={{ fontFamily: mono }}>
          {["QUANT", "MACRO"].map(tab => (
            <a key={tab}
              className={`tab ${activeTab === tab ? "tab-active" : ""}`}
              style={{ color: tab === "QUANT" ? "#ff6600" : "#00aaff", fontFamily: mono, fontWeight: 700 }}
              onClick={() => setActiveTab(tab)}>
              {tab}
            </a>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm" style={{ fontFamily: mono }}>
            <thead>
              <tr style={{ color: activeTab === "QUANT" ? "#ff6600" : "#00aaff", fontSize: 11, letterSpacing: 1 }}>
                <th>#</th><th>DATE</th><th>ACTION</th><th>PRICE</th><th>QTY</th><th>PnL</th><th>CONFIDENCE</th><th>EXIT</th>
              </tr>
            </thead>
            <tbody>
              {(tradeData || []).map((t, i) => (
                <tr key={i} className="hover">
                  <td style={{ color: "#555" }}>{i + 1}</td>
                  <td style={{ color: "#666" }}>{t.date}</td>
                  <td>
                    <div className={`badge badge-sm ${t.action === "BUY" ? "badge-success" : "badge-error"}`}>
                      {t.action}
                    </div>
                  </td>
                  <td style={{ color: "#ccc" }}>₹{Number(t.price)?.toLocaleString()}</td>
                  <td style={{ color: "#ccc" }}>{t.qty}</td>
                  <td style={{ color: t.pnl > 0 ? "#00ff41" : t.pnl < 0 ? "#ff3131" : "#666", fontWeight: 700 }}>
                    {t.pnl !== 0 ? `${t.pnl > 0 ? "+" : ""}₹${Number(t.pnl)?.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ color: "#666" }}>{(t.confidence * 100).toFixed(1)}%</td>
                  <td>
                    {t.exit_type
                      ? <div className={`badge badge-xs badge-outline ${t.exit_type === "stop_loss" ? "badge-error" : t.exit_type === "max_hold" ? "badge-warning" : "badge-info"}`}>
                          {t.exit_type}
                        </div>
                      : <span style={{ color: "#333" }}>—</span>}
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