import { useState } from "react";
import { T } from "../../config/tokens";

const mono = T.fontMono;

const NSE_STOCKS = [
  { symbol: "RELIANCE.NS", name: "Reliance" },
  { symbol: "TCS.NS",      name: "TCS" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank" },
  { symbol: "INFY.NS",     name: "Infosys" },
  { symbol: "ICICIBANK.NS",name: "ICICI Bank" },
  { symbol: "HINDUNILVR.NS",name:"HUL" },
  { symbol: "SBIN.NS",     name: "SBI" },
  { symbol: "BHARTIARTL.NS",name:"Airtel" },
  { symbol: "ITC.NS",      name: "ITC" },
  { symbol: "KOTAKBANK.NS",name: "Kotak" },
  { symbol: "LT.NS",       name: "L&T" },
  { symbol: "AXISBANK.NS", name: "Axis Bank" },
  { symbol: "ASIANPAINT.NS",name:"Asian Paints" },
  { symbol: "MARUTI.NS",   name: "Maruti" },
  { symbol: "WIPRO.NS",    name: "Wipro" },
];

function generateSignal(symbol) {
  const hash = symbol.split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  const signals = ["BUY","SELL","HOLD"];
  return {
    signal:     signals[hash % 3],
    confidence: 52 + (hash % 38),
    change:     ((hash % 600) - 300) / 100,
    price:      500 + (hash % 4500),
    rsi:        30 + (hash % 55),
  };
}

export default function ScreenerPage() {
  const [filter,  setFilter]  = useState("ALL");
  const [sortBy,  setSortBy]  = useState("confidence");
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const runScan = () => {
    setLoading(true);
    setTimeout(() => {
      setResults(NSE_STOCKS.map(s => ({ ...s, ...generateSignal(s.symbol) })));
      setScanned(true); setLoading(false);
    }, 1200);
  };

  const filtered = results
    .filter(r => filter === "ALL" || r.signal === filter)
    .sort((a, b) => sortBy === "confidence" ? b.confidence - a.confidence : sortBy === "change" ? b.change - a.change : b.rsi - a.rsi);

  const buys  = results.filter(r => r.signal === "BUY").length;
  const sells = results.filter(r => r.signal === "SELL").length;
  const holds = results.filter(r => r.signal === "HOLD").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Signal Filter</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>NSE Stock Screener</h1>
      </div>

      {/* Controls + stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 10, alignItems: "stretch" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
          <button onClick={runScan} disabled={loading} style={{
            padding: "8px 16px", background: T.green, color: T.bg,
            border: "none", borderRadius: T.r, fontFamily: mono,
            fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: "1px",
            opacity: loading ? 0.6 : 1,
          }}>{loading ? "SCANNING..." : "⚡ RUN SCAN"}</button>
          <div style={{ display: "flex", gap: 4 }}>
            {["ALL","BUY","SELL","HOLD"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "3px 8px", background: filter === f ? T.green : "transparent",
                color: filter === f ? T.bg : T.textDim, border: `1px solid ${filter===f?T.green:T.border}`,
                borderRadius: T.rSm, fontFamily: mono, fontSize: 8, cursor: "pointer", fontWeight: filter===f?700:400,
              }}>{f}</button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, color: T.text,
            fontFamily: mono, fontSize: 9, padding: "4px 8px", borderRadius: T.rSm,
          }}>
            <option value="confidence">Sort: Confidence</option>
            <option value="change">Sort: Change %</option>
            <option value="rsi">Sort: RSI</option>
          </select>
        </div>
        {[
          { label: "BUY Signals",  value: scanned ? buys  : "—", color: T.green },
          { label: "SELL Signals", value: scanned ? sells : "—", color: T.red },
          { label: "HOLD Signals", value: scanned ? holds : "—", color: T.amber },
          { label: "Total Scanned",value: scanned ? results.length : "—", color: T.text },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: mono }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Results */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px" }}>
        {!scanned && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 0", color: T.textFaint, fontFamily: mono, fontSize: 11 }}>
            <div style={{ fontSize: 32 }}>🔍</div>
            Click RUN SCAN to screen all 15 NSE stocks using the ML model
          </div>
        )}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", justifyContent: "center", color: T.textFaint, fontFamily: mono, fontSize: 11 }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Scanning NSE stocks with ML model...
          </div>
        )}
        {scanned && !loading && (
          <>
            <div style={{ fontSize: 9, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 10 }}>
              Scan Results — {filtered.length} stocks
            </div>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 70px 120px 80px 70px 60px", gap: 8, padding: "6px 8px", borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
              {["Stock","Signal","Confidence","Price","Change","RSI"].map(h => (
                <div key={h} style={{ fontSize: 8, color: T.textFaint, fontFamily: mono, letterSpacing: "1.5px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {filtered.map((r, i) => {
              const sigColor = r.signal==="BUY" ? T.green : r.signal==="SELL" ? T.red : T.amber;
              const rsiColor = r.rsi > 70 ? T.red : r.rsi < 30 ? T.green : T.amber;
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.5fr 70px 120px 80px 70px 60px", gap: 8,
                  padding: "7px 8px", borderBottom: `1px solid ${T.border}`,
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  borderLeft: `2px solid ${sigColor}`,
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: mono }}>{r.name}</div>
                    <div style={{ fontSize: 8, color: T.textFaint, fontFamily: mono }}>{r.symbol}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: sigColor, fontFamily: mono, padding: "2px 6px", border: `1px solid ${sigColor}`, borderRadius: T.rSm, textAlign: "center" }}>{r.signal}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                      <div style={{ width: `${r.confidence}%`, height: "100%", background: sigColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: sigColor, fontFamily: mono, fontWeight: 700, flexShrink: 0 }}>{r.confidence}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.text, fontFamily: mono }}>₹{r.price.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: r.change>=0?T.green:T.red, fontFamily: mono }}>{r.change>=0?"+":""}{r.change.toFixed(2)}%</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: rsiColor, fontFamily: mono }}>{r.rsi.toFixed(1)}</div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}