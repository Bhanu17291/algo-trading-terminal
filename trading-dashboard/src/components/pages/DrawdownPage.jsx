import { XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function calcDrawdown(arr) {
  let peak = 0;
  return (arr || []).map(row => {
    const val = Number(row.value) || 0;
    if (val > peak) peak = val;
    const dd = peak > 0 ? parseFloat(((val - peak) / peak * 100).toFixed(2)) : 0;
    return { date: row.date?.slice(5, 10), drawdown: dd };
  });
}

function safeMin(arr) {
  const vals = (arr || []).map(d => d.drawdown).filter(v => isFinite(v));
  return vals.length ? Math.min(...vals) : 0;
}

function safeWorstLoss(trades) {
  const losses = (trades || []).filter(t => t.action === "SELL").map(t => Number(t.pnl)).filter(v => isFinite(v) && v < 0);
  return losses.length ? Math.min(...losses) : 0;
}

function Tile({ label, value, color, sub }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "12px 16px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: mono, letterSpacing: "-0.5px" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono }}>{sub}</div>}
    </div>
  );
}

export default function DrawdownPage({ portfolio, trades, compare, showHeader = true }) {
  const stratDD = calcDrawdown(portfolio);
  const quantDD = calcDrawdown(compare?.quant_portfolio);
  const macroDD = calcDrawdown(compare?.macro_portfolio);

  const minS = safeMin(stratDD);
  const minQ = safeMin(quantDD);
  const minM = safeMin(macroDD);

  const sells  = (trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0);
  const qSells = (compare?.quant_trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0);
  const mSells = (compare?.macro_trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0);

  const fmt = v => isFinite(v) && v !== 0 ? `₹${Math.abs(Number(v)).toLocaleString("en-IN")}` : "₹0";

  // Combine & thin data
  const combined = stratDD.map((r, i) => ({
    date: r.date, STRATEGY: r.drawdown,
    QUANT: quantDD[i]?.drawdown ?? null,
    MACRO: macroDD[i]?.drawdown ?? null,
  })).filter((_, i) => i % 4 === 0);

  const tableRows = [
    { label: "Max Drawdown",  s: `${minS.toFixed(2)}%`, q: `${minQ.toFixed(2)}%`, m: `${minM.toFixed(2)}%`, color: T.red },
    { label: "Losing Trades", s: sells.length,           q: qSells.length,         m: mSells.length,          color: T.purple },
    { label: "Worst Loss",    s: fmt(safeWorstLoss(sells)), q: fmt(safeWorstLoss(qSells)), m: fmt(safeWorstLoss(mSells)), color: T.red },
    { label: "Avg Loss",
      s: sells.length ? fmt(sells.reduce((a,t)=>a+Number(t.pnl),0)/sells.length) : "₹0",
      q: qSells.length ? fmt(qSells.reduce((a,t)=>a+Number(t.pnl),0)/qSells.length) : "₹0",
      m: mSells.length ? fmt(mSells.reduce((a,t)=>a+Number(t.pnl),0)/mSells.length) : "₹0",
      color: T.amber },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>

      {/* Header */}
      {showHeader && (
        <div>
          <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Risk Analysis</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Drawdown</h1>
        </div>
      )}

      {/* 6 stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        <Tile label="Strategy Max DD" value={`${minS.toFixed(2)}%`} color={T.red} />
        <Tile label="QUANT Max DD"    value={`${minQ.toFixed(2)}%`} color={T.amber} />
        <Tile label="MACRO Max DD"    value={`${minM.toFixed(2)}%`} color={T.blue} />
        <Tile label="Strategy Losses" value={sells.length}           color={T.red} />
        <Tile label="QUANT Losses"    value={qSells.length}          color={T.amber} />
        <Tile label="MACRO Losses"    value={mSells.length}          color={T.blue} />
      </div>

      {/* Main content: chart left, table right */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>

        {/* Chart */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderTop: `2px solid ${T.red}`, borderRadius: T.rLg, padding: "14px 16px",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ fontSize: 10, color: T.red, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
            Drawdown Comparison
          </div>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, marginBottom: 10 }}>
            % decline from all-time peak · red line = -5% danger zone
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={combined}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} />
                <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `${v}%`} width={36} />
                <Tooltip formatter={(v, n) => [`${v}%`, n]} labelStyle={{ fontFamily: mono, fontSize: 10 }} contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, fontFamily: mono, fontSize: 10 }} />
                <ReferenceLine y={0}  stroke={T.border} strokeDasharray="4 4" />
                <ReferenceLine y={-5} stroke={T.red} strokeDasharray="2 2" label={{ value: "-5% DANGER", fill: T.red, fontSize: 9 }} />
                <Legend wrapperStyle={{ fontFamily: mono, fontSize: 10 }} />
                <Line type="monotone" dataKey="STRATEGY" stroke={T.red}   strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="QUANT"    stroke={T.amber} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="MACRO"    stroke={T.blue}  strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analysis table */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderTop: `2px solid ${T.purple}`, borderRadius: T.rLg, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 10, color: T.purple, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>Analysis</div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 4, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
            {[["Metric", T.textFaint], ["Strategy", T.red], ["QUANT", T.amber], ["MACRO", T.blue]].map(([h, c]) => (
              <div key={h} style={{ fontSize: 8, color: c, fontFamily: mono, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {tableRows.map(({ label, s, q, m, color }) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 4, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.textDim, fontFamily: mono }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: mono }}>{s}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: mono }}>{q}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: mono }}>{m}</div>
            </div>
          ))}

          {/* Risk levels */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>Risk Levels</div>
            {[
              { label: "Safe",    range: "0% to -2%",   color: T.green },
              { label: "Caution", range: "-2% to -5%",  color: T.amber },
              { label: "Danger",  range: "-5% to -10%", color: T.red },
              { label: "Critical",range: "Below -10%",  color: "#dc2626" },
            ].map(({ label, range, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", marginBottom: 4, background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`, borderLeft: `2px solid ${color}`, borderRadius: T.r }}>
                <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: mono }}>{label}</span>
                <span style={{ fontSize: 10, color: T.textFaint, fontFamily: mono }}>{range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}