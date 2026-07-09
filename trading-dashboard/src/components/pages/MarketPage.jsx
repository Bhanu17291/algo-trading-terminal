import { useState, useEffect } from "react";
import { T } from "../../config/tokens";
import { fetchJson } from "../../config/api";

const mono = T.fontMono;

const SESSIONS = [
  { label: "Pre-Open",   start: "09:00", end: "09:15", color: T.amber },
  { label: "Regular",    start: "09:15", end: "15:30", color: T.green },
  { label: "Post-Close", start: "15:30", end: "16:00", color: T.blue  },
  { label: "After Hours",start: "16:00", end: "09:00", color: T.textFaint },
];

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function MarketPage() {
  const [status, setStatus] = useState(null);
  const [log,    setLog]    = useState([]);

  useEffect(() => {
    const load = async () => {
      const [s, l] = await Promise.allSettled([fetchJson("/market-status"), fetchJson("/live-log")]);
      if (s.status === "fulfilled") setStatus(s.value);
      if (l.status === "fulfilled") setLog(l.value);
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const isOpen   = status?.is_open;
  const timeStr  = status?.current_time_ist ?? "--:--:--";
  const [h, m]   = timeStr.split(":").map(Number);
  const nowMins  = (h || 0) * 60 + (m || 0);
  const dayMins  = 9 * 60 + 15;
  const closeMins= 15 * 60 + 30;
  const progress = Math.max(0, Math.min(100, ((nowMins - dayMins) / (closeMins - dayMins)) * 100));

  const currentSession = SESSIONS.find(s => {
    const start = timeToMinutes(s.start);
    const end   = timeToMinutes(s.end);
    if (start < end) return nowMins >= start && nowMins < end;
    return nowMins >= start || nowMins < end;
  }) ?? SESSIONS[3];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Live Status</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Market Status</h1>
      </div>

      {/* Main status + info + sessions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

        {/* Status card */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderTop: `2px solid ${isOpen ? T.green : T.red}`,
          borderRadius: T.rLg, padding: "20px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          boxShadow: isOpen ? `0 0 40px ${T.green}10` : "none",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: isOpen ? "rgba(34,197,94,0.1)" : "rgba(248,113,113,0.1)",
            border: `2px solid ${isOpen ? T.green : T.red}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
            boxShadow: isOpen ? `0 0 20px ${T.green}30` : "none",
          }}>
            {isOpen ? "◉" : "◎"}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: isOpen ? T.green : T.red, fontFamily: mono, letterSpacing: "2px" }}>
              MARKET {status?.status ?? "..."}
            </div>
            <div style={{ fontSize: 11, color: T.textFaint, fontFamily: mono, marginTop: 4 }}>
              {currentSession.label} Session
            </div>
          </div>
          <div style={{ padding: "6px 16px", background: `rgba(${isOpen ? "34,197,94" : "248,113,113"},0.08)`, border: `1px solid ${isOpen ? T.green : T.red}`, borderRadius: T.r, fontFamily: mono, fontSize: 14, fontWeight: 700, color: isOpen ? T.green : T.red }}>
            {timeStr} IST
          </div>
          {/* Progress bar */}
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: 8, color: T.textFaint, fontFamily: mono, letterSpacing: "1px", marginBottom: 4, textAlign: "center" }}>
              09:15 ━━━━━━━━━━━━━━━━━━━━━━━━ 15:30
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
              <div style={{ width: `${isOpen ? progress : 0}%`, height: "100%", background: T.green, borderRadius: 2, transition: "width 1s ease" }} />
            </div>
          </div>
        </div>

        {/* Trading info */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.blue}`, borderRadius: T.rLg, padding: "16px" }}>
          <div style={{ fontSize: 10, color: T.blue, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Trading Info</div>
          {[
            ["Scheduler",    "APScheduler",          T.green],
            ["Interval",     "Every 1 minute",       T.text],
            ["Market Hours", "09:15 – 15:30 IST",    T.text],
            ["Trading Days", "Monday – Friday",       T.text],
            ["Exchange",     "NSE India",             T.mint],
            ["Index",        "NIFTY 50 (^NSEI)",      T.mint],
            ["Status",       status?.status ?? "...", isOpen ? T.green : T.red],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 10, color: T.textFaint, fontFamily: mono }}>{l}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: c, fontFamily: mono }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Sessions timeline */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.amber}`, borderRadius: T.rLg, padding: "16px" }}>
          <div style={{ fontSize: 10, color: T.amber, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Trading Sessions (IST)</div>
          {SESSIONS.map(s => {
            const active = s.label === currentSession.label;
            return (
              <div key={s.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", marginBottom: 6,
                background: active ? `rgba(${s.color === T.green ? "34,197,94" : "251,191,36"},0.08)` : "rgba(0,0,0,0.2)",
                border: `1px solid ${active ? s.color : T.border}`,
                borderLeft: `2px solid ${s.color}`, borderRadius: T.r,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: mono }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono }}>{s.start} – {s.end}</div>
                </div>
                {active && <div style={{ fontSize: 8, color: s.color, fontFamily: mono, border: `1px solid ${s.color}`, borderRadius: T.rSm, padding: "2px 6px" }}>CURRENT</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live log */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 10 }}>
          Live Trading Log — updates every 10s · only fires during market hours
        </div>
        {log.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "24px 0", color: T.textFaint, fontFamily: mono, fontSize: 11 }}>
            <div style={{ fontSize: 28 }}>⏳</div>
            Market is closed. Live log will populate during trading hours (09:15–15:30 IST).
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {log.map((entry, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`,
                borderLeft: `2px solid ${entry.action==="BUY"?T.green:entry.action==="SELL"?T.red:T.textFaint}`,
                borderRadius: T.r,
              }}>
                <span style={{ fontSize: 10, color: T.textFaint, fontFamily: mono }}>[{entry.time}]</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: entry.action==="BUY"?T.green:T.red, fontFamily: mono, padding: "1px 6px", border: `1px solid ${entry.action==="BUY"?T.green:T.red}`, borderRadius: T.rSm }}>{entry.action}</span>
                <span style={{ fontSize: 10, color: T.textDim, fontFamily: mono }}>p={entry.confidence} · ₹{entry.price?.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}