import { useEffect } from "react"
import { XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend } from "recharts"
import Panel from "../shared/Panel"
import Metric from "../shared/Metric"
import ChartTooltip from "../shared/ChartTooltip"


const mono = "'Courier New', monospace"

function SignalCard({ signal }) {
  const color = signal?.signal === "BUY" ? "#00ff41" : signal?.signal === "SELL" ? "#ff3131" : "#ffd700"
  return (
    <Panel title="SIGNAL">
      <div className="flex flex-col items-center gap-3 py-2">
        <div style={{ fontSize: 10, color: "#666", fontFamily: mono, letterSpacing: 2 }}>ACTIVE SIGNAL</div>
        <div style={{ fontSize: 52, fontWeight: 900, fontFamily: mono, color, textShadow: `0 0 20px ${color}88` }}>
          {signal?.signal}
        </div>
        <div className="w-full">
          <div className="w-full h-1.5 rounded bg-base-300 overflow-hidden">
            <div style={{ width: `${signal?.confidence}%`, background: color, height: "100%", boxShadow: `0 0 8px ${color}`, transition: "width 1s ease" }} />
          </div>
          <div style={{ fontSize: 12, color, fontFamily: mono, marginTop: 4, textAlign: "center" }}>
            CONF: {signal?.confidence}%
          </div>
        </div>
        <div className="divider my-0" />
        <Metric label="LAST PRICE" value={`₹${signal?.close?.toLocaleString()}`} color="#ffffff" size={16} />
        <Metric label="AS OF" value={signal?.date} color="#666" size={12} />
      </div>
    </Panel>
  )
}

function StatsCard({ stats }) {
  return (
    <Panel title="PORTFOLIO METRICS">
      <div className="grid grid-cols-3 gap-4">
        <Metric label="INITIAL CAPITAL" value={`₹${stats?.initial_capital?.toLocaleString()}`} color="#cccccc" size={17} />
        <Metric label="FINAL VALUE"     value={`₹${stats?.final_value?.toLocaleString()}`}     color="#00ff41" size={17} />
        <Metric label="TOTAL RETURN"    value={`+${stats?.total_return}%`}                      color="#00ff41" size={24} />
        <Metric label="TOTAL TRADES"    value={stats?.total_trades}                             color="#cccccc" size={17} />
        <Metric label="WINS / LOSSES"   value={`${stats?.wins} / ${stats?.losses}`}             color="#cccccc" size={17} />
        <Metric label="WIN RATE"        value={`${stats?.win_rate}%`}                           color={stats?.win_rate >= 60 ? "#00ff41" : "#ffd700"} size={24} />
      </div>
    </Panel>
  )
}

function PnlCard({ pnl }) {
  return (
    <Panel title="PnL TRACKER">
      <div className="grid grid-cols-2 gap-4 mb-3">
        <Metric label="CUMULATIVE PnL" value={`+₹${pnl?.cumulative_pnl?.toLocaleString()}`} color="#00ff41" size={17} />
        <Metric label="BEST TRADE"     value={`+₹${pnl?.best_trade?.toLocaleString()}`}     color="#00aaff" size={17} />
        <Metric label="WORST TRADE"    value={`₹${pnl?.worst_trade?.toLocaleString()}`}     color="#ff3131" size={17} />
        <Metric label="AVG TRADE"      value={`+₹${pnl?.avg_trade?.toLocaleString()}`}      color="#ffd700" size={17} />
      </div>
      <div className="alert alert-success py-2 text-xs" style={{ fontFamily: mono }}>
        {pnl?.last_log || "—"}
      </div>
    </Panel>
  )
}

function PsychCard({ psych }) {
  if (!psych) return null
  const color = psych.color
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (circumference * psych.score / 100)
  return (
    <Panel title="🧠 EMOTIONAL HEALTH ENGINE">
      <div className="flex gap-4 items-start">
        <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#222" strokeWidth="7" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="7"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 1.5s ease", filter: `drop-shadow(0 0 5px ${color})` }} />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: mono }}>{psych.score}</div>
            <div style={{ fontSize: 9, color: "#666", fontFamily: mono }}>/ 100</div>
          </div>
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: mono, marginBottom: 4 }}>{psych.status}</div>
          <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.6, marginBottom: 8 }}>{psych.message}</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["CONSEC LOSSES", psych.consecutive_losses, psych.consecutive_losses >= 2 ? "#ff3131" : "#00ff41"],
              ["DRAWDOWN",      `-${psych.drawdown_pct}%`, psych.drawdown_pct > 3 ? "#ff3131" : "#00ff41"],
              ["RECENT WIN%",   `${psych.recent_winrate}%`, psych.recent_winrate >= 50 ? "#00ff41" : "#ff3131"],
              ["MODEL CONF",    `${psych.conf_score}%`, psych.conf_score >= 60 ? "#00ff41" : "#ffd700"],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-base-300 rounded p-2">
                <div style={{ fontSize: 9, color: "#666", fontFamily: mono }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: mono }}>{v}</div>
              </div>
            ))}
          </div>
          {psych.alerts?.length === 0
            ? <div className="alert alert-success py-1 text-xs mt-2" style={{ fontFamily: mono }}>✅ NO RISK ALERTS</div>
            : psych.alerts?.map((a, i) => (
              <div key={i} className="alert alert-error py-1 text-xs mt-2" style={{ fontFamily: mono }}>{a}</div>
            ))
          }
        </div>
      </div>
    </Panel>
  )
}

export default function Dashboard({ signal, stats, pnl, portfolio, psych, indicators, trades, compare }) {

  useEffect(() => {
    const handler = (e) => { if (window.__setPage) window.__setPage(e.detail) }
    window.addEventListener("navigate", handler)
    return () => window.removeEventListener("navigate", handler)
  }, [])

  return (
    <div className="flex flex-col gap-3">

      {/* Row 1 — Signal + Stats + PnL */}
      <div className="grid grid-cols-3 gap-3" style={{ gridTemplateColumns: "200px 1fr 1fr" }}>
        <SignalCard signal={signal} />
        <StatsCard stats={stats} />
        <PnlCard pnl={pnl} />
      </div>

      {/* Row 2 — 3-Way Comparison Chart */}
<Panel title="📈 STRATEGY COMPARISON — QUANT vs MACRO vs NSEI BENCHMARK" accent="#cc44ff">
  <div className="flex gap-4 mb-3">
    {[
      ["QUANT",    `+${compare?.quant_stats?.total_return ?? "—"}%`, "#ff6600"],
      ["MACRO",    `+${compare?.macro_stats?.total_return ?? "—"}%`, "#00aaff"],
      ["NSEI BM",  `+${compare?.chart_data?.length
        ? ((compare.chart_data.filter(d => d.NSEI).slice(-1)[0]?.NSEI - 100000) / 100000 * 100).toFixed(2)
        : "—"}%`,                                                    "#cc44ff"],
      ["STRATEGY", `+${stats?.total_return ?? "—"}%`,               "#ff3131"],
    ].map(([label, value, color]) => (
      <div key={label} className="flex-1 rounded p-3 text-center"
        style={{ background: `${color}11`, border: `1px solid ${color}33` }}>
        <div style={{ fontSize: 10, color: "#666", fontFamily: mono, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: mono }}>{value}</div>
      </div>
    ))}
  </div>
  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={compare?.chart_data?.filter((_, i) => i % 3 === 0) || []}>
      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }}
        tickFormatter={d => d?.slice(2, 7)} />
      <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }}
        tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
      <Tooltip content={<ChartTooltip />} />
      <ReferenceLine y={100000} stroke="#333" strokeDasharray="4 4" />
      <Legend wrapperStyle={{ fontFamily: mono, fontSize: 11 }} />
      <Line type="monotone" dataKey="QUANT" stroke="#ff6600" strokeWidth={2.5} dot={false} />
      <Line type="monotone" dataKey="MACRO" stroke="#00aaff" strokeWidth={2.5} dot={false} />
      <Line type="monotone" dataKey="NSEI"  stroke="#cc44ff" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
    </LineChart>
  </ResponsiveContainer>
</Panel>

      {/* Row 3 — Psychology + RSI */}
      <div className="grid grid-cols-2 gap-3">
        <PsychCard psych={psych} />
        <Panel title="RSI-14 MOMENTUM">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={indicators}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={d => d?.slice(2, 7)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={70} stroke="#ff3131" strokeDasharray="3 3" label={{ value: "OB 70", fill: "#ff3131", fontSize: 10 }} />
              <ReferenceLine y={30} stroke="#00ff41" strokeDasharray="3 3" label={{ value: "OS 30", fill: "#00ff41", fontSize: 10 }} />
              <Line type="monotone" dataKey="rsi" stroke="#00aaff" strokeWidth={2} dot={false} name="RSI" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Row 4 — Bollinger + Trades */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="BOLLINGER BANDS + SMA OVERLAY">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={indicators}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={d => d?.slice(2, 7)} />
              <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} domain={["auto", "auto"]} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="bb_upper" stroke="#ff3131" strokeWidth={1} dot={false} strokeDasharray="3 3" name="BB Upper" />
              <Line type="monotone" dataKey="bb_lower" stroke="#00ff41" strokeWidth={1} dot={false} strokeDasharray="3 3" name="BB Lower" />
              <Line type="monotone" dataKey="sma20"    stroke="#ffd700" strokeWidth={1.5} dot={false} name="SMA 20" />
              <Line type="monotone" dataKey="sma50"    stroke="#00aaff" strokeWidth={1.5} dot={false} name="SMA 50" />
              <Line type="monotone" dataKey="Close"    stroke="#ffffff" strokeWidth={2}   dot={false} name="Price" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2" style={{ fontSize: 10, fontFamily: mono }}>
            {[["BB U", "#ff3131"], ["BB L", "#00ff41"], ["SMA20", "#ffd700"], ["SMA50", "#00aaff"], ["PRICE", "#fff"]].map(([l, c]) => (
              <span key={l} style={{ color: c }}>— {l}</span>
            ))}
          </div>
        </Panel>

        <Panel title="TRADE EXECUTION LOG">
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            <table className="table table-xs" style={{ fontFamily: mono }}>
              <thead>
                <tr style={{ color: "#ff6600", fontSize: 10 }}>
                  <th>DATE</th><th>ACTION</th><th>PRICE</th><th>QTY</th><th>PnL</th><th>CONF</th>
                </tr>
              </thead>
              <tbody>
                {trades?.map((t, i) => (
                  <tr key={i} className="hover">
                    <td style={{ color: "#666" }}>{t.date?.slice(0, 10)}</td>
                    <td><span style={{ color: t.action === "BUY" ? "#00ff41" : "#ff3131", fontWeight: 700 }}>{t.action}</span></td>
                    <td style={{ color: "#ccc" }}>₹{Number(t.price)?.toLocaleString()}</td>
                    <td style={{ color: "#ccc" }}>{t.qty}</td>
                    <td style={{ color: t.pnl > 0 ? "#00ff41" : t.pnl < 0 ? "#ff3131" : "#666", fontWeight: 700 }}>
                      {t.pnl > 0 ? "+" : ""}₹{Number(t.pnl)?.toLocaleString()}
                    </td>
                    <td style={{ color: "#666" }}>{t.confidence ? `${(t.confidence * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Row 5 — Clients Spotlight */}
      <Panel title="⚖ DUAL CLIENT ENGINE — QUANT vs MACRO" accent="#cc44ff">
        <div className="grid grid-cols-3 gap-4">

          {/* QUANT */}
          <div className="card bg-base-300 p-4" style={{ borderTop: "3px solid #ff6600" }}>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 18, fontWeight: 900, color: "#ff6600", fontFamily: mono }}>QUANT</span>
              <div className="badge badge-warning badge-sm">AGGRESSIVE</div>
            </div>
            <div className="flex flex-col gap-2">
              {[
                ["RETURN",   `+${compare?.quant_stats?.total_return}%`,           "#00ff41"],
                ["WIN RATE", `${compare?.quant_stats?.win_rate}%`,                "#ffd700"],
                ["TRADES",   compare?.quant_stats?.total_trades,                  "#ccc"   ],
                ["MAX DD",   `-${compare?.quant_stats?.max_drawdown}%`,           "#ff3131"],
              ].map(([l, v, c]) => (
                <div key={l} className="flex justify-between border-b border-base-200 pb-1">
                  <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>{l}</span>
                  <span style={{ fontSize: 13, color: c,    fontFamily: mono, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded" style={{ background: "#ff660011", border: "1px solid #ff660033" }}>
              <div style={{ fontSize: 10, color: "#ff6600", fontFamily: mono }}>STRATEGY</div>
              <div style={{ fontSize: 11, color: "#999",    fontFamily: mono, marginTop: 2 }}>
                High-frequency ML · 45% confidence · 95% position size
              </div>
            </div>
          </div>

          {/* VS + Alpha */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div style={{ fontSize: 28, fontWeight: 900, color: "#333", fontFamily: mono }}>VS</div>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-center p-2 rounded"
                style={{ background: "#ff660011", border: "1px solid #ff660033" }}>
                <span style={{ fontSize: 11, color: "#ff6600", fontFamily: mono }}>QUANT α</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#00ff41", fontFamily: mono }}>
                  +{compare?.alpha?.quant_vs_nsei}%
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded"
                style={{ background: "#00aaff11", border: "1px solid #00aaff33" }}>
                <span style={{ fontSize: 11, color: "#00aaff", fontFamily: mono }}>MACRO α</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#00ff41", fontFamily: mono }}>
                  +{compare?.alpha?.macro_vs_nsei}%
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded"
                style={{ background: "#cc44ff11", border: "1px solid #cc44ff33" }}>
                <span style={{ fontSize: 11, color: "#cc44ff", fontFamily: mono }}>NSEI BM</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#cc44ff", fontFamily: mono }}>
                  +{compare?.chart_data?.length
                    ? ((compare.chart_data.filter(d => d.NSEI).slice(-1)[0]?.NSEI - 100000) / 100000 * 100).toFixed(2)
                    : "—"}%
                </span>
              </div>
            </div>
            <button
              className="btn btn-sm btn-outline w-full"
              style={{ fontFamily: mono, fontSize: 11, borderColor: "#cc44ff", color: "#cc44ff" }}
              onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "clients" }))}>
              VIEW FULL COMPARISON →
            </button>
          </div>

          {/* MACRO */}
          <div className="card bg-base-300 p-4" style={{ borderTop: "3px solid #00aaff" }}>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 18, fontWeight: 900, color: "#00aaff", fontFamily: mono }}>MACRO</span>
              <div className="badge badge-info badge-sm">CONSERVATIVE</div>
            </div>
            <div className="flex flex-col gap-2">
              {[
                ["RETURN",   `+${compare?.macro_stats?.total_return}%`,           "#00ff41"],
                ["WIN RATE", `${compare?.macro_stats?.win_rate}%`,                "#ffd700"],
                ["TRADES",   compare?.macro_stats?.total_trades,                  "#ccc"   ],
                ["MAX DD",   `-${compare?.macro_stats?.max_drawdown}%`,           "#ff3131"],
              ].map(([l, v, c]) => (
                <div key={l} className="flex justify-between border-b border-base-200 pb-1">
                  <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>{l}</span>
                  <span style={{ fontSize: 13, color: c,    fontFamily: mono, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded" style={{ background: "#00aaff11", border: "1px solid #00aaff33" }}>
              <div style={{ fontSize: 10, color: "#00aaff", fontFamily: mono }}>STRATEGY</div>
              <div style={{ fontSize: 11, color: "#999",    fontFamily: mono, marginTop: 2 }}>
                Selective ML · 70% confidence · 60% position size
              </div>
            </div>
          </div>

        </div>
      </Panel>

    </div>
  )
}