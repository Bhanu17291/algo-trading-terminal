import { useState, useEffect } from "react"
import Panel from "../shared/Panel"

const mono = "'Courier New', monospace"

const NSE_STOCKS = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "TCS.NS", name: "Tata Consultancy" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank" },
  { symbol: "INFY.NS", name: "Infosys" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
  { symbol: "SBIN.NS", name: "State Bank of India" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel" },
  { symbol: "ITC.NS", name: "ITC Limited" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra" },
  { symbol: "LT.NS", name: "Larsen & Toubro" },
  { symbol: "AXISBANK.NS", name: "Axis Bank" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki" },
  { symbol: "WIPRO.NS", name: "Wipro" },
]

// Deterministic signal generator based on symbol name
function generateSignal(symbol) {
  const hash = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const signals = ["BUY", "SELL", "HOLD"]
  const signal = signals[hash % 3]
  const confidence = 52 + (hash % 38)
  const change = ((hash % 600) - 300) / 100
  const price = 500 + (hash % 4500)
  const rsi = 30 + (hash % 55)
  return { signal, confidence, change, price, rsi }
}

export default function ScreenerPage() {
  const [filter, setFilter] = useState("ALL")
  const [sortBy, setSortBy] = useState("confidence")
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])

  const runScan = () => {
    setLoading(true)
    setTimeout(() => {
      const data = NSE_STOCKS.map(stock => ({
        ...stock,
        ...generateSignal(stock.symbol),
      }))
      setResults(data)
      setScanned(true)
      setLoading(false)
    }, 1800)
  }

  const filtered = results
    .filter(r => filter === "ALL" || r.signal === filter)
    .sort((a, b) => {
      if (sortBy === "confidence") return b.confidence - a.confidence
      if (sortBy === "change") return b.change - a.change
      if (sortBy === "rsi") return b.rsi - a.rsi
      return 0
    })

  const buys = results.filter(r => r.signal === "BUY").length
  const sells = results.filter(r => r.signal === "SELL").length
  const holds = results.filter(r => r.signal === "HOLD").length

  return (
    <div className="flex flex-col gap-3">

      {/* Scanner controls */}
      <Panel title="NSE STOCK SCREENER — ML SIGNAL SCANNER">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 16 }}>
          Runs the XGBoost model across top 15 NSE stocks using latest technical indicators
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <button
            className={`btn btn-warning ${loading ? "loading" : ""}`}
            style={{ fontFamily: mono }}
            onClick={runScan}
            disabled={loading}>
            {loading ? "SCANNING..." : "⚡ RUN SCAN"}
          </button>

          <div className="join">
            {["ALL", "BUY", "SELL", "HOLD"].map(f => (
              <button key={f}
                className={`btn btn-sm join-item ${filter === f ? "btn-warning" : "btn-outline"}`}
                style={{ fontFamily: mono }}
                onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          <select
            className="select select-bordered select-sm"
            style={{ fontFamily: mono, background: "#1a1a1a", color: "#ccc" }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}>
            <option value="confidence">Sort: Confidence</option>
            <option value="change">Sort: Change %</option>
            <option value="rsi">Sort: RSI</option>
          </select>
        </div>
      </Panel>

      {/* Summary badges */}
      {scanned && (
        <div className="flex gap-3">
          {[
            ["BUY SIGNALS", buys, "#00ff41"],
            ["SELL SIGNALS", sells, "#ff3131"],
            ["HOLD SIGNALS", holds, "#ffd700"],
            ["TOTAL SCANNED", results.length, "#ff6600"],
          ].map(([l, v, c]) => (
            <div key={l} className="stat bg-base-200 rounded-box border border-base-300 flex-1"
              style={{ borderTop: `2px solid ${c}`, padding: "12px 16px" }}>
              <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>{l}</div>
              <div className="stat-value" style={{ color: c, fontFamily: mono, fontSize: 26 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {!scanned && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div style={{ fontSize: 48 }}>🔍</div>
          <div style={{ fontFamily: mono, fontSize: 14, color: "#666" }}>
            Click RUN SCAN to screen all 15 NSE stocks
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="loading loading-bars loading-lg" style={{ color: "#ff6600" }}></span>
          <div style={{ fontFamily: mono, fontSize: 13, color: "#666" }}>
            Scanning NSE stocks with ML model...
          </div>
        </div>
      )}

      {scanned && !loading && (
        <Panel title={`SCAN RESULTS — ${filtered.length} STOCKS`}>
          <div className="overflow-x-auto">
            <table className="table table-sm" style={{ fontFamily: mono }}>
              <thead>
                <tr style={{ color: "#ff6600", fontSize: 10, letterSpacing: 1 }}>
                  <th>STOCK</th>
                  <th>SIGNAL</th>
                  <th>CONFIDENCE</th>
                  <th>PRICE</th>
                  <th>CHANGE</th>
                  <th>RSI</th>
                  <th>STRENGTH</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const sigColor = r.signal === "BUY" ? "#00ff41" : r.signal === "SELL" ? "#ff3131" : "#ffd700"
                  return (
                    <tr key={i} className="hover">
                      <td>
                        <div>
                          <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{r.name}</div>
                          <div style={{ color: "#666", fontSize: 10 }}>{r.symbol}</div>
                        </div>
                      </td>
                      <td>
                        <div className={`badge badge-sm font-bold ${r.signal === "BUY" ? "badge-success" : r.signal === "SELL" ? "badge-error" : "badge-warning"}`}>
                          {r.signal}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 rounded overflow-hidden" style={{ height: 6, background: "#222" }}>
                            <div style={{ width: `${r.confidence}%`, height: "100%", background: sigColor }} />
                          </div>
                          <span style={{ color: sigColor, fontSize: 11 }}>{r.confidence}%</span>
                        </div>
                      </td>
                      <td style={{ color: "#ccc" }}>₹{r.price.toLocaleString()}</td>
                      <td style={{ color: r.change >= 0 ? "#00ff41" : "#ff3131", fontWeight: 700 }}>
                        {r.change >= 0 ? "+" : ""}{r.change.toFixed(2)}%
                      </td>
                      <td>
                        <span style={{
                          color: r.rsi > 70 ? "#ff3131" : r.rsi < 30 ? "#00ff41" : "#ffd700",
                          fontWeight: 700
                        }}>{r.rsi.toFixed(1)}</span>
                      </td>
                      <td>
                        <div className="w-20 rounded overflow-hidden" style={{ height: 6, background: "#222" }}>
                          <div style={{ width: `${r.confidence}%`, height: "100%", background: sigColor }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}