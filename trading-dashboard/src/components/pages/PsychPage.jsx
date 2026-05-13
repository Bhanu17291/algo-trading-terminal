import Panel from "../shared/Panel"
import Metric from "../shared/Metric"
import BackButton from "../layout/BackButton"

const mono = "'Courier New', monospace"

function GaugeCard({ title, score, status, message, color, metrics, alerts, accent }) {
  const circumference = 2 * Math.PI * 70
  const offset = circumference - (circumference * score / 100)
  return (
    <div className="card bg-base-200 border border-base-300 p-4" style={{ borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 13, color: accent, fontFamily: mono, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      <div className="flex flex-col items-center gap-3 mb-4">
        <div style={{ position: "relative", width: 140, height: 140 }}>
          <svg width="140" height="140" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="#222" strokeWidth="10" />
            <circle cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 80 80)"
              style={{ transition: "stroke-dashoffset 1.5s ease", filter: `drop-shadow(0 0 8px ${color})` }} />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: mono }}>{score}</div>
            <div style={{ fontSize: 10, color: "#666", fontFamily: mono }}>/ 100</div>
          </div>
        </div>
        <div className="badge badge-lg" style={{ background: `${color}22`, color, border: `1px solid ${color}`, fontFamily: mono }}>
          {status}
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "#ccc", lineHeight: 1.6, fontFamily: mono }}>{message}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {metrics.map(([l, v, c]) => (
          <div key={l} className="bg-base-300 rounded p-2" style={{ borderLeft: `2px solid ${c}` }}>
            <div style={{ fontSize: 9, color: "#666", fontFamily: mono }}>{l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c, fontFamily: mono }}>{v}</div>
          </div>
        ))}
      </div>
      {alerts?.length === 0
        ? <div className="alert alert-success py-1 text-xs" style={{ fontFamily: mono }}>✅ NO ALERTS</div>
        : alerts?.map((a, i) => <div key={i} className="alert alert-error py-1 text-xs mb-1" style={{ fontFamily: mono }}>{a}</div>)
      }
    </div>
  )
}

function clientPsych(trades, portfolio) {
  if (!trades || !portfolio) return null
  const sells = trades.filter(t => t.action === "SELL" && t.pnl !== 0)
  if (!sells.length) return { score: 100, status: "HEALTHY", message: "No trades yet.", color: "#22c55e", alerts: [], consecutive_losses: 0, drawdown_pct: 0, recent_winrate: 0, conf_score: 0 }

  const recent = sells.slice(-5).map(t => t.pnl)
  let consecutive_losses = 0
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i] < 0) consecutive_losses++
    else break
  }

  const peak = Math.max(...portfolio.map(r => r.value))
  const current = portfolio[portfolio.length - 1]?.value || 0
  const drawdown_pct = parseFloat(((peak - current) / peak * 100).toFixed(2))
  const recent_wins = recent.filter(p => p > 0).length
  const recent_winrate = parseFloat((recent_wins / recent.length * 100).toFixed(1))
  const conf_score = parseFloat((trades.slice(-5).reduce((a, t) => a + t.confidence, 0) / 5 * 100).toFixed(2))

  let score = 100
  if (consecutive_losses === 1) score -= 10
  else if (consecutive_losses === 2) score -= 25
  else if (consecutive_losses === 3) score -= 40
  else if (consecutive_losses >= 4) score -= 60
  if (drawdown_pct > 2) score -= 10
  if (drawdown_pct > 5) score -= 20
  if (recent_winrate < 40) score -= 15
  if (conf_score < 50) score -= 10
  score = Math.max(0, Math.min(100, score))

  const alerts = []
  if (consecutive_losses >= 3) alerts.push("🚨 Revenge trading risk — 3+ consecutive losses")
  if (drawdown_pct > 5) alerts.push(`🔴 Portfolio down ${drawdown_pct}% from peak`)
  if (recent_winrate < 40) alerts.push("📉 Win rate below 40% in last 5 trades")

  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 20 ? "#ef4444" : "#dc2626"
  const status = score >= 80 ? "HEALTHY" : score >= 50 ? "CAUTION" : score >= 20 ? "HIGH RISK" : "STOP TRADING"
  const message = score >= 80 ? "Trading well. Emotions appear stable." : score >= 50 ? "Signs of stress. Consider reducing size." : "High risk. Consider pausing."

  return { score, status, message, color, alerts, consecutive_losses, drawdown_pct, recent_winrate, conf_score }
}

export default function PsychPage({ psych, compare, onBack }) {
  const quantPsych = clientPsych(compare?.quant_trades, compare?.quant_portfolio)
  const macroPsych = clientPsych(compare?.macro_trades, compare?.macro_portfolio)

  return (
    <div className="flex flex-col gap-3">
      <BackButton onBack={onBack} />

      {/* Original strategy psych */}
      <Panel title="🧠 ORIGINAL STRATEGY — EMOTIONAL HEALTH">
        {psych && (
          <GaugeCard
            title="MAIN STRATEGY"
            score={psych.score}
            status={psych.status}
            message={psych.message}
            color={psych.color}
            accent="#ff3131"
            alerts={psych.alerts}
            metrics={[
              ["CONSEC LOSSES", psych.consecutive_losses, psych.consecutive_losses >= 2 ? "#ff3131" : "#00ff41"],
              ["DRAWDOWN",      `-${psych.drawdown_pct}%`, psych.drawdown_pct > 3 ? "#ff3131" : "#00ff41"],
              ["RECENT WIN%",   `${psych.recent_winrate}%`, psych.recent_winrate >= 50 ? "#00ff41" : "#ff3131"],
              ["MODEL CONF",    `${psych.conf_score}%`, psych.conf_score >= 60 ? "#00ff41" : "#ffd700"],
            ]}
          />
        )}
      </Panel>

      {/* Client psych comparison */}
      <div style={{ fontSize: 13, color: "#cc44ff", fontFamily: mono, fontWeight: 700, letterSpacing: 1 }}>
        ⚖ CLIENT PSYCHOLOGICAL HEALTH COMPARISON
      </div>
      <div className="grid grid-cols-2 gap-3">
        {quantPsych && (
          <GaugeCard
            title="QUANT — AGGRESSIVE"
            score={quantPsych.score}
            status={quantPsych.status}
            message={quantPsych.message}
            color={quantPsych.color}
            accent="#ff6600"
            alerts={quantPsych.alerts}
            metrics={[
              ["CONSEC LOSSES", quantPsych.consecutive_losses, quantPsych.consecutive_losses >= 2 ? "#ff3131" : "#00ff41"],
              ["DRAWDOWN",      `-${quantPsych.drawdown_pct}%`, quantPsych.drawdown_pct > 3 ? "#ff3131" : "#00ff41"],
              ["RECENT WIN%",   `${quantPsych.recent_winrate}%`, quantPsych.recent_winrate >= 50 ? "#00ff41" : "#ff3131"],
              ["MODEL CONF",    `${quantPsych.conf_score}%`, quantPsych.conf_score >= 60 ? "#00ff41" : "#ffd700"],
            ]}
          />
        )}
        {macroPsych && (
          <GaugeCard
            title="MACRO — CONSERVATIVE"
            score={macroPsych.score}
            status={macroPsych.status}
            message={macroPsych.message}
            color={macroPsych.color}
            accent="#00aaff"
            alerts={macroPsych.alerts}
            metrics={[
              ["CONSEC LOSSES", macroPsych.consecutive_losses, macroPsych.consecutive_losses >= 2 ? "#ff3131" : "#00ff41"],
              ["DRAWDOWN",      `-${macroPsych.drawdown_pct}%`, macroPsych.drawdown_pct > 3 ? "#ff3131" : "#00ff41"],
              ["RECENT WIN%",   `${macroPsych.recent_winrate}%`, macroPsych.recent_winrate >= 50 ? "#00ff41" : "#ff3131"],
              ["MODEL CONF",    `${macroPsych.conf_score}%`, macroPsych.conf_score >= 60 ? "#00ff41" : "#ffd700"],
            ]}
          />
        )}
      </div>

      {/* Behavioral finance reference — unchanged */}
      <Panel title="BEHAVIORAL FINANCE CONCEPTS">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["LOSS AVERSION",   "#ff3131", "Traders feel losses ~2x more than equivalent gains. After 3+ losses, decision quality drops."],
            ["REVENGE TRADING", "#ff6600", "Impulse to recover losses by taking larger, riskier positions. 3 consecutive losses = high risk."],
            ["RECENCY BIAS",    "#ffd700", "Overweighting recent trades. A losing streak causes overcorrection or paralysis."],
            ["OVERCONFIDENCE",  "#00aaff", "Traders overestimate ability after a winning streak. Win rate above 80% warrants caution."],
            ["DRAWDOWN RISK",   "#cc44ff", "Portfolio down 5%+ from peak correlates with emotionally-driven decisions."],
            ["MODEL CONFIDENCE","#00ff41", "When ML confidence drops below 50%, signal is weak. Uncertain signals = higher execution risk."],
          ].map(([title, c, desc]) => (
            <div key={title} className="card bg-base-300 p-3" style={{ borderTop: `2px solid ${c}` }}>
              <div style={{ fontSize: 11, color: c, fontFamily: mono, fontWeight: 700, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 11, color: "#999", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}