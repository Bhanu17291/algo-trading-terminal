import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import Panel from "../shared/Panel";
import ChartTooltip from "../shared/ChartTooltip";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${color}`, borderRadius: T.rLg,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: mono, letterSpacing: "-0.5px" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const REF = [
  { title: "RSI-14",         color: T.blue,   desc: "Above 70 = overbought · Below 30 = oversold · Crossovers signal trend changes" },
  { title: "Bollinger Bands",color: T.red,    desc: "Price envelopes 2σ from SMA-20 · Squeeze = breakout incoming · Touch = reversal" },
  { title: "SMA-20",         color: T.amber,  desc: "Short-term trend · Price above = bullish bias · Fast moving average" },
  { title: "SMA-50",         color: T.blue,   desc: "Medium-term trend · SMA20 cross above SMA50 = golden cross (bullish)" },
  { title: "BB Width",       color: T.mint,   desc: "High = volatile · Low = consolidating · Breakouts follow squeezes" },
  { title: "BB Position",    color: T.purple, desc: "0 = at lower band · 1 = at upper band · ML mean-reversion feature" },
];

export default function IndicatorsPage({ indicators, showHeader = true }) {
  const latest = indicators?.[indicators.length - 1];
  const rsi    = latest?.rsi;
  const rsiColor = rsi > 70 ? T.red : rsi < 30 ? T.green : T.blue;
  const rsiStatus = rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral";

  // Sample every 3rd point to reduce chart density
  const chartData = indicators?.filter((_, i) => i % 2 === 0) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Page header */}
      {showHeader && (
        <div>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Analysis</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Indicators</h1>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatCard label="RSI-14" value={rsi?.toFixed(1)} color={rsiColor} sub={rsiStatus} />
        <StatCard label="Price"  value={latest?.Close ? `₹${Number(latest.Close).toLocaleString("en-IN")}` : latest?.close ? `₹${Number(latest.close).toLocaleString("en-IN")}` : "—"} color={T.text} />
        <StatCard label="SMA 20" value={latest?.sma20 ? `₹${Number(latest.sma20).toLocaleString("en-IN")}` : "—"} color={T.amber} />
        <StatCard label="SMA 50" value={latest?.sma50 ? `₹${Number(latest.sma50).toLocaleString("en-IN")}` : "—"} color={T.blue} />
      </div>

      {/* Charts side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title="RSI-14 Momentum" accent={T.blue}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={d => d?.slice(5, 10)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={70} stroke={T.red}   strokeDasharray="3 3" label={{ value: "70", fill: T.red,   fontSize: 9 }} />
              <ReferenceLine y={50} stroke={T.border} strokeDasharray="2 2" />
              <ReferenceLine y={30} stroke={T.green} strokeDasharray="3 3" label={{ value: "30", fill: T.green, fontSize: 9 }} />
              <Line type="monotone" dataKey="rsi" stroke={T.blue} strokeWidth={2} dot={false} name="RSI" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Bollinger Bands + SMA" accent={T.amber}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={d => d?.slice(5, 10)} />
              <YAxis tick={{ fontSize: 9, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} domain={["auto","auto"]} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="bb_upper" stroke={T.red}   strokeWidth={1} dot={false} strokeDasharray="4 4" name="BB Upper" />
              <Line type="monotone" dataKey="bb_lower" stroke={T.green} strokeWidth={1} dot={false} strokeDasharray="4 4" name="BB Lower" />
              <Line type="monotone" dataKey="sma20"    stroke={T.amber} strokeWidth={1.5} dot={false} name="SMA 20" />
              <Line type="monotone" dataKey="sma50"    stroke={T.blue}  strokeWidth={1.5} dot={false} name="SMA 50" />
              <Line type="monotone" dataKey="Close"    stroke={T.text}  strokeWidth={2}   dot={false} name="Price" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {[["BB Upper", T.red], ["BB Lower", T.green], ["SMA 20", T.amber], ["SMA 50", T.blue], ["Price", T.text]].map(([l, c]) => (
              <span key={l} style={{ fontSize: 9, color: c, fontFamily: mono }}>— {l}</span>
            ))}
          </div>
        </Panel>
      </div>

      {/* Reference guide as compact cards */}
      <Panel title="Indicator Reference" accent={T.green}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {REF.map(({ title, color, desc }) => (
            <div key={title} style={{
              background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`,
              borderLeft: `2px solid ${color}`, borderRadius: T.r, padding: "10px 12px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: mono, letterSpacing: "0.5px", marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.6, fontFamily: mono }}>{desc}</div>
            </div>
          ))}
        </div>
      </Panel>

    </div>
  );
}