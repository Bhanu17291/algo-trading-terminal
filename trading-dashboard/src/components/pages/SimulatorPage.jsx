import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function scalePortfolio(arr, capital) {
  const ratio = capital / 100000;
  return (arr || []).map(row => ({ date: row.date?.slice(5, 10), value: Math.round(row.value * ratio) }));
}

function Tile({ label, value, color, sub }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: mono }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const PRESETS = [50000, 100000, 250000, 500000, 1000000];

export default function SimulatorPage({ portfolio, compare }) {
  const [capital,  setCapital]  = useState(100000);
  const [inputVal, setInputVal] = useState("100000");
  const [mode,     setMode]     = useState("ALL");

  const stratData = scalePortfolio(portfolio, capital);
  const quantData = scalePortfolio(compare?.quant_portfolio, capital);
  const macroData = scalePortfolio(compare?.macro_portfolio, capital);

  const combined = stratData.map((r, i) => ({
    date: r.date, STRATEGY: r.value,
    QUANT: quantData[i]?.value ?? null,
    MACRO: macroData[i]?.value ?? null,
  })).filter((_, i) => i % 3 === 0);

  const stratFinal = stratData[stratData.length - 1]?.value || 0;
  const quantFinal = quantData[quantData.length - 1]?.value || 0;
  const macroFinal = macroData[macroData.length - 1]?.value || 0;

  const applyCapital = () => {
    const v = parseInt(inputVal);
    if (!isNaN(v) && v >= 1000) setCapital(v);
  };

  const results = [
    { label: "STRATEGY", final: stratFinal, color: T.red   },
    { label: "QUANT",    final: quantFinal, color: T.amber },
    { label: "MACRO",    final: macroFinal, color: T.blue  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Portfolio Scaling</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Capital Simulator</h1>
      </div>

      {/* Top row: input + result tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, alignItems: "stretch" }}>

        {/* Capital input card */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 10, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>Your Capital</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 18, color: T.green, fontFamily: mono, fontWeight: 700 }}>₹</span>
            <input
              type="number" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={applyCapital}
              onKeyDown={e => e.key === "Enter" && applyCapital()}
              style={{
                flex: 1, background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`,
                borderRadius: T.r, color: T.text, fontFamily: mono, fontSize: 14,
                padding: "6px 10px", outline: "none", width: "100%",
              }}
              min={1000}
            />
          </div>
          <button onClick={applyCapital} style={{
            padding: "7px", background: T.green, color: T.bg,
            border: "none", borderRadius: T.r, fontFamily: mono,
            fontSize: 10, fontWeight: 700, letterSpacing: "1px", cursor: "pointer",
          }}>SIMULATE →</button>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => { setCapital(p); setInputVal(String(p)); }} style={{
                padding: "3px 7px", background: capital === p ? T.green : "transparent",
                color: capital === p ? T.bg : T.textDim,
                border: `1px solid ${capital === p ? T.green : T.border}`,
                borderRadius: T.rSm, fontFamily: mono, fontSize: 9, cursor: "pointer",
              }}>₹{(p/1000).toFixed(0)}k</button>
            ))}
          </div>
        </div>

        {/* 3 result cards */}
        {results.map(({ label, final, color }) => {
          const profit = final - capital;
          const ret    = capital > 0 ? ((profit / capital) * 100).toFixed(2) : "0";
          return (
            <div key={label} style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: mono, letterSpacing: "1.5px" }}>{label}</div>
              <div>
                <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>Final Value</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.green, fontFamily: mono }}>₹{final.toLocaleString("en-IN")}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  ["Invested", `₹${capital.toLocaleString("en-IN")}`, T.text],
                  ["Profit",   `₹${profit.toLocaleString("en-IN")}`,  profit >= 0 ? T.green : T.red],
                  ["Return",   `+${ret}%`,                             color],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, textTransform: "uppercase" }}>{l}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: mono }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Equity curve */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px", flex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>
              Simulated Equity — ₹{capital.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 2 }}>
              Proportionally scaled from base backtests
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["ALL", "STRATEGY", "QUANT", "MACRO"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "4px 10px", background: mode === m ? T.green : "transparent",
                color: mode === m ? T.bg : T.textDim,
                border: `1px solid ${mode === m ? T.green : T.border}`,
                borderRadius: T.rSm, fontFamily: mono, fontSize: 9,
                fontWeight: mode === m ? 700 : 400, cursor: "pointer",
              }}>{m}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={combined}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} />
            <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={44} />
            <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, fontFamily: mono, fontSize: 10 }} formatter={v => [`₹${v.toLocaleString("en-IN")}`, ""]} />
            <ReferenceLine y={capital} stroke={T.border} strokeDasharray="4 4" label={{ value: "ENTRY", fill: T.textFaint, fontSize: 9 }} />
            <Legend wrapperStyle={{ fontFamily: mono, fontSize: 10 }} />
            {(mode==="ALL"||mode==="STRATEGY") && <Line type="monotone" dataKey="STRATEGY" stroke={T.red}   strokeWidth={2} dot={false} />}
            {(mode==="ALL"||mode==="QUANT")    && <Line type="monotone" dataKey="QUANT"    stroke={T.amber} strokeWidth={2} dot={false} />}
            {(mode==="ALL"||mode==="MACRO")    && <Line type="monotone" dataKey="MACRO"    stroke={T.blue}  strokeWidth={2} dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}