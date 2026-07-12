import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function Tile({ label, value, color, sub }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "12px 16px",
    }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: mono }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function ExplainerPage({ shap, signal, showHeader = true }) {
  const latest   = shap?.latest_signal_explanation?.slice(0, 12) ?? [];
  const global_  = shap?.global_importance?.slice(0, 10) ?? [];
  const predClass = shap?.predicted_class;

  const topDriver    = latest[0]?.feature ?? "—";
  const topShap      = latest[0]?.shap_value?.toFixed(4) ?? "—";
  const posDrivers   = latest.filter(f => f.shap_value > 0).length;
  const negDrivers   = latest.filter(f => f.shap_value < 0).length;

  const latestChart = latest.map(f => ({
    feature: f.feature.replace(/_/g, " ").toUpperCase(),
    value: parseFloat(f.shap_value.toFixed(4)),
    abs: f.abs_value,
    direction: f.direction,
  }));

  const globalChart = global_.map(f => ({
    feature: f.feature.replace(/_/g, " ").toUpperCase(),
    importance: parseFloat(f.importance.toFixed(4)),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      {showHeader && (
        <div>
          <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Machine Learning</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>ML Explainer — SHAP Analysis</h1>
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <Tile label="Signal"       value={signal?.signal ?? "—"}         color={signal?.signal === "BUY" ? T.green : T.amber} sub={`Confidence ${signal?.confidence ?? 0}%`} />
        <Tile label="Top Driver"   value={topDriver.replace(/_/g," ")}   color={T.purple} sub={`SHAP ${topShap}`} />
        <Tile label="Bullish Features" value={posDrivers}                color={T.green}  sub="positive SHAP" />
        <Tile label="Bearish Features" value={negDrivers}                color={T.red}    sub="negative SHAP" />
      </div>

      {/* Two charts side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Latest signal SHAP */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderTop: `2px solid ${T.purple}`, borderRadius: T.rLg, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 10, color: T.purple, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Today's Signal Explanation</div>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, marginBottom: 10 }}>
            Positive = pushed toward BUY · Negative = pushed toward HOLD
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={latestChart} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 8, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => v.toFixed(3)} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 8, fill: T.textDim, fontFamily: mono }} width={100} />
              <Tooltip
                formatter={(v) => [v.toFixed(4), "SHAP"]}
                contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, fontFamily: mono, fontSize: 10 }}
              />
              <ReferenceLine x={0} stroke={T.border} />
              <Bar dataKey="value" name="SHAP Value" radius={[0, 2, 2, 0]}>
                {latestChart.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? T.green : T.red} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Global feature importance */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderTop: `2px solid ${T.blue}`, borderRadius: T.rLg, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 10, color: T.blue, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Global Feature Importance</div>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, marginBottom: 10 }}>
            Average impact across all training samples
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={globalChart} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 8, fill: T.textFaint, fontFamily: mono }} tickFormatter={v => v.toFixed(3)} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 8, fill: T.textDim, fontFamily: mono }} width={100} />
              <Tooltip
                formatter={(v) => [v.toFixed(4), "Importance"]}
                contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, fontFamily: mono, fontSize: 10 }}
              />
              <Bar dataKey="importance" name="Importance" fill={T.blue} fillOpacity={0.8} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature reference */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderTop: `2px solid ${T.mint}`, borderRadius: T.rLg, padding: "12px 16px",
      }}>
        <div style={{ fontSize: 10, color: T.mint, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 10 }}>Top Features Breakdown</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {latest.slice(0, 8).map((f, i) => (
            <div key={i} style={{
              background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`,
              borderLeft: `2px solid ${f.shap_value >= 0 ? T.green : T.red}`,
              borderRadius: T.r, padding: "8px 10px",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: f.shap_value >= 0 ? T.green : T.red, fontFamily: mono, marginBottom: 3, textTransform: "uppercase" }}>
                {f.feature.replace(/_/g, " ")}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: mono }}>{f.shap_value.toFixed(4)}</div>
              <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 2 }}>{f.direction}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}