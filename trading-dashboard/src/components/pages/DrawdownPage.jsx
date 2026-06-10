import { XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar } from "recharts";
import Panel from "../shared/Panel";
import ChartTooltip from "../shared/ChartTooltip";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function calcDrawdown(portfolioArr) {
  let peak = 0;
  return (portfolioArr || []).map(row => {
    const val = Number(row.value) || 0;
    if (val > peak) peak = val;
    const dd = peak > 0 ? parseFloat(((val - peak) / peak * 100).toFixed(2)) : 0;
    return { date: row.date?.slice(2, 7), drawdown: dd, value: val };
  });
}

function safeMin(arr) {
  if (!arr || arr.length === 0) return 0;
  const vals = arr.map(d => d.drawdown).filter(v => isFinite(v));
  return vals.length ? Math.min(...vals) : 0;
}

function safeWorstLoss(trades) {
  if (!trades || trades.length === 0) return 0;
  const losses = trades.map(t => Number(t.pnl)).filter(v => isFinite(v));
  return losses.length ? Math.min(...losses) : 0;
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: mono }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function DrawdownPage({ portfolio, trades, compare }) {
  const strategyDD = calcDrawdown(portfolio);
  const quantDD    = calcDrawdown(compare?.quant_portfolio);
  const macroDD    = calcDrawdown(compare?.macro_portfolio);

  const combinedDD = strategyDD.map((row, i) => ({
    date:     row.date,
    STRATEGY: row.drawdown,
    QUANT:    quantDD[i]?.drawdown ?? null,
    MACRO:    macroDD[i]?.drawdown ?? null,
  })).filter((_, i) => i % 3 === 0);

  const minStrategy = safeMin(strategyDD);
  const minQuant    = safeMin(quantDD);
  const minMacro    = safeMin(macroDD);

  const sells      = (trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0);
  const quantSells = (compare?.quant_trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0);
  const macroSells = (compare?.macro_trades || []).filter(t => t.action === "SELL" && Number(t.pnl) < 0);

  const fmt = v => isFinite(v) && v !== 0 ? `₹${Number(v).toLocaleString("en-IN")}` : "₹0";

  const tableRows = [
    ["Max Drawdown",  `${minStrategy.toFixed(2)}%`, `${minQuant.toFixed(2)}%`, `${minMacro.toFixed(2)}%`, T.red],
    ["Losing Trades", sells.length,                  quantSells.length,         macroSells.length,         T.purple],
    ["Worst Loss",    fmt(safeWorstLoss(sells)),      fmt(safeWorstLoss(quantSells)), fmt(safeWorstLoss(macroSells)), T.red],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Risk Analysis</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Drawdown</h1>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <StatCard label="Strategy Max DD" value={`${minStrategy.toFixed(2)}%`} color={T.red}   sub={`${sells.length} losing trades`} />
        <StatCard label="QUANT Max DD"    value={`${minQuant.toFixed(2)}%`}    color={T.amber} sub={`${quantSells.length} losing trades`} />
        <StatCard label="MACRO Max DD"    value={`${minMacro.toFixed(2)}%`}    color={T.blue}  sub={`${macroSells.length} losing trades`} />
      </div>

      {/* Chart + table side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        <Panel title="Drawdown Comparison" accent={T.red}>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, marginBottom: 8 }}>
            % decline from all-time peak · -5% = danger zone
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={combinedDD}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} />
              <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `${v}%`} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0}  stroke={T.border} strokeDasharray="4 4" />
              <ReferenceLine y={-5} stroke={T.red} strokeDasharray="2 2" label={{ value: "-5%", fill: T.red, fontSize: 9 }} />
              <Legend wrapperStyle={{ fontFamily: mono, fontSize: 10 }} />
              <Line type="monotone" dataKey="STRATEGY" stroke={T.red}   strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="QUANT"    stroke={T.amber} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="MACRO"    stroke={T.blue}  strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Side by Side Analysis" accent={T.red}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "8px 10px", borderBottom: `1px solid ${T.border}` }}>
              {["Metric", "Strategy", "QUANT", "MACRO"].map((h, i) => (
                <div key={h} style={{ fontSize: 9, color: [T.textFaint, T.red, T.amber, T.blue][i], fontFamily: mono, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {tableRows.map(([label, s, q, m, c]) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "8px 10px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textDim, fontFamily: mono }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: mono }}>{s}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: mono }}>{q}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: mono }}>{m}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Losing trades bar charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title="QUANT — Losing Trades" accent={T.amber}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={quantSells.map((t, i) => ({ trade: i + 1, loss: Number(t.pnl) }))}>
              <XAxis dataKey="trade" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} />
              <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(1)}k`} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke={T.border} />
              <Bar dataKey="loss" name="Loss" fill={T.amber} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="MACRO — Losing Trades" accent={T.blue}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={macroSells.map((t, i) => ({ trade: i + 1, loss: Number(t.pnl) }))}>
              <XAxis dataKey="trade" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} />
              <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(1)}k`} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke={T.border} />
              <Bar dataKey="loss" name="Loss" fill={T.blue} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

    </div>
  );
}