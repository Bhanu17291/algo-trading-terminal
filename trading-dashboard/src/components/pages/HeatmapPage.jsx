import { useState } from "react";
import { T } from "../../config/tokens";

const mono = T.fontMono;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Mon","Tue","Wed","Thu","Fri"];
const YEARS  = [2023, 2024, 2025, 2026];

function buildMonthlyPnl(trades) {
  const map = {};
  (trades||[]).filter(t => t.action==="SELL").forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map[key]) map[key] = { pnl: 0, count: 0 };
    map[key].pnl += t.pnl; map[key].count += 1;
  });
  return map;
}

function buildDayPnl(trades) {
  const map = {0:[],1:[],2:[],3:[],4:[]};
  (trades||[]).filter(t => t.action==="SELL").forEach(t => {
    const day = new Date(t.date).getDay();
    if (day >= 1 && day <= 5) map[day-1].push(t.pnl);
  });
  return map;
}

export default function HeatmapPage({ trades, compare }) {
  const [tab, setTab] = useState("QUANT");

  const tabTrades = { STRATEGY: trades, QUANT: compare?.quant_trades, MACRO: compare?.macro_trades };
  const tabColor  = { STRATEGY: T.red, QUANT: T.green, MACRO: T.blue };
  const current   = tabTrades[tab] || [];
  const monthly   = buildMonthlyPnl(current);
  const dayPnl    = buildDayPnl(current);
  const color     = tabColor[tab];
  const maxAbs    = Math.max(...Object.values(monthly).map(v => Math.abs(v.pnl)), 1);

  const getColor = (pnl) => {
    if (!pnl) return "rgba(255,255,255,0.03)";
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
    return pnl > 0
      ? `rgba(34,197,94,${0.15 + intensity * 0.7})`
      : `rgba(248,113,113,${0.15 + intensity * 0.7})`;
  };

  const sells = current.filter(t => t.action === "SELL");
  const totalPnl = sells.reduce((a, t) => a + (t.pnl || 0), 0);
  const wins = sells.filter(t => t.pnl > 0).length;
  const bestMonth = Object.values(monthly).reduce((best, m) => m.pnl > (best?.pnl ?? -Infinity) ? m : best, null);
  const worstMonth = Object.values(monthly).reduce((worst, m) => m.pnl < (worst?.pnl ?? Infinity) ? m : worst, null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Returns Analysis</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Monthly Returns Heatmap</h1>
      </div>

      {/* Tab + stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 10, alignItems: "stretch" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Profile</div>
          {["QUANT","MACRO","STRATEGY"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 12px", background: tab === t ? tabColor[t] : "transparent",
              color: tab === t ? T.bg : tabColor[t], border: `1px solid ${tabColor[t]}`,
              borderRadius: T.r, fontFamily: mono, fontSize: 9, fontWeight: 700, cursor: "pointer",
            }}>{t}</button>
          ))}
        </div>
        {[
          { label: "Total PnL",   value: `₹${totalPnl.toLocaleString("en-IN")}`, color: totalPnl >= 0 ? T.green : T.red },
          { label: "Trades",      value: sells.length,                            color: T.text },
          { label: "Best Month",  value: bestMonth  ? `₹${bestMonth.pnl.toLocaleString("en-IN")}`  : "—", color: T.green },
          { label: "Worst Month", value: worstMonth ? `₹${worstMonth.pnl.toLocaleString("en-IN")}` : "—", color: T.red },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: T.rLg, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c, fontFamily: mono }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Heatmap + day bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>

        {/* Heatmap */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "14px 16px", overflowX: "auto" }}>
          <div style={{ fontSize: 10, color, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>
            Monthly PnL — {tab}
          </div>
          <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginBottom: 8 }}>
            Green = profit · Red = loss · Intensity = magnitude
          </div>
          <table style={{ borderCollapse: "separate", borderSpacing: 3 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, padding: "2px 6px", textAlign: "left" }}></th>
                {MONTHS.map(m => <th key={m} style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, padding: "2px 5px", textAlign: "center" }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {YEARS.map(year => (
                <tr key={year}>
                  <td style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, padding: "2px 6px", fontWeight: 700 }}>{year}</td>
                  {MONTHS.map((_, mi) => {
                    const cell = monthly[`${year}-${mi}`];
                    return (
                      <td key={mi} style={{ padding: 2 }}>
                        <div style={{
                          width: 48, height: 28, borderRadius: T.rSm,
                          background: getColor(cell?.pnl),
                          border: `1px solid rgba(255,255,255,0.05)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: cell ? "pointer" : "default",
                          title: cell ? `₹${cell.pnl.toLocaleString("en-IN")} (${cell.count} trades)` : "No trades",
                        }}>
                          {cell && <span style={{ fontSize: 8, color: "#fff", fontFamily: mono, fontWeight: 700 }}>
                            {cell.pnl > 0 ? "+" : ""}₹{Math.abs(cell.pnl/1000).toFixed(1)}k
                          </span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Day of week */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "14px 16px", minWidth: 180 }}>
          <div style={{ fontSize: 10, color, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Day of Week</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DAYS.map((day, i) => {
              const pnls = dayPnl[i] || [];
              const avg  = pnls.length ? pnls.reduce((a,b) => a+b, 0) / pnls.length : 0;
              const barW = Math.min((Math.abs(avg) / 5000) * 100, 100);
              const c    = avg >= 0 ? T.green : T.red;
              return (
                <div key={day}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.text, fontFamily: mono, width: 32 }}>{day}</span>
                    <span style={{ fontSize: 10, color: c, fontFamily: mono, fontWeight: 700 }}>
                      {avg >= 0 ? "+" : ""}₹{Math.round(avg).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                    <div style={{ width: `${barW}%`, height: "100%", background: c, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}