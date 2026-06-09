import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../../config/api";

const mono = "'Courier New', monospace";

const C = {
  bg:      "#060D0A",
  surface: "#0C1A14",
  card:    "#101F17",
  border:  "rgba(34,197,94,0.14)",
  primary: "#22C55E",
  accent:  "#86EFAC",
  text:    "#E7F0EA",
  textDim: "rgba(231,240,234,0.5)",
  danger:  "#F87171",
  warning: "#FBBF24",
};

function Tile({ label, value, sub, color = C.primary, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(34,197,94,0.06)" : C.card,
        border: `1px solid ${hov ? "rgba(34,197,94,0.35)" : C.border}`,
        borderRadius: 6, padding: "20px 22px",
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: mono, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: mono, letterSpacing: "-0.5px" }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 6, fontFamily: mono }}>{sub}</div>}
    </div>
  );
}

function NavCard({ icon, label, path, navigate }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => navigate(path)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(34,197,94,0.07)" : C.card,
        border: `1px solid ${hov ? "rgba(34,197,94,0.35)" : C.border}`,
        borderRadius: 6, padding: "18px 16px",
        cursor: "pointer", textAlign: "center",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div style={{ fontSize: 22, color: C.primary, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: mono, letterSpacing: "0.5px" }}>{label}</div>
    </div>
  );
}

const PAGES = [
  { icon: "◎", label: "Trade Log",    path: "/trades"     },
  { icon: "∿", label: "Indicators",   path: "/indicators" },
  { icon: "◉", label: "ML Explainer", path: "/explainer"  },
  { icon: "⟲", label: "Backtest",     path: "/backtest"   },
  { icon: "▦", label: "Drawdown",     path: "/drawdown"   },
  { icon: "⊕", label: "Risk Calc",    path: "/risk"       },
  { icon: "∑", label: "Simulator",    path: "/simulator"  },
  { icon: "⊞", label: "Heatmap",      path: "/heatmap"    },
  { icon: "◈", label: "Screener",     path: "/screener"   },
  { icon: "☰", label: "News",         path: "/news"       },
  { icon: "♟", label: "Psychology",   path: "/psychology" },
  { icon: "⚖", label: "Clients",      path: "/clients"    },
  { icon: "↻", label: "Market",       path: "/market"     },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [signal,  setSignal]  = useState(null);
  const [stats,   setStats]   = useState(null);
  const [pnl,     setPnl]     = useState(null);
  const [market,  setMarket]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [sig, st, p, mk] = await Promise.all([
          fetchJson("/signal"),
          fetchJson("/stats"),
          fetchJson("/pnl"),
          fetchJson("/market-status"),
        ]);
        setSignal(sig);
        setStats(st);
        setPnl(p);
        setMarket(mk);
      } catch (e) {
        setError("Backend is waking up — please wait 30s and refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const signalColor = signal?.signal === "BUY" ? C.primary : signal?.signal === "SELL" ? C.danger : C.warning;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI', sans-serif" }}>

      {/* TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 6%", background: "rgba(6,13,10,0.92)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.accent, padding: "5px 14px", borderRadius: 4, fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", cursor: "pointer", fontFamily: mono }}
        >
          ← Landing
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: C.accent, fontFamily: mono }}>
          AlgoTerminal · NSEI
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: market?.is_open ? C.primary : C.danger, animation: market?.is_open ? "blink 2s infinite" : "none" }} />
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono, letterSpacing: "1px" }}>
            {market?.is_open ? "MARKET OPEN" : "MARKET CLOSED"} · {market?.current_time_ist ?? "--:--:--"} IST
          </span>
        </div>
      </div>

      <div style={{ paddingTop: 80, padding: "80px 6% 60px" }}>

        {/* ERROR */}
        {error && (
          <div style={{ background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.3)`, borderRadius: 6, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: C.danger, fontFamily: mono }}>
            ⚠ {error}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: C.textDim, fontFamily: mono, fontSize: 13 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${C.primary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Connecting to signal engine...
          </div>
        )}

        {!loading && !error && (
          <>
            {/* SIGNAL HERO */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "28px 32px", marginBottom: 24,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20,
            }}>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "2px", textTransform: "uppercase", fontFamily: mono, marginBottom: 10 }}>
                  Today's ML Signal · {signal?.date ?? "—"}
                </div>
                <div style={{ fontSize: 48, fontWeight: 700, color: signalColor, fontFamily: mono, letterSpacing: "-1px", lineHeight: 1 }}>
                  {signal?.signal ?? "—"}
                </div>
                <div style={{ fontSize: 13, color: C.textDim, fontFamily: mono, marginTop: 8 }}>
                  Confidence: <span style={{ color: C.accent, fontWeight: 700 }}>{signal?.confidence ?? "—"}%</span>
                  &nbsp;·&nbsp; NSEI Close: <span style={{ color: C.text }}>₹{signal?.close?.toLocaleString() ?? "—"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {[...Array(10)].map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 40,
                    background: i < Math.round((signal?.confidence ?? 0) / 10) ? signalColor : "rgba(255,255,255,0.05)",
                    borderRadius: 2, transition: "background 0.3s",
                  }} />
                ))}
              </div>
            </div>

            {/* STATS TILES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
              <Tile label="Total Return"  value={`+${stats?.total_return ?? "—"}%`} color={C.primary} />
              <Tile label="Win Rate"      value={`${stats?.win_rate ?? "—"}%`}       color={C.accent} />
              <Tile label="Total Trades"  value={stats?.total_trades ?? "—"}          color={C.text} />
              <Tile label="Wins"          value={stats?.wins ?? "—"}                  color={C.primary} />
              <Tile label="Losses"        value={stats?.losses ?? "—"}                color={C.danger} />
              <Tile label="Cumulative PnL" value={pnl?.cumulative_pnl != null ? `₹${Number(pnl.cumulative_pnl).toLocaleString()}` : "—"} color={pnl?.cumulative_pnl >= 0 ? C.primary : C.danger} />
              <Tile label="Best Trade"    value={pnl?.best_trade != null ? `₹${Number(pnl.best_trade).toLocaleString()}` : "—"}   color={C.primary} />
              <Tile label="Worst Trade"   value={pnl?.worst_trade != null ? `₹${Number(pnl.worst_trade).toLocaleString()}` : "—"} color={C.danger} />
            </div>

            {/* NAV GRID */}
            <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "2px", textTransform: "uppercase", fontFamily: mono, marginBottom: 14 }}>
              Platform Modules
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              {PAGES.map(p => (
                <NavCard key={p.path} icon={p.icon} label={p.label} path={p.path} navigate={navigate} />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}