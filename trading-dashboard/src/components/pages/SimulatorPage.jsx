import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend } from "recharts"
import Panel from "../shared/Panel"
import Metric from "../shared/Metric"
import ChartTooltip from "../shared/ChartTooltip"
import BackButton from "../layout/BackButton"

const mono = "'Courier New', monospace"

function scalePortfolio(portfolioArr, capital) {
  const ratio = capital / 100000
  return (portfolioArr || []).map(row => ({
    date:  row.date?.slice(2, 7),
    value: Math.round(row.value * ratio),
  }))
}

export default function SimulatorPage({ portfolio, compare, onBack }) {
  const [capital, setCapital]   = useState(100000)
  const [inputVal, setInputVal] = useState("100000")
  const [mode, setMode]         = useState("ALL")

  const ratio       = capital / 100000
  const stratData   = scalePortfolio(portfolio, capital)
  const quantData   = scalePortfolio(compare?.quant_portfolio, capital)
  const macroData   = scalePortfolio(compare?.macro_portfolio, capital)

  // Merge for combined chart
  const combined = stratData.map((row, i) => ({
    date:     row.date,
    STRATEGY: row.value,
    QUANT:    quantData[i]?.value ?? null,
    MACRO:    macroData[i]?.value ?? null,
  })).filter((_, i) => i % 3 === 0)

  const stratFinal = stratData[stratData.length - 1]?.value || 0
  const quantFinal = quantData[quantData.length - 1]?.value || 0
  const macroFinal = macroData[macroData.length - 1]?.value || 0

  const presets = [50000, 100000, 250000, 500000, 1000000]

  const resultCards = [
    ["STRATEGY", stratFinal, "#ff3131"],
    ["QUANT",    quantFinal, "#ff6600"],
    ["MACRO",    macroFinal, "#00aaff"],
  ]

  return (
    <div className="flex flex-col gap-3">

      <BackButton onBack={onBack} />

      {/* Capital input */}
      <Panel title="PORTFOLIO SIMULATOR — ENTER YOUR CAPITAL">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 16 }}>
          See what each strategy would have returned with your actual investment amount
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-center">
            <span style={{ color: "#ff6600", fontFamily: mono, fontSize: 18, fontWeight: 700 }}>₹</span>
            <input type="number" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={() => { const v = parseInt(inputVal); if (!isNaN(v) && v >= 1000) setCapital(v) }}
              className="input input-bordered w-64"
              style={{ fontFamily: mono, fontSize: 18, background: "#1a1a1a", color: "#fff", borderColor: "#ff6600" }}
              min={1000} />
            <button className="btn btn-warning" style={{ fontFamily: mono }}
              onClick={() => { const v = parseInt(inputVal); if (!isNaN(v) && v >= 1000) setCapital(v) }}>
              SIMULATE
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span style={{ fontSize: 11, color: "#666", fontFamily: mono, alignSelf: "center" }}>PRESETS:</span>
            {presets.map(p => (
              <button key={p} className={`btn btn-sm btn-outline ${capital === p ? "btn-warning" : ""}`}
                style={{ fontFamily: mono, fontSize: 11 }}
                onClick={() => { setCapital(p); setInputVal(String(p)) }}>
                ₹{p.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Result cards */}
      <div className="grid grid-cols-3 gap-3">
        {resultCards.map(([label, final, color]) => {
          const profit = final - capital
          const ret    = ((profit / capital) * 100).toFixed(2)
          return (
            <div key={label} className="card bg-base-200 border border-base-300 p-4"
              style={{ borderTop: `3px solid ${color}` }}>
              <div style={{ fontSize: 14, color, fontFamily: mono, fontWeight: 700, marginBottom: 8 }}>{label}</div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>INVESTED</span>
                  <span style={{ fontSize: 13, color: "#ccc", fontFamily: mono }}>₹{capital.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>FINAL VALUE</span>
                  <span style={{ fontSize: 13, color: "#00ff41", fontFamily: mono, fontWeight: 700 }}>₹{final.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>PROFIT</span>
                  <span style={{ fontSize: 13, color: profit >= 0 ? "#00ff41" : "#ff3131", fontFamily: mono, fontWeight: 700 }}>
                    ₹{profit.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-base-300 pt-2">
                  <span style={{ fontSize: 11, color: "#666", fontFamily: mono }}>RETURN</span>
                  <span style={{ fontSize: 18, color, fontFamily: mono, fontWeight: 900 }}>+{ret}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Combined equity curve */}
      <Panel title={`SIMULATED EQUITY CURVES — ₹${capital.toLocaleString()} STARTING CAPITAL`}>
        <div className="join mb-3">
          {["ALL", "STRATEGY", "QUANT", "MACRO"].map(m => (
            <button key={m} className={`btn btn-sm join-item ${mode === m ? "btn-warning" : "btn-outline"}`}
              style={{ fontFamily: mono }} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={combined}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
            <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={capital} stroke="#444" strokeDasharray="4 4" label={{ value: "ENTRY", fill: "#666", fontSize: 10 }} />
            <Legend wrapperStyle={{ fontFamily: mono, fontSize: 11 }} />
            {(mode === "ALL" || mode === "STRATEGY") && <Line type="monotone" dataKey="STRATEGY" stroke="#ff3131" strokeWidth={2} dot={false} />}
            {(mode === "ALL" || mode === "QUANT")    && <Line type="monotone" dataKey="QUANT"    stroke="#ff6600" strokeWidth={2} dot={false} />}
            {(mode === "ALL" || mode === "MACRO")    && <Line type="monotone" dataKey="MACRO"    stroke="#00aaff" strokeWidth={2} dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="alert alert-info" style={{ fontFamily: mono, fontSize: 11 }}>
        ℹ️ All values proportionally scaled from base backtests. Results assume identical position sizing and trade timing per strategy.
      </div>
    </div>
  )
}