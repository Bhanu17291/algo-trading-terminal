import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../../config/api";
import { T, fmt, signalColor } from "../../config/tokens";
import StatCard from "../shared/StatCard";
import Panel from "../shared/Panel";
import { SignalBadge } from "../shared/Badge";

const NAV_MODULES = [
  { icon: "⇄", label: "Trade Log",    path: "/trades",     color: T.green,  desc: "Full trade history" },
  { icon: "∿", label: "Indicators",   path: "/indicators", color: T.mint,   desc: "RSI · MACD · BB" },
  { icon: "⬡", label: "ML Explain",   path: "/explainer",  color: T.purple, desc: "SHAP attribution" },
  { icon: "⟳", label: "Backtest",     path: "/backtest",   color: T.amber,  desc: "Historical strategy" },
  { icon: "↘", label: "Drawdown",     path: "/drawdown",   color: T.red,    desc: "Peak-to-trough" },
  { icon: "⊕", label: "Risk Calc",    path: "/risk",       color: T.green,  desc: "Position sizing" },
  { icon: "∑", label: "Simulator",    path: "/simulator",  color: T.blue,   desc: "Strategy scaling" },
  { icon: "▦", label: "Heatmap",      path: "/heatmap",    color: T.mint,   desc: "Monthly returns" },
  { icon: "◐", label: "Screener",     path: "/screener",   color: T.green,  desc: "Signal filter" },
  { icon: "☰", label: "News",         path: "/news",       color: T.textDim, desc: "Market news" },
  { icon: "◎", label: "Psychology",   path: "/psychology", color: T.purple, desc: "Bias detection" },
  { icon: "⚖", label: "Clients",      path: "/clients",    color: T.blue,   desc: "QUANT vs MACRO" },
  { icon: "◉", label: "Market",       path: "/market",     color: T.green,  desc: "IST clock · status" },
];

function ModuleCard({ item, navigate }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => navigate(item.path)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.surfaceHov : T.surface,
        border: `1px solid ${hov ? item.color + "55" : T.border}`,
        borderRadius: T.rLg,
        padding: "16px 14px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: hov ? `0 4px 20px ${item.color}18` : "none",
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <div style={{ fontSize: 20, color: item.color }}>{item.icon}</div>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: T.text,
          fontFamily: T.fontMono, letterSpacing: "0.5px", textTransform: "uppercase",
        }}>
          {item.label}
        </div>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: T.fontMono, marginTop: 2 }}>
          {item.desc}
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ confidence, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{
          width: 6, height: 32,
          background: i < Math.round((confidence ?? 0) / 10) ? color : "rgba(255,255,255,0.06)",
          borderRadius: 2,
          transition: "background 0.3s ease",
        }} />
      ))}
    </div>
  );
}

export default function Dashboard({ signal, stats, pnl }) {
  const navigate = useNavigate();
  const sigColor = signal ? signalColor(signal.signal) : T.textDim;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeUp 0.4s ease" }}>

      {/* PAGE HEADER */}
      <div>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: T.fontMono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
          Overview
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>
          Dashboard
        </h1>
      </div>

      {/* SIGNAL HERO */}
      <div style={{
        background: `linear-gradient(135deg, ${T.surface} 0%, rgba(34,197,94,0.04) 100%)`,
        border: `1px solid ${T.border}`,
        borderLeft: `4px solid ${sigColor}`,
        borderRadius: T.rLg,
        padding: "24px 28px",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 20,
        boxShadow: signal ? `0 0 40px ${sigColor}10` : "none",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: T.fontMono, letterSpacing: "2px", textTransform: "uppercase" }}>
            Today's ML Signal · {signal?.date ?? "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              fontSize: 52, fontWeight: 900, color: sigColor,
              fontFamily: T.fontMono, letterSpacing: "-2px", lineHeight: 1,
            }}>
              {signal?.signal ?? "—"}
            </div>
            {signal && <SignalBadge signal={signal.signal} size="lg" />}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 12 }}>
              <span style={{ color: T.textFaint }}>Confidence </span>
              <span style={{ color: T.mint, fontWeight: 700 }}>{signal?.confidence ?? "—"}%</span>
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 12 }}>
              <span style={{ color: T.textFaint }}>NSEI Close </span>
              <span style={{ color: T.text, fontWeight: 700 }}>₹{signal?.close?.toLocaleString("en-IN") ?? "—"}</span>
            </div>
          </div>
          {!signal && (
            <div style={{ fontSize: 11, color: T.amber, fontFamily: T.fontMono }}>
              Signal unavailable — backend may be processing. Refresh in 30s.
            </div>
          )}
        </div>
        {signal && <ConfidenceBar confidence={signal.confidence} color={sigColor} />}
      </div>

      {/* STATS GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard label="Total Return"   value={stats ? fmt.pct(stats.total_return) : "—"}  color={T.green} icon="↑" sub={stats ? `Final ₹${Number(stats.final_value).toLocaleString("en-IN")}` : undefined} />
        <StatCard label="Win Rate"       value={stats ? fmt.conf(stats.win_rate) : "—"}      color={T.mint}  icon="◎" sub={stats ? `${stats.wins}W · ${stats.losses}L` : undefined} />
        <StatCard label="Total Trades"   value={stats?.total_trades ?? "—"}                   color={T.text}  icon="⇄" />
        <StatCard label="Cumulative PnL" value={pnl ? fmt.inr(pnl.cumulative_pnl) : "—"}     color={pnl?.cumulative_pnl >= 0 ? T.green : T.red} icon="₹" />
        <StatCard label="Best Trade"     value={pnl ? fmt.inr(pnl.best_trade) : "—"}          color={T.green} icon="▲" />
        <StatCard label="Worst Trade"    value={pnl ? fmt.inr(pnl.worst_trade) : "—"}          color={T.red}   icon="▼" />
      </div>

      {/* MODULES */}
      <Panel title="Platform Modules" accent={T.green}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 10,
        }}>
          {NAV_MODULES.map(item => (
            <ModuleCard key={item.path} item={item} navigate={navigate} />
          ))}
        </div>
      </Panel>

    </div>
  );
}