import { useState } from "react"
import Panel from "../shared/Panel"
import Metric from "../shared/Metric"

const mono = "'Courier New', monospace"

const PROFILES = {
  CUSTOM: { capital: 100000, riskPct: 2,   entry: 23000, stop: 22500, winRate: 60,   avgWin: 3000,  avgLoss: 2000  },
  QUANT:  { capital: 100000, riskPct: 3,   entry: 23000, stop: 22310, winRate: 96.6, avgWin: 5000,  avgLoss: 2500  },
  MACRO:  { capital: 100000, riskPct: 1.5, entry: 23000, stop: 22655, winRate: 90,   avgWin: 3500,  avgLoss: 1500  },
}

export default function RiskPage({ compare }) {
  const [profile, setProfile] = useState("CUSTOM")
  const [capital,    setCapital]    = useState(100000)
  const [riskPct,    setRiskPct]    = useState(2)
  const [entryPrice, setEntryPrice] = useState(23000)
  const [stopLoss,   setStopLoss]   = useState(22500)
  const [winRate,    setWinRate]    = useState(72.2)
  const [avgWin,     setAvgWin]     = useState(3431)
  const [avgLoss,    setAvgLoss]    = useState(2134)

  const loadProfile = (p) => {
    setProfile(p)
    const pr = PROFILES[p]
    setCapital(pr.capital); setRiskPct(pr.riskPct)
    setEntryPrice(pr.entry); setStopLoss(pr.stop)
    setWinRate(pr.winRate); setAvgWin(pr.avgWin); setAvgLoss(pr.avgLoss)
  }

  const riskAmount    = (capital * riskPct) / 100
  const priceDiff     = Math.abs(entryPrice - stopLoss)
  const positionSize  = priceDiff > 0 ? Math.floor(riskAmount / priceDiff) : 0
  const positionValue = positionSize * entryPrice
  const positionPct   = ((positionValue / capital) * 100).toFixed(1)
  const wr            = winRate / 100
  const winLossRatio  = avgWin / avgLoss
  const kelly         = ((wr * (winLossRatio + 1) - 1) / winLossRatio * 100).toFixed(1)
  const halfKelly     = (kelly / 2).toFixed(1)
  const ev            = ((wr * avgWin) - ((1 - wr) * avgLoss)).toFixed(0)
  const profitFactor  = (wr * avgWin / ((1 - wr) * avgLoss)).toFixed(2)

  return (
    <div className="flex flex-col gap-3">

      {/* Profile selector */}
      <Panel title="LOAD CLIENT RISK PROFILE">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 12 }}>
          Load preset parameters from a client profile or configure manually
        </div>
        <div className="flex gap-3">
          {[
            ["CUSTOM",  "#ffd700", "Manual config"],
            ["QUANT",   "#ff6600", "Aggressive · 3% risk · 95% size"],
            ["MACRO",   "#00aaff", "Conservative · 1.5% risk · 60% size"],
          ].map(([p, c, desc]) => (
            <button key={p}
              className={`btn flex-1 ${profile === p ? "" : "btn-outline"}`}
              style={{ fontFamily: mono, background: profile === p ? c : "transparent", color: profile === p ? "#000" : c, borderColor: c }}
              onClick={() => loadProfile(p)}>
              <div>
                <div style={{ fontWeight: 700 }}>{p}</div>
                <div style={{ fontSize: 10, fontWeight: 400 }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="POSITION SIZE CALCULATOR">
          <div className="flex flex-col gap-4">
            {[
              ["Total Capital (₹)", capital,    setCapital,    1000,   10000000, 1000],
              ["Risk Per Trade (%)", riskPct,   setRiskPct,    0.5,    10,       0.5 ],
              ["Entry Price (₹)",   entryPrice, setEntryPrice, 100,    100000,   100 ],
              ["Stop Loss (₹)",     stopLoss,   setStopLoss,   100,    100000,   100 ],
            ].map(([label, val, setter, min, max, step]) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span style={{ fontSize: 11, color: "#999", fontFamily: mono }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#ff6600", fontFamily: mono, fontWeight: 700 }}>{val.toLocaleString()}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => setter(Number(e.target.value))}
                  className="range range-warning range-sm w-full" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="KELLY CRITERION CALCULATOR">
          <div className="flex flex-col gap-4">
            {[
              ["Win Rate (%)", winRate, setWinRate, 30,  95,    0.5],
              ["Avg Win (₹)",  avgWin,  setAvgWin,  500, 20000, 100],
              ["Avg Loss (₹)", avgLoss, setAvgLoss, 500, 20000, 100],
            ].map(([label, val, setter, min, max, step]) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span style={{ fontSize: 11, color: "#999", fontFamily: mono }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#00aaff", fontFamily: mono, fontWeight: 700 }}>{val.toLocaleString()}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => setter(Number(e.target.value))}
                  className="range range-info range-sm w-full" />
              </div>
            ))}
            <div className="alert alert-info py-2 mt-2" style={{ fontFamily: mono, fontSize: 11 }}>
              ℹ️ Kelly % = optimal fraction of capital to risk per trade
            </div>
          </div>
        </Panel>
      </div>

      {/* Results */}
      <div className="grid grid-cols-4 gap-3">
        {[
          ["RISK AMOUNT",    `₹${riskAmount.toLocaleString()}`,     "#ff3131", `${riskPct}% of capital`      ],
          ["POSITION SIZE",  `${positionSize} units`,                "#ff6600", `₹${positionValue.toLocaleString()} (${positionPct}%)`],
          ["KELLY %",        `${kelly}%`,                            "#00aaff", `Half Kelly: ${halfKelly}%`  ],
          ["EXPECTED VALUE", `₹${Number(ev).toLocaleString()}`,     Number(ev) > 0 ? "#00ff41" : "#ff3131", "Per trade average"],
        ].map(([l, v, c, sub]) => (
          <div key={l} className="stat bg-base-200 rounded-box border border-base-300"
            style={{ borderTop: `2px solid ${c}` }}>
            <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>{l}</div>
            <div className="stat-value" style={{ color: c, fontFamily: mono, fontSize: 20 }}>{v}</div>
            <div className="stat-desc"  style={{ fontFamily: mono }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Edge analysis */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="TRADE RISK BREAKDOWN" accent="#ff3131">
          <div className="flex flex-col gap-3">
            {[
              ["Capital at Risk",    `₹${riskAmount.toLocaleString()}`,                                            "#ff3131"],
              ["Stop Distance",      `₹${priceDiff.toLocaleString()} (${((priceDiff / entryPrice) * 100).toFixed(2)}%)`, "#ffd700"],
              ["Position Value",     `₹${positionValue.toLocaleString()}`,                                         "#ff6600"],
              ["Capital Exposure",   `${positionPct}%`,                                                            positionPct > 20 ? "#ff3131" : "#00ff41"],
              ["Max Loss",           `₹${riskAmount.toLocaleString()}`,                                            "#ff3131"],
              ["2R Profit Target",   `₹${(riskAmount * 2).toLocaleString()}`,                                      "#00ff41"],
            ].map(([l, v, c]) => (
              <div key={l} className="flex justify-between border-b border-base-300 pb-2">
                <span style={{ fontSize: 12, color: "#666", fontFamily: mono }}>{l}</span>
                <span style={{ fontSize: 12, color: c, fontFamily: mono, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="EDGE ANALYSIS" accent="#00aaff">
          <div className="flex flex-col gap-3">
            {[
              ["Win Rate",          `${winRate}%`,         winRate >= 60 ? "#00ff41" : "#ffd700"    ],
              ["Win/Loss Ratio",    winLossRatio.toFixed(2), winLossRatio >= 1.5 ? "#00ff41" : "#ffd700"],
              ["Profit Factor",     profitFactor,           profitFactor >= 1.5 ? "#00ff41" : "#ffd700"],
              ["Expected Value",    `₹${Number(ev).toLocaleString()}`, Number(ev) > 0 ? "#00ff41" : "#ff3131"],
              ["Full Kelly %",      `${kelly}%`,            "#00aaff"                                ],
              ["Half Kelly (Rec.)", `${halfKelly}%`,        "#00ff41"                                ],
            ].map(([l, v, c]) => (
              <div key={l} className="flex justify-between border-b border-base-300 pb-2">
                <span style={{ fontSize: 12, color: "#666", fontFamily: mono }}>{l}</span>
                <span style={{ fontSize: 12, color: c, fontFamily: mono, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="alert alert-warning py-2 mt-3" style={{ fontFamily: mono, fontSize: 11 }}>
            ⚠️ Never risk more than 2% per trade. Use Half Kelly for real trading.
          </div>
        </Panel>
      </div>
    </div>
  )
}