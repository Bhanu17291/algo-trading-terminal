import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T } from "../../config/tokens";
import { fetchJson } from "../../config/api";
import { SignalBadge } from "./Badge";

// Consolidated from 14 items down to 6 — related pages merged into tabbed
// destinations (Signal & Model, Performance Lab, Market Scanner, Risk & Psychology)
const NAV = [
  { path: "/dashboard",         icon: "◈", label: "Dashboard"        },
  { path: "/trades",            icon: "⇄", label: "Trade Log"        },
  { path: "/signal-model",      icon: "∿", label: "Signal & Model"   },
  { path: "/performance-lab",   icon: "⟳", label: "Performance Lab"  },
  { path: "/market-scanner",    icon: "▦", label: "Market Scanner"   },
  { path: "/risk-psychology",   icon: "⊕", label: "Risk & Psychology"},
  { path: "/clients",           icon: "⚖", label: "Clients"          },
];

function NavItem({ item, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <li>
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "8px 12px",
          background: active ? "rgba(34,197,94,0.1)" : hov ? "rgba(34,197,94,0.05)" : "transparent",
          border: "none", borderRadius: T.r,
          borderLeft: `2px solid ${active ? T.green : "transparent"}`,
          cursor: "pointer", transition: "all 0.15s ease",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, color: active ? T.green : T.textDim, width: 18, textAlign: "center" }}>
          {item.icon}
        </span>
        <span style={{
          fontSize: 12, fontWeight: active ? 700 : 500,
          color: active ? T.mint : hov ? T.text : T.textDim,
          fontFamily: T.fontMono, letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}>
          {item.label}
        </span>
      </button>
    </li>
  );
}

export default function PageLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [signal, setSignal] = useState(null);
  const [market, setMarket] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [time, setTime] = useState("");

  useEffect(() => {
    Promise.allSettled([
      fetchJson("/signal"),
      fetchJson("/market-status"),
    ]).then(([sig, mkt]) => {
      if (sig.status === "fulfilled") setSignal(sig.value);
      if (mkt.status === "fulfilled") setMarket(mkt.value);
    });
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const isOpen = market?.is_open;

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.text,
      display: "flex", flexDirection: "column",
      fontFamily: T.fontSans,
    }}>

      {/* ── TOP BAR ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        background: "rgba(7,16,12,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.textDim, width: 28, height: 28, borderRadius: T.rSm,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}
          >
            ☰
          </button>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, padding: 0,
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: T.rSm,
              background: `linear-gradient(135deg, ${T.green}, ${T.greenDim})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#000",
            }}>
              ⚡
            </div>
            <span style={{
              fontSize: 13, fontWeight: 700, color: T.mint,
              fontFamily: T.fontMono, letterSpacing: "2px", textTransform: "uppercase",
            }}>
              AlgoTerminal
            </span>
          </button>

          <div style={{
            width: 1, height: 20, background: T.border,
          }} />

          <button
            onClick={() => navigate("/")}
            style={{
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.textDim, padding: "3px 10px", borderRadius: T.rSm,
              fontSize: 10, fontFamily: T.fontMono, letterSpacing: "1px",
              cursor: "pointer", textTransform: "uppercase",
            }}
          >
            ← Landing
          </button>
        </div>

        {/* Center — signal */}
        {signal && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SignalBadge signal={signal.signal} size="md" />
            <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.fontMono }}>
              {signal.confidence}% conf · ₹{signal.close?.toLocaleString("en-IN")}
            </span>
          </div>
        )}

        {/* Right — market status + clock */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isOpen ? T.green : T.red,
              boxShadow: isOpen ? `0 0 6px ${T.green}` : "none",
              animation: isOpen ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.fontMono, letterSpacing: "1px" }}>
              {isOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: T.textFaint, fontFamily: T.fontMono }}>
            {time} IST
          </span>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "flex", paddingTop: 52, flex: 1 }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: sidebarOpen ? 200 : 0,
          minHeight: "calc(100vh - 52px)",
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          overflow: "hidden",
          transition: "width 0.2s ease",
          flexShrink: 0,
          position: "sticky",
          top: 52,
          height: "calc(100vh - 52px)",
          overflowY: "auto",
        }}>
          <div style={{ width: 200, padding: "12px 8px" }}>
            {/* Section label */}
            <div style={{
              fontSize: 9, color: T.textFaint, fontFamily: T.fontMono,
              letterSpacing: "2px", textTransform: "uppercase",
              padding: "4px 12px 10px",
            }}>
              NSEI · Platform
            </div>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {NAV.map(item => (
                <NavItem
                  key={item.path}
                  item={item}
                  active={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                />
              ))}
            </ul>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{
          flex: 1, padding: "24px 28px",
          minWidth: 0,
          overflowX: "hidden",
        }}>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(34,197,94,0.3); }
      `}</style>
    </div>
  );
}