import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar } from "recharts";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function Tile({ label, value, color, sub }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "10px 14px" }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: mono }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 10, color: T.textFaint, fontFamily: mono }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: mono }}>{value}</span>
    </div>
  );
}

export default function ClientsPage({ compare }) {
  const [tab, setTab] = useState("QUANT");
  if (!compare) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: T.textFaint, fontFamily: mono, fontSize: 12 }}>
      Loading client data...
    </div>
  );

  const { quant_stats: qs, macro_stats: ms, chart_data, alpha } = compare;
  const chartThin = (chart_data || []).filter((_, i) => i % 4 === 0);
  const tradeData = tab === "QUANT" ? compare.quant_trades : compare.macro_trades;

  const barData = [
    { metric: "Return %",   QUANT: qs?.total_return,  MACRO: ms?.total_return  },
    { metric: "Win Rate %", QUANT: qs?.win_rate,      MACRO: ms?.win_rate      },
    { metric: "Max DD %",   QUANT: qs?.max_drawdown,  MACRO: ms?.max_drawdown  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Portfolio Comparison</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Dual Client Engine</h1>
      </div>

      {/* Top: QUANT | VS | MACRO stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "start" }}>

        {/* QUANT */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.green, fontFamily: mono, letterSpacing: "2px" }}>QUANT</div>
            <div style={{ fontSize: 9, color: T.green, fontFamily: mono, border: `1px solid ${T.green}`, borderRadius: T.rSm, padding: "2px 8px" }}>AGGRESSIVE</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <Tile label="Return"     value={`+${qs?.total_return}%`}                            color={T.green} />
            <Tile label="Win Rate"   value={`${qs?.win_rate}%`}                                 color={T.mint} />
            <Tile label="Final"      value={`₹${qs?.final_value?.toLocaleString("en-IN")}`}    color={T.green} />
            <Tile label="Max DD"     value={`-${qs?.max_drawdown}%`}                            color={T.red} />
          </div>
          <Row label="Threshold" value="≥ 55%" color={T.green} />
          <Row label="Position"  value="95% capital" color={T.text} />
          <Row label="Stop Loss" value="3%" color={T.red} />
          <Row label="Max Hold"  value="30 days" color={T.textDim} />
        </div>

        {/* VS + Alpha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", padding: "0 8px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "rgba(255,255,255,0.1)", fontFamily: mono }}>VS</div>
          {[
            { label: "QUANT α", value: `+${alpha?.quant_vs_nsei}%`, color: T.green },
            { label: "MACRO α", value: `+${alpha?.macro_vs_nsei}%`, color: T.blue },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "10px 16px", textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 8, color: T.textFaint, fontFamily: mono, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>{label} vs NSEI</div>
              <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: mono }}>{value}</div>
            </div>
          ))}
        </div>

        {/* MACRO */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.blue}`, borderRadius: T.rLg, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.blue, fontFamily: mono, letterSpacing: "2px" }}>MACRO</div>
            <div style={{ fontSize: 9, color: T.blue, fontFamily: mono, border: `1px solid ${T.blue}`, borderRadius: T.rSm, padding: "2px 8px" }}>CONSERVATIVE</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <Tile label="Return"   value={`+${ms?.total_return}%`}                            color={T.green} />
            <Tile label="Win Rate" value={`${ms?.win_rate}%`}                                 color={T.mint} />
            <Tile label="Final"    value={`₹${ms?.final_value?.toLocaleString("en-IN")}`}    color={T.blue} />
            <Tile label="Max DD"   value={`-${ms?.max_drawdown}%`}                            color={T.red} />
          </div>
          <Row label="Threshold" value="≥ 65%" color={T.blue} />
          <Row label="Position"  value="60% capital" color={T.text} />
          <Row label="Stop Loss" value="1.5%" color={T.red} />
          <Row label="Max Hold"  value="15 days" color={T.textDim} />
        </div>
      </div>

      {/* Charts + trade log */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>

        {/* Equity curve */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 10 }}>Equity Curve vs NSEI</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartThin}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={d => d?.slice(2,7)} />
              <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={44} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, fontFamily: mono, fontSize: 10 }} />
              <ReferenceLine y={100000} stroke={T.border} strokeDasharray="4 4" />
              <Legend wrapperStyle={{ fontFamily: mono, fontSize: 10 }} />
              <Line type="monotone" dataKey="QUANT" stroke={T.green}  strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="MACRO" stroke={T.blue}   strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="NSEI"  stroke={T.purple} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Head to head + trade log */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Bar chart */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.purple}`, borderRadius: T.rLg, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: T.purple, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>Head to Head</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 8, fill: T.textFaint, fontFamily: mono }} />
                <YAxis dataKey="metric" type="category" tick={{ fontSize: 8, fill: T.textDim, fontFamily: mono }} width={60} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, fontFamily: mono, fontSize: 10 }} />
                <Bar dataKey="QUANT" fill={T.green} fillOpacity={0.8} radius={[0,2,2,0]} />
                <Bar dataKey="MACRO" fill={T.blue}  fillOpacity={0.8} radius={[0,2,2,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trade log */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.amber}`, borderRadius: T.rLg, padding: "10px 14px", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: T.amber, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>Trade Log</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["QUANT","MACRO"].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: "2px 8px", background: tab === t ? (t==="QUANT"?T.green:T.blue) : "transparent",
                    color: tab === t ? T.bg : (t==="QUANT"?T.green:T.blue),
                    border: `1px solid ${t==="QUANT"?T.green:T.blue}`, borderRadius: T.rSm,
                    fontFamily: mono, fontSize: 9, cursor: "pointer", fontWeight: 700,
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 120, overflowY: "auto" }}>
              {(tradeData||[]).slice(-8).map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 40px 1fr 80px", gap: 6, padding: "4px 0", borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: T.textFaint, fontFamily: mono }}>{t.date?.slice(5)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: t.action==="BUY"?T.green:T.red, fontFamily: mono }}>{t.action}</span>
                  <span style={{ fontSize: 9, color: T.textDim, fontFamily: mono }}>₹{Number(t.price)?.toLocaleString("en-IN")}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: t.pnl>0?T.green:t.pnl<0?T.red:T.textFaint, fontFamily: mono, textAlign: "right" }}>
                    {t.pnl!==0?`${t.pnl>0?"+":""}₹${Number(t.pnl)?.toLocaleString("en-IN")}`:"—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}