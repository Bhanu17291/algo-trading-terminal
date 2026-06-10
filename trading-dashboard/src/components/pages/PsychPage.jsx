import { T } from "../../config/tokens";

const mono = T.fontMono;

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${color}`, borderRadius: T.rLg,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: mono }}>{value ?? "—"}</div>
    </div>
  );
}

function GaugeRing({ score, color }) {
  const r = 44, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score / 100);
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 1.5s ease", filter: `drop-shadow(0 0 6px ${color})` }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="18" fontWeight="900" fontFamily={mono}>{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={T.textFaint} fontSize="9" fontFamily={mono}>/100</text>
    </svg>
  );
}

function PsychCard({ title, accent, data }) {
  if (!data) return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${accent}`, borderRadius: T.rLg, padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: T.textFaint, fontFamily: mono, fontSize: 11 }}>
      No data
    </div>
  );
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${accent}`, borderRadius: T.rLg, padding: "16px" }}>
      <div style={{ fontSize: 10, color: accent, fontFamily: mono, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <GaugeRing score={data.score} color={data.color} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: data.color, fontFamily: mono, letterSpacing: "1px", marginBottom: 4 }}>{data.status}</div>
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: mono, lineHeight: 1.6, maxWidth: 200 }}>{data.message}</div>
        </div>
      </div>
      {/* Health bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${data.score}%`, background: data.color, borderRadius: 2, transition: "width 1s ease" }} />
      </div>
      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[
          ["Consec Losses", data.consecutive_losses, data.consecutive_losses >= 2 ? T.red : T.green],
          ["Drawdown",      `-${data.drawdown_pct}%`, data.drawdown_pct > 3 ? T.red : T.green],
          ["Recent Win%",   `${data.recent_winrate}%`, data.recent_winrate >= 50 ? T.green : T.red],
          ["Model Conf",    `${data.conf_score}%`, data.conf_score >= 60 ? T.green : T.amber],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`, borderLeft: `2px solid ${c}`, borderRadius: T.r, padding: "7px 10px" }}>
            <div style={{ fontSize: 8, color: T.textFaint, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: mono }}>{v}</div>
          </div>
        ))}
      </div>
      {/* Alerts */}
      {data.alerts?.length === 0
        ? <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(34,197,94,0.08)", border: `1px solid rgba(34,197,94,0.2)`, borderRadius: T.r, fontSize: 10, color: T.green, fontFamily: mono }}>✓ No alerts</div>
        : data.alerts?.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.2)`, borderRadius: T.r, fontSize: 10, color: T.red, fontFamily: mono, marginBottom: 4 }}>⚠ {a}</div>
        ))
      }
    </div>
  );
}

function clientPsych(trades, portfolio) {
  if (!trades || !portfolio) return null;
  const sells = trades.filter(t => t.action === "SELL" && t.pnl !== 0);
  if (!sells.length) return { score: 100, status: "HEALTHY", message: "No trades yet.", color: T.green, alerts: [], consecutive_losses: 0, drawdown_pct: 0, recent_winrate: 0, conf_score: 0 };

  const recent = sells.slice(-5).map(t => t.pnl);
  let cl = 0;
  for (let i = recent.length - 1; i >= 0; i--) { if (recent[i] < 0) cl++; else break; }

  const peak = Math.max(...portfolio.map(r => r.value));
  const cur = portfolio[portfolio.length - 1]?.value || 0;
  const dd = parseFloat(((peak - cur) / peak * 100).toFixed(2));
  const rw = parseFloat((recent.filter(p => p > 0).length / recent.length * 100).toFixed(1));
  const cs = parseFloat((trades.slice(-5).reduce((a, t) => a + t.confidence, 0) / 5 * 100).toFixed(2));

  let score = 100;
  if (cl === 1) score -= 10; else if (cl === 2) score -= 25; else if (cl === 3) score -= 40; else if (cl >= 4) score -= 60;
  if (dd > 2) score -= 10; if (dd > 5) score -= 20;
  if (rw < 40) score -= 15; if (cs < 50) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const alerts = [];
  if (cl >= 3) alerts.push("Revenge trading risk — 3+ consecutive losses");
  if (dd > 5) alerts.push(`Portfolio down ${dd}% from peak`);
  if (rw < 40) alerts.push("Win rate below 40% in last 5 trades");

  const color = score >= 80 ? T.green : score >= 50 ? T.amber : T.red;
  const status = score >= 80 ? "HEALTHY" : score >= 50 ? "CAUTION" : score >= 20 ? "HIGH RISK" : "STOP TRADING";
  const message = score >= 80 ? "Trading well. Emotions stable." : score >= 50 ? "Signs of stress. Reduce size." : "High risk. Consider pausing.";

  return { score, status, message, color, alerts, consecutive_losses: cl, drawdown_pct: dd, recent_winrate: rw, conf_score: cs };
}

const CONCEPTS = [
  { title: "Loss Aversion",   color: T.red,    desc: "Traders feel losses ~2× more than equivalent gains. After 3+ losses, decision quality drops." },
  { title: "Revenge Trading", color: T.amber,  desc: "Impulse to recover losses by taking larger, riskier positions. 3 consecutive losses = high risk." },
  { title: "Recency Bias",    color: T.amber,  desc: "Overweighting recent trades. A losing streak causes overcorrection or paralysis." },
  { title: "Overconfidence",  color: T.blue,   desc: "Traders overestimate ability after a winning streak. Win rate above 80% warrants caution." },
  { title: "Drawdown Risk",   color: T.purple, desc: "Portfolio down 5%+ from peak correlates with emotionally-driven decisions." },
  { title: "Model Confidence",color: T.green,  desc: "When ML confidence drops below 50%, signal is weak. Uncertain signals = higher execution risk." },
];

export default function PsychPage({ psych, compare }) {
  const quantPsych = clientPsych(compare?.quant_trades, compare?.quant_portfolio);
  const macroPsych = clientPsych(compare?.macro_trades, compare?.macro_portfolio);

  const mainScore = psych?.score ?? 0;
  const mainColor = mainScore >= 80 ? T.green : mainScore >= 50 ? T.amber : T.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Behavioural Analysis</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Psychology Monitor</h1>
      </div>

      {/* Top stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatCard label="Health Score"    value={`${psych?.score ?? "—"}/100`}      color={mainColor} />
        <StatCard label="Status"          value={psych?.status ?? "—"}               color={mainColor} />
        <StatCard label="Consec Losses"   value={psych?.consecutive_losses ?? "—"}   color={psych?.consecutive_losses >= 3 ? T.red : T.green} />
        <StatCard label="Recent Win Rate" value={psych?.recent_winrate ? `${psych.recent_winrate}%` : "—"} color={psych?.recent_winrate >= 50 ? T.green : T.red} />
      </div>

      {/* 3 psych cards side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <PsychCard title="Main Strategy" accent={T.red}   data={psych ? { ...psych, consecutive_losses: psych.consecutive_losses ?? 0, drawdown_pct: psych.drawdown_pct ?? 0, recent_winrate: psych.recent_winrate ?? 0, conf_score: psych.conf_score ?? 0 } : null} />
        <PsychCard title="QUANT — Aggressive"   accent={T.green} data={quantPsych} />
        <PsychCard title="MACRO — Conservative" accent={T.blue}  data={macroPsych} />
      </div>

      {/* Behavioral finance reference */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.purple}`, borderRadius: T.rLg, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, color: T.purple, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Behavioral Finance Concepts</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {CONCEPTS.map(({ title, color, desc }) => (
            <div key={title} style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`, borderLeft: `2px solid ${color}`, borderRadius: T.r, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: mono, letterSpacing: "0.5px", marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.6, fontFamily: mono }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}