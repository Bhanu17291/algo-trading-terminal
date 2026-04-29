import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts"
import Panel from "../shared/Panel"
import ChartTooltip from "../shared/ChartTooltip"

const mono = "'Courier New', monospace"

export default function IndicatorsPage({ indicators }) {
  const latest = indicators?.[indicators.length - 1]

  return (
    <div className="flex flex-col gap-3">

      {/* Live indicator values */}
      <div className="grid grid-cols-4 gap-3">
        {[
          ["RSI-14", latest?.rsi?.toFixed(1), latest?.rsi > 70 ? "#ff3131" : latest?.rsi < 30 ? "#00ff41" : "#00aaff"],
          ["PRICE", `₹${latest?.Close?.toLocaleString()}`, "#ffffff"],
          ["SMA 20", `₹${latest?.sma20?.toLocaleString()}`, "#ffd700"],
          ["SMA 50", `₹${latest?.sma50?.toLocaleString()}`, "#00aaff"],
        ].map(([l, v, c]) => (
          <div key={l} className="stat bg-base-200 rounded-box border border-base-300"
            style={{ borderTop: `2px solid ${c}` }}>
            <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>{l}</div>
            <div className="stat-value" style={{ color: c, fontFamily: mono, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* RSI Chart */}
      <Panel title="RSI-14 MOMENTUM OSCILLATOR">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 10 }}>
          Above 70 = Overbought · Below 30 = Oversold · Crossovers signal trend changes
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={indicators}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={d => d?.slice(2, 7)} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={70} stroke="#ff3131" strokeDasharray="3 3" label={{ value: "OVERBOUGHT 70", fill: "#ff3131", fontSize: 10 }} />
            <ReferenceLine y={50} stroke="#444" strokeDasharray="2 2" />
            <ReferenceLine y={30} stroke="#00ff41" strokeDasharray="3 3" label={{ value: "OVERSOLD 30", fill: "#00ff41", fontSize: 10 }} />
            <Line type="monotone" dataKey="rsi" stroke="#00aaff" strokeWidth={2} dot={false} name="RSI-14" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Bollinger Bands */}
      <Panel title="BOLLINGER BANDS + SMA OVERLAY">
        <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 10 }}>
          Price touching upper band = Overbought · Lower band = Oversold · Band width = Volatility
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={indicators}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={d => d?.slice(2, 7)} />
            <YAxis tick={{ fontSize: 10, fill: "#666", fontFamily: mono }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="bb_upper" stroke="#ff3131" strokeWidth={1} dot={false} strokeDasharray="4 4" name="BB Upper" />
            <Line type="monotone" dataKey="bb_lower" stroke="#00ff41" strokeWidth={1} dot={false} strokeDasharray="4 4" name="BB Lower" />
            <Line type="monotone" dataKey="sma20" stroke="#ffd700" strokeWidth={1.5} dot={false} name="SMA 20" />
            <Line type="monotone" dataKey="sma50" stroke="#00aaff" strokeWidth={1.5} dot={false} name="SMA 50" />
            <Line type="monotone" dataKey="Close" stroke="#ffffff" strokeWidth={2} dot={false} name="Price" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-2" style={{ fontSize: 10, fontFamily: mono }}>
          {[["BB UPPER", "#ff3131"], ["BB LOWER", "#00ff41"], ["SMA 20", "#ffd700"], ["SMA 50", "#00aaff"], ["PRICE", "#fff"]].map(([l, c]) => (
            <span key={l} style={{ color: c }}>— {l}</span>
          ))}
        </div>
      </Panel>

      {/* Indicator reference */}
      <Panel title="INDICATOR REFERENCE GUIDE">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["RSI-14", "Relative Strength Index. Measures momentum. Above 70 = overbought, below 30 = oversold. Best used for mean-reversion entries."],
            ["Bollinger Bands", "Price envelopes 2 std deviations from SMA-20. Squeeze = low volatility breakout incoming. Touch = potential reversal."],
            ["SMA-20", "20-day Simple Moving Average. Short-term trend direction. Price above = bullish bias."],
            ["SMA-50", "50-day Simple Moving Average. Medium-term trend. SMA20 crossing above SMA50 = golden cross (bullish)."],
            ["BB Width", "Measures band width relative to price. High = volatile, low = consolidating. Breakouts follow squeezes."],
            ["BB Position", "Where price sits within bands (0=lower, 1=upper). Used as a mean-reversion feature in the ML model."],
          ].map(([title, desc]) => (
            <div key={title} className="card bg-base-300 p-3 border border-base-300"
              style={{ borderLeft: "3px solid #ff6600" }}>
              <div style={{ fontSize: 11, color: "#ff6600", fontFamily: mono, fontWeight: 700, marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 11, color: "#999", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}