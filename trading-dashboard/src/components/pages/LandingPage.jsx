import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../../config/api";

const T = {
  bg:       "#040A06",
  surface:  "#0D1A13",
  border:   "rgba(34,197,94,0.1)",
  borderMd: "rgba(34,197,94,0.2)",
  green:    "#22C55E",
  greenDim: "#16A34A",
  mint:     "#86EFAC",
  pale:     "#BBF7D0",
  text:     "#E7F0EA",
  textDim:  "rgba(231,240,234,0.55)",
  textFaint:"rgba(231,240,234,0.25)",
  red:      "#F87171",
  amber:    "#FBBF24",
  blue:     "#60A5FA",
  purple:   "#C084FC",
  mono:     "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans:     "'Inter','Segoe UI',system-ui,sans-serif",
};

function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let W, H, pts = [], raf;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 55; i++) pts.push({
      x: Math.random() * 1600, y: Math.random() * 900,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.1 + 0.3,
    });
    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,197,94,0.22)"; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(34,197,94,${0.05 * (1 - d / 110)})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }} />;
}

const MODULES = [
  { icon: "◈", label: "ML Engine",  path: "/dashboard"  },
  { icon: "◉", label: "Explainer",  path: "/explainer"  },
  { icon: "⟲", label: "Backtest",   path: "/backtest"   },
  { icon: "▦", label: "Portfolio",  path: "/dashboard"  },
  { icon: "⊕", label: "Risk Calc",  path: "/risk"       },
  { icon: "∿", label: "Indicators", path: "/indicators" },
  { icon: "↘", label: "Drawdown",   path: "/drawdown"   },
  { icon: "∑", label: "Simulator",  path: "/simulator"  },
  { icon: "⚖", label: "Clients",    path: "/clients"    },
  { icon: "◐", label: "Screener",   path: "/screener"   },
  { icon: "☰", label: "News",       path: "/news"       },
  { icon: "◉", label: "Market",     path: "/market"     },
];

const PIPELINE = [
  { icon: "↓", label: "Data",     sub: "NSEI OHLCV"   },
  { icon: "⚙", label: "Features", sub: "27 indicators" },
  { icon: "◈", label: "Ensemble", sub: "XGB+LGB+CAT"  },
  { icon: "◉", label: "SHAP",     sub: "Attribution"  },
  { icon: "⚡", label: "Signal",   sub: "BUY / HOLD"   },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [signal, setSignal] = useState(null);
  const [stats,  setStats]  = useState(null);
  const [market, setMarket] = useState(null);
  const [hovMod, setHovMod] = useState(null);
  const [hovNav, setHovNav] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      fetchJson("/signal"),
      fetchJson("/stats"),
      fetchJson("/market-status"),
    ]).then(([sig, st, mk]) => {
      if (sig.status === "fulfilled") setSignal(sig.value);
      if (st.status  === "fulfilled") setStats(st.value);
      if (mk.status  === "fulfilled") setMarket(mk.value);
    });
  }, []);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.35} }
      @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
      @keyframes growLine { from{width:0} to{width:40px} }
      @keyframes spin     { to{transform:rotate(360deg)} }
      @keyframes softGlow { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} 50%{box-shadow:0 0 24px 2px rgba(34,197,94,0.10)} }
      .fade-up { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
      .fade-in { animation: fadeIn 0.9s ease both; }
      .hover-lift { transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease, background 0.25s ease; }
      .hover-lift:hover { transform: translateY(-2px); }
      @media (prefers-reduced-motion: reduce) {
        .fade-up, .fade-in { animation: none !important; }
        .hover-lift { transition: none !important; }
      }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const goTo = (path) => navigate(path);
  const sigColor = signal?.signal === "BUY" ? T.green : signal?.signal === "SELL" ? T.red : T.amber;
  const confBars = Math.round((signal?.confidence ?? 0) / 10);

  const s = {
    root: {
      minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: T.sans, position: "relative", overflow: "hidden",
    },
    nav: {
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 28px", height: 50,
      background: "rgba(4,10,6,0.95)", backdropFilter: "blur(20px)",
      borderBottom: `1px solid ${T.border}`,
    },
    logo: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "none", border: "none" },
    logoMark: {
      width: 26, height: 26, background: T.green, borderRadius: 5,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, color: T.bg, fontWeight: 900,
    },
    logoText: { fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.mint, letterSpacing: "1.5px" },
    navLink: (hov) => ({
      padding: "5px 12px", fontSize: 11, color: hov ? T.mint : "rgba(231,240,234,0.4)",
      border: "none", background: hov ? "rgba(34,197,94,0.07)" : "none",
      cursor: "pointer", borderRadius: 4, fontFamily: T.sans, transition: "all 0.15s",
    }),
    liveBadge: {
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", border: `1px solid rgba(34,197,94,0.25)`,
      borderRadius: 20, fontSize: 9, color: T.green, fontFamily: T.mono, letterSpacing: "1px",
    },
    liveDot: { width: 5, height: 5, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" },
    ctaBtn: {
      padding: "6px 16px", background: T.green, color: T.bg,
      border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700,
      cursor: "pointer", letterSpacing: "0.5px", fontFamily: T.sans, transition: "opacity 0.15s",
    },
    // HERO
    hero: {
      display: "grid", gridTemplateColumns: "1.1fr 0.9fr",
      paddingTop: 50, minHeight: "calc(100vh - 240px)",
      position: "relative", zIndex: 1,
    },
    heroLeft: {
      padding: "44px 36px 30px",
      borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    },
    heroRight: { padding: "32px 28px 24px", display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" },
    eyebrow: {
      fontSize: 9.5, color: T.green, letterSpacing: "3.5px",
      textTransform: "uppercase", fontFamily: T.mono, marginBottom: 14, fontWeight: 600,
    },
    h1: { fontSize: "clamp(30px,4vw,44px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-2.2px", color: "#fff", marginBottom: 8 },
    accentBar: { width: 40, height: 2, background: T.green, margin: "16px 0 16px", animation: "growLine 0.8s 0.5s cubic-bezier(0.16,1,0.3,1) both" },
    desc: { fontSize: 12.5, color: T.textDim, lineHeight: 1.85, maxWidth: 380, marginBottom: 22 },
    btnRow: { display: "flex", gap: 10, alignItems: "center" },
    btnPrimary: {
      padding: "10px 22px", background: T.green, color: T.bg,
      border: "none", borderRadius: 5, fontSize: 10.5, fontWeight: 700,
      cursor: "pointer", letterSpacing: "0.5px", fontFamily: T.sans,
      transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
    },
    btnSecondary: {
      padding: "10px 22px", background: "transparent", color: T.mint,
      border: `1px solid rgba(134,239,172,0.2)`, borderRadius: 5,
      fontSize: 10.5, cursor: "pointer", letterSpacing: "0.5px", fontFamily: T.sans,
      transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
    },
    // PIPELINE
    pipeline: {
      display: "flex", alignItems: "stretch",
      background: "rgba(13,26,19,0.5)", border: `1px solid ${T.border}`,
      borderRadius: 6, overflow: "hidden",
    },
    pipeStep: {
      flex: 1, padding: "8px 4px", textAlign: "center",
      borderRight: `1px solid ${T.border}`,
    },
    // SIGNAL CARD
    signalCard: {
      background: "linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02))",
      border: `1px solid ${T.borderMd}`, borderRadius: 10, padding: "18px 20px",
      animation: "softGlow 4s ease-in-out infinite",
    },
    // BOTTOM
    bottom: {
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      borderTop: `1px solid ${T.border}`,
      position: "relative", zIndex: 1,
    },
    col: { padding: "22px 26px", borderRight: `1px solid ${T.border}` },
    colLast: { padding: "22px 24px" },
    colLabel: {
      fontSize: 7, color: "rgba(231,240,234,0.22)", letterSpacing: "3px",
      textTransform: "uppercase", fontFamily: T.mono, marginBottom: 12,
    },
    // CLIENTS
    clients: { display: "grid", gridTemplateColumns: "1fr 16px 1fr" },
    clientCard: (accent) => ({
      background: "rgba(13,26,19,0.6)",
      border: `1px solid ${T.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 4, padding: "8px 10px",
    }),
    cstat: {
      display: "flex", justifyContent: "space-between",
      padding: "3px 0", borderBottom: `1px solid rgba(34,197,94,0.06)`,
    },
    // MODULES
    modGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 },
    mod: (hov) => ({
      background: hov ? "rgba(34,197,94,0.07)" : "rgba(13,26,19,0.6)",
      border: `1px solid ${hov ? "rgba(34,197,94,0.35)" : T.border}`,
      borderRadius: 5, padding: "9px 6px", cursor: "pointer",
      transform: hov ? "translateY(-2px)" : "translateY(0)",
      transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)", textAlign: "center",
    }),
    // PSYCH
    psychCard: {
      background: "rgba(13,26,19,0.6)",
      border: `1px solid rgba(192,132,252,0.15)`,
      borderLeft: `2px solid ${T.purple}`,
      borderRadius: 6, padding: "14px 16px",
    },
    // FOOTER
    footer: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 28px", borderTop: `1px solid ${T.border}`,
      background: "rgba(4,10,6,0.8)", position: "relative", zIndex: 1,
    },
    footerTag: {
      padding: "3px 8px", background: "rgba(34,197,94,0.07)",
      border: `1px solid rgba(34,197,94,0.15)`, borderRadius: 3,
      fontSize: 7, color: T.green, fontFamily: T.mono, letterSpacing: "1px",
    },
  };

  return (
    <div style={s.root}>
      <ParticleCanvas />

      {/* NAV */}
      <nav style={s.nav}>
        <button style={s.logo} onClick={() => window.scrollTo({ top: 0 })}>
          <div style={s.logoMark}>⚡</div>
          <div style={s.logoText}>AlgoTerminal</div>
        </button>
        <div style={{ display: "flex", gap: 2 }}>
          {["Features","Analytics","Clients","Research"].map((l, i) => (
            <button key={l} style={s.navLink(hovNav === i)}
              onMouseEnter={() => setHovNav(i)} onMouseLeave={() => setHovNav(null)}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={s.liveBadge}><div style={s.liveDot} />LIVE</div>
          <button style={s.ctaBtn} onClick={() => goTo("/dashboard")}
            onMouseOver={e => e.currentTarget.style.opacity = "0.85"}
            onMouseOut={e => e.currentTarget.style.opacity = "1"}>
            Launch App →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={s.hero}>
        {/* LEFT */}
        <div style={s.heroLeft}>
          <div>
            <div className="fade-up" style={{ ...s.eyebrow, animationDelay: "0.05s" }}>● NSEI · Ensemble ML · Real-time Signals</div>
            <h1 className="fade-up" style={{ ...s.h1, animationDelay: "0.15s" }}>
              Quantitative<br/>
              <span style={{ color: T.green }}>Trading</span>{" "}
              <span style={{ color: "rgba(255,255,255,0.4)" }}>meets</span><br/>
              Machine Learning
            </h1>
            <div style={s.accentBar} />
            <p className="fade-up" style={{ ...s.desc, animationDelay: "0.3s" }}>
              Live NSEI data → 27 engineered features →{" "}
              <strong style={{ color: T.mint }}>XGBoost + LightGBM + CatBoost</strong> ensemble → daily{" "}
              <strong style={{ color: T.mint }}>BUY / HOLD signal</strong> with full SHAP explainability.
              Two risk profiles — <strong style={{ color: T.mint }}>QUANT</strong> (aggressive) and{" "}
              <strong style={{ color: T.mint }}>MACRO</strong> (conservative) — run in parallel.
            </p>
            <div className="fade-up" style={{ ...s.btnRow, animationDelay: "0.42s" }}>
              <button style={s.btnPrimary} onClick={() => goTo("/dashboard")}
                onMouseOver={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(34,197,94,0.25)"; }}
                onMouseOut={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                Explore Platform
              </button>
              <button style={s.btnSecondary} onClick={() => goTo("/dashboard")}
                onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(134,239,172,0.5)"; e.currentTarget.style.background = "rgba(134,239,172,0.05)"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(134,239,172,0.2)"; e.currentTarget.style.background = "transparent"; }}>
                View Analytics
              </button>
            </div>
          </div>

          {/* Pipeline */}
          <div className="fade-up" style={{ marginTop: 28, animationDelay: "0.55s" }}>
            <div style={s.colLabel}>Signal Pipeline</div>
            <div style={s.pipeline}>
              {PIPELINE.map((p, i) => (
                <div key={i} className="hover-lift" style={{ ...s.pipeStep, borderRight: i < PIPELINE.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ fontSize: 12, color: T.green, marginBottom: 4 }}>{p.icon}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: T.pale, fontFamily: T.mono }}>{p.label}</div>
                  <div style={{ fontSize: 7, color: T.textFaint, fontFamily: T.mono, marginTop: 2 }}>{p.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={s.heroRight}>
          {/* Signal card */}
          <div className="fade-up" style={{ ...s.signalCard, animationDelay: "0.2s" }}>
            <div style={{ fontSize: 8, color: T.textFaint, letterSpacing: "2px", textTransform: "uppercase", fontFamily: T.mono, marginBottom: 10 }}>
              Today's ML Signal · NSEI
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: sigColor, fontFamily: T.mono, letterSpacing: "-1px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sigColor, animation: "pulse 2s infinite" }} />
                {signal?.signal ?? "—"}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.mint, fontFamily: T.mono }}>{signal?.confidence ?? "—"}%</div>
                <div style={{ fontSize: 7, color: T.textFaint, fontFamily: T.mono, letterSpacing: "1px" }}>CONFIDENCE</div>
              </div>
            </div>
            {/* Confidence bars */}
            <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
              {[...Array(10)].map((_, i) => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < confBars ? sigColor : "rgba(34,197,94,0.1)" }} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Top Driver",    val: signal ? "RSI Divergence" : "—",  color: T.mint  },
                { label: "NSEI Close",    val: signal?.close ? `₹${signal.close.toLocaleString("en-IN")}` : "—", color: T.text },
                { label: "Strategy Rtn",  val: stats ? `+${stats.total_return}%` : "—", color: T.green },
                { label: "Win Rate",      val: stats ? `${stats.win_rate}%` : "—", color: T.mint  },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "6px 8px" }}>
                  <div style={{ fontSize: 7, color: T.textFaint, letterSpacing: "1px", textTransform: "uppercase", fontFamily: T.mono, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T.mono, color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* QUANT vs MACRO mini */}
          <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, animationDelay: "0.35s" }}>
            {[
              { name: "QUANT", ret: "+848%", alpha: "+681%", color: T.green, border: T.green, sub: "vs NSEI +167%" },
              { name: "MACRO", ret: "+251%", alpha: "+84%",  color: T.blue,  border: T.blue,  sub: "alpha +83.72%" },
            ].map(c => (
              <div key={c.name} className="hover-lift" style={{
                background: "rgba(13,26,19,0.7)",
                border: `1px solid rgba(${c.color === T.green ? "34,197,94" : "96,165,250"},0.12)`,
                borderTop: `2px solid ${c.border}`,
                borderRadius: 6, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 7, color: T.textFaint, fontFamily: T.mono, letterSpacing: "1px", marginBottom: 3 }}>{c.name} RETURN</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color, fontFamily: T.mono, letterSpacing: "-1px" }}>{c.ret}</div>
                <div style={{ fontSize: 7, color: T.textFaint, fontFamily: T.mono, marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM 3-COL */}
      <div className="fade-in" style={{ ...s.bottom, animationDelay: "0.5s" }}>
        {/* COL 1: Dual clients */}
        <div style={s.col}>
          <div style={s.colLabel}>Dual Client Engine</div>
          <div style={s.clients}>
            {[
              { name: "QUANT", style: "Aggressive", color: T.green, threshold: "≥55%", position: "95%", stop: "3%", ret: "+848%", alpha: "+681%" },
              { name: "MACRO", style: "Conservative", color: T.blue,  threshold: "≥65%", position: "60%", stop: "1.5%", ret: "+251%", alpha: "+84%" },
            ].map((c, ci) => (
              <div key={c.name}>
                {ci === 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "rgba(231,240,234,0.1)", fontFamily: T.mono }}>VS</div>
                )}
                <div className="hover-lift" style={s.clientCard(c.color)}>
                  <div style={{ fontSize: 10, fontWeight: 800, fontFamily: T.mono, letterSpacing: "1.5px", color: c.color }}>{c.name}</div>
                  <div style={{ fontSize: 6.5, color: T.textFaint, letterSpacing: "1px", textTransform: "uppercase", fontFamily: T.mono, marginBottom: 5 }}>{c.style}</div>
                  {[
                    ["Threshold", c.threshold, c.color],
                    ["Position", c.position, T.text],
                    ["Stop loss", c.stop, T.red],
                    ["Return", c.ret, T.green],
                    ["Alpha", c.alpha, T.green],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ ...s.cstat, borderBottom: label === "Alpha" ? "none" : `1px solid rgba(34,197,94,0.06)` }}>
                      <span style={{ fontSize: 7, color: T.textFaint, fontFamily: T.mono }}>{label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, fontFamily: T.mono, color }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )).reduce((acc, el, i) => i === 1 ? [...acc, <div key="vs" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "rgba(231,240,234,0.1)", fontFamily: T.mono }}>VS</div>, el] : [...acc, el], [])}
          </div>
        </div>

        {/* COL 2: Modules */}
        <div style={s.col}>
          <div style={s.colLabel}>Platform Modules</div>
          <div style={s.modGrid}>
            {MODULES.map((m, i) => (
              <div key={i}
                style={s.mod(hovMod === i)}
                onMouseEnter={() => setHovMod(i)}
                onMouseLeave={() => setHovMod(null)}
                onClick={() => goTo(m.path)}
              >
                <div style={{ fontSize: 11, color: T.green, marginBottom: 3 }}>{m.icon}</div>
                <div style={{ fontSize: 7, fontWeight: 600, color: hovMod === i ? T.pale : T.textDim, fontFamily: T.mono, lineHeight: 1.2 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 3: Psychology */}
        <div style={s.colLast}>
          <div style={s.colLabel}>Psychology Engine</div>
          <div style={s.psychCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.purple, fontFamily: T.mono, letterSpacing: "0.5px" }}>◎ PSYCHOLOGY MONITOR</div>
                <div style={{ fontSize: 7.5, color: T.textFaint, fontFamily: T.mono, marginTop: 3, lineHeight: 1.5 }}>
                  Detects revenge trading,<br/>loss aversion & recency bias
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 7, color: T.textFaint, fontFamily: T.mono, letterSpacing: "1px" }}>HEALTH</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.green, fontFamily: T.mono }}>
                  82<span style={{ fontSize: 11, opacity: 0.4 }}>/100</span>
                </div>
              </div>
            </div>
            {/* Bar */}
            <div style={{ height: 3, background: "rgba(34,197,94,0.1)", borderRadius: 2, marginBottom: 8 }}>
              <div style={{ height: "100%", width: "82%", background: T.green, borderRadius: 2 }} />
            </div>
            {[
              { dot: T.green,  text: "HEALTHY — Trading well. Continue normally." },
              { dot: T.amber,  text: "Win rate 56.2% last 5 trades — in range"   },
              { dot: T.green,  text: "No consecutive losses detected"             },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8, color: "rgba(231,240,234,0.38)", fontFamily: T.mono, marginBottom: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: a.dot, flexShrink: 0 }} />
                {a.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={s.footer}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 8, color: "rgba(231,240,234,0.18)", fontFamily: T.mono, letterSpacing: "1.5px" }}>
            © 2025 ALGOTERMINAL · BUILT BY BHANU
          </div>
          <div style={s.footerTag}>NSEI QUANTITATIVE INTELLIGENCE</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["VERCEL FRONTEND", "RENDER BACKEND", "LIVE API"].map(t => (
            <div key={t} style={s.footerTag}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}