import Panel from "../shared/Panel"
import Metric from "../shared/Metric"

const mono = "'Courier New', monospace"

export default function ExplainerPage({ shap }) {
  if (!shap) return (
    <div className="flex items-center justify-center h-64">
      <span className="loading loading-spinner loading-lg" style={{ color: "#ff6600" }}></span>
    </div>
  )

  const classMap = { 0: { label: "SELL", color: "#ff3131" }, 1: { label: "HOLD", color: "#ffd700" }, 2: { label: "BUY", color: "#00ff41" } }
  const predicted = classMap[shap.predicted_class] || { label: "HOLD", color: "#ffd700" }
  const maxAbs = Math.max(...shap.latest_signal_explanation.map(f => f.abs_value))
  const maxGlobal = Math.max(...shap.global_importance.map(f => f.importance))

  return (
    <div className="flex flex-col gap-3">

      {/* Header cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat bg-base-200 rounded-box border border-base-300"
          style={{ borderLeft: `4px solid ${predicted.color}` }}>
          <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>CURRENT PREDICTION</div>
          <div className="stat-value" style={{ color: predicted.color, fontFamily: mono }}>{predicted.label}</div>
          <div className="stat-desc" style={{ fontFamily: mono }}>XGBoost class {shap.predicted_class}</div>
        </div>
        <div className="stat bg-base-200 rounded-box border border-base-300"
          style={{ borderLeft: `4px solid #ff6600` }}>
          <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>TOP SIGNAL DRIVER</div>
          <div className="stat-value" style={{ color: "#ff6600", fontFamily: mono, fontSize: 22 }}>
            {shap.latest_signal_explanation[0]?.feature?.toUpperCase()}
          </div>
          <div className="stat-desc" style={{ fontFamily: mono }}>
            SHAP: {shap.latest_signal_explanation[0]?.shap_value}
          </div>
        </div>
        <div className="stat bg-base-200 rounded-box border border-base-300"
          style={{ borderLeft: `4px solid #00aaff` }}>
          <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>GLOBALLY MOST IMPORTANT</div>
          <div className="stat-value" style={{ color: "#00aaff", fontFamily: mono, fontSize: 22 }}>
            {shap.global_importance[0]?.feature?.toUpperCase()}
          </div>
          <div className="stat-desc" style={{ fontFamily: mono }}>
            Avg SHAP: {shap.global_importance[0]?.importance}
          </div>
        </div>
      </div>

      {/* SHAP bars */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="WHY THIS SIGNAL? — LATEST PREDICTION BREAKDOWN">
          <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 12 }}>
            Positive = pushes toward BUY · Negative = pushes toward SELL
          </div>
          <div className="flex flex-col gap-3">
            {shap.latest_signal_explanation.map((f, i) => {
              const barWidth = (f.abs_value / maxAbs) * 100
              const color = f.direction === "positive" ? "#00ff41" : "#ff3131"
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span style={{ fontSize: 12, color: "#ccc", fontFamily: mono }}>{f.feature}</span>
                    <span style={{ fontSize: 12, color, fontFamily: mono, fontWeight: 700 }}>
                      {f.direction === "positive" ? "+" : ""}{f.shap_value}
                    </span>
                  </div>
                  <div className="w-full rounded overflow-hidden" style={{ height: 8, background: "#222" }}>
                    <div style={{
                      width: `${barWidth}%`, height: "100%", background: color,
                      boxShadow: `0 0 6px ${color}66`, transition: "width 1s ease"
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="GLOBAL FEATURE IMPORTANCE — LAST 100 PREDICTIONS">
          <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginBottom: 12 }}>
            Average absolute SHAP value across recent predictions
          </div>
          <div className="flex flex-col gap-3">
            {shap.global_importance.map((f, i) => {
              const barWidth = (f.importance / maxGlobal) * 100
              const colors = ["#ff6600", "#00aaff", "#ffd700", "#00ff41", "#ff3131", "#cc44ff", "#ccc", "#ff6600", "#00aaff", "#ffd700"]
              const color = colors[i] || "#ccc"
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 10, color: "#444", fontFamily: mono }}>#{i + 1}</span>
                      <span style={{ fontSize: 12, color: "#ccc", fontFamily: mono }}>{f.feature}</span>
                    </div>
                    <span style={{ fontSize: 12, color, fontFamily: mono, fontWeight: 700 }}>{f.importance}</span>
                  </div>
                  <div className="w-full rounded overflow-hidden" style={{ height: 8, background: "#222" }}>
                    <div style={{ width: `${barWidth}%`, height: "100%", background: color, transition: "width 1s ease" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* Feature reference */}
      <Panel title="FEATURE REFERENCE GUIDE">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["sma_cross", "SMA Crossover", "Difference between SMA-20 and SMA-50. Positive = uptrend. Most important global feature."],
            ["rsi", "RSI-14", "Relative Strength Index. Above 70 = overbought, below 30 = oversold. Strong mean-reversion signal."],
            ["bb_pos", "BB Position", "Where price sits within Bollinger Bands. 0 = lower band, 1 = upper band."],
            ["bb_width", "BB Width", "Width of bands relative to price. High = volatile. Low = consolidating before breakout."],
            ["macd", "MACD", "Moving Average Convergence Divergence. Captures trend direction and momentum strength."],
            ["macd_signal", "MACD Signal", "9-day EMA of MACD. Crossovers signal trend changes. Key entry/exit trigger."],
            ["macd_diff", "MACD Histogram", "Difference between MACD and signal line. Positive = momentum building."],
            ["volume_ratio", "Volume Ratio", "Current vs 20-day average volume. High ratio = strong conviction behind move."],
            ["day_of_week", "Day of Week", "Seasonality feature. Markets behave differently Mon vs Fri. Captures weekly patterns."],
            ["month", "Month", "Monthly seasonality. Jan effect, earnings seasons, budget reactions all captured here."],
          ].map(([key, name, desc]) => (
            <div key={key} className="card bg-base-300 p-3" style={{ borderTop: `2px solid #ff6600` }}>
              <div style={{ fontSize: 11, color: "#ff6600", fontFamily: mono, fontWeight: 700, marginBottom: 3 }}>{name}</div>
              <div style={{ fontSize: 10, color: "#444", fontFamily: mono, marginBottom: 5 }}>{key}</div>
              <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}