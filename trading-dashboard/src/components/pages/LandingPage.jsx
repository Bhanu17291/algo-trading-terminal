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

const MODEL_FACTS = [
  { val: "1,481", label: "Days Trained",  sub: "NSEI OHLCV 2020–26" },
  { val: "27",    label: "Features",      sub: "Engineered indicators" },
  { val: "3",     label: "Model Ensemble",sub: "XGB + LGBM + CatBoost" },
  { val: "0",     label: "Look-Ahead Bias", sub: "Walk-forward validated" },
];

// Two-path fork — replaces the flat "Platform Modules" icon grid.
// Signal Engine = research/prediction side (green, matches primary brand color).
// Strategy Lab  = execution/quant side (blue, matches the existing MACRO accent).
const SIGNAL_ITEMS = [
  { icon: "◈", label: "ML Engine",   sub: "Ensemble signal generation", path: "/dashboard"  },
  { icon: "◉", label: "Explainer",   sub: "SHAP feature importance",    path: "/explainer"  },
  { icon: "∿", label: "Indicators",  sub: "RSI, MACD, Bollinger, SMA",  path: "/indicators" },
  { icon: "◐", label: "Screener",    sub: "Scan for setups",           path: "/screener"   },
  { icon: "☰", label: "News",        sub: "Market context feed",       path: "/news"       },
];

const STRATEGY_ITEMS = [
  { icon: "⚖", label: "Clients",     sub: "QUANT vs MACRO head-to-head", path: "/clients"   },
  { icon: "⟲", label: "Backtest",    sub: "Walk-forward performance",    path: "/backtest"  },
  { icon: "⊕", label: "Risk Calc",   sub: "Position sizing presets",     path: "/risk"      },
  { icon: "∑", label: "Simulator",   sub: "Scale to custom capital",     path: "/simulator" },
  { icon: "↘", label: "Drawdown",    sub: "3-way drawdown comparison",   path: "/drawdown"  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null); // { action: "BUY"|"HOLD", confidence: 0-1 }
  const [hovNav, setHovNav] = useState(null);
  const [hovFork, setHovFork] = useState(null); // "signal" | "strategy" | null
  const [hovItem, setHovItem] = useState(null); // "signal-0" etc.

  useEffect(() => {
    fetchJson("/market-status").then(setMarket).catch(() => {});
    // Point this at your actual latest-signal endpoint (e.g. /signal/latest).
    // Falls back to a neutral placeholder if the route isn't available yet,
    // so the card never shows broken or fabricated data.
    fetchJson("/signal/latest").then(setSignal).catch(() => setSignal(null));
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
      display: "flex", flexDirection: "column", justifyContent: "flex-start",
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
    // CREDENTIALS STRIP — subtle, sits just above the footer
    credStrip: {
      display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap",
      gap: "6px 0", padding: "16px 36px",
      borderTop: `1px solid ${T.border}`,
      position: "relative", zIndex: 1,
    },
    credItem: {
      fontSize: 8.5, fontFamily: T.mono, color: T.textFaint, letterSpacing: "0.3px",
      padding: "0 14px", borderRight: `1px solid rgba(231,240,234,0.08)`,
    },
    // PITCH CARD — why AlgoTerminal / why quant trading
    pitchCard: {
      background: "linear-gradient(135deg,rgba(34,197,94,0.07),rgba(96,165,250,0.03))",
      border: `1px solid ${T.borderMd}`, borderRadius: 10, padding: "18px 20px",
      animation: "softGlow 4s ease-in-out infinite",
    },
    // FORK
    forkSection: {
      padding: "36px 36px 40px",
      borderTop: `1px solid ${T.border}`,
      position: "relative", zIndex: 1,
    },
    forkHead: { textAlign: "center", marginBottom: 22 },
    forkGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    forkCard: (accent, hov) => ({
      background: hov ? "rgba(13,26,19,0.85)" : "rgba(13,26,19,0.6)",
      border: `1px solid ${hov ? accent + "55" : T.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 8, padding: "20px 22px",
      display: "flex", flexDirection: "column",
    }),
    forkEyebrow: (accent) => ({
      display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
      padding: "3px 10px", borderRadius: 20, marginBottom: 12,
      background: `${accent}14`, color: accent,
      fontSize: 8.5, fontFamily: T.mono, letterSpacing: "1.5px", textTransform: "uppercase",
    }),
    forkTitle: { fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.4px" },
    forkDesc: { fontSize: 10.5, color: T.textDim, lineHeight: 1.7, marginBottom: 16 },
    forkItem: (accent, hov) => ({
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 4px", cursor: "pointer",
      borderTop: `1px solid rgba(231,240,234,0.06)`,
      background: hov ? `${accent}0d` : "transparent",
      transition: "background 0.15s",
    }),
    forkCta: (accent) => ({
      marginTop: 14, alignSelf: "flex-start",
      padding: "8px 18px", background: accent, color: T.bg,
      border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700,
      cursor: "pointer", letterSpacing: "0.5px", fontFamily: T.sans,
    }),
    colLabel: {
      fontSize: 7, color: "rgba(231,240,234,0.22)", letterSpacing: "3px",
      textTransform: "uppercase", fontFamily: T.mono, marginBottom: 12,
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

  const renderForkCard = (key, accent, eyebrow, title, desc, items, ctaLabel, ctaPath, preview) => (
    <div
      className="hover-lift"
      style={s.forkCard(accent, hovFork === key)}
      onMouseEnter={() => setHovFork(key)}
      onMouseLeave={() => setHovFork(null)}
    >
      <div style={s.forkEyebrow(accent)}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
        {eyebrow}
      </div>
      <div style={s.forkTitle}>{title}</div>
      <div style={s.forkDesc}>{desc}</div>
      {preview}

      <div style={{ flex: 1 }}>
        {items.map((item, i) => {
          const id = `${key}-${i}`;
          return (
            <div
              key={id}
              style={{ ...s.forkItem(accent, hovItem === id), borderTop: i === 0 ? "none" : s.forkItem(accent, false).borderTop }}
              onMouseEnter={() => setHovItem(id)}
              onMouseLeave={() => setHovItem(null)}
              onClick={() => goTo(item.path)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: accent }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontFamily: T.mono, color: hovItem === id ? T.pale : T.text }}>{item.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 8, fontFamily: T.mono, color: T.textFaint }}>{item.sub}</span>
                <span style={{
                  fontSize: 9, color: accent, fontFamily: T.mono,
                  opacity: hovItem === id ? 1 : 0,
                  transform: hovItem === id ? "translateX(0)" : "translateX(-4px)",
                  transition: "opacity 0.15s, transform 0.15s",
                }}>→</span>
              </div>
            </div>
          );
        })}
      </div>

      <button style={s.forkCta(accent)} onClick={() => goTo(ctaPath)}>
        {ctaLabel} →
      </button>
    </div>
  );

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
          {["Features","Analytics","Clients"].map((l, i) => (
            <button key={l} style={s.navLink(hovNav === i)}
              onMouseEnter={() => setHovNav(i)} onMouseLeave={() => setHovNav(null)}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ ...s.liveBadge, borderColor: market?.is_open ? "rgba(34,197,94,0.25)" : "rgba(248,113,113,0.25)", color: market?.is_open ? T.green : T.red }}>
            <div style={{ ...s.liveDot, background: market?.is_open ? T.green : T.red }} />
            {market ? `NSEI ${market.status}` : "LIVE"}
            {market?.current_time_ist && <span style={{ opacity: 0.5, marginLeft: 4 }}>· {market.current_time_ist} IST</span>}
          </div>
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
              <button style={s.btnPrimary} onClick={() => document.getElementById("path-fork")?.scrollIntoView({ behavior: "smooth" })}
                onMouseOver={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(34,197,94,0.25)"; }}
                onMouseOut={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                Choose a path ↓
              </button>
              <button style={s.btnSecondary} onClick={() => goTo("/dashboard")}
                onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(134,239,172,0.5)"; e.currentTarget.style.background = "rgba(134,239,172,0.05)"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(134,239,172,0.2)"; e.currentTarget.style.background = "transparent"; }}>
                View Analytics
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={s.heroRight}>
          {/* Pitch card — why AlgoTerminal, why quant trading */}
          <div className="fade-up" style={{ ...s.pitchCard, animationDelay: "0.2s" }}>
            <div style={{ fontSize: 8, color: T.textFaint, letterSpacing: "2px", textTransform: "uppercase", fontFamily: T.mono, marginBottom: 12 }}>
              Why AlgoTerminal
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.4, marginBottom: 14 }}>
              Trading decisions, minus the guesswork.
            </div>
            {[
              { icon: "◈", title: "Data over conviction", sub: "Every call comes from a 27-feature ensemble, not a hunch" },
              { icon: "◉", title: "No black box", sub: "SHAP explainability shows exactly why a signal fired" },
              { icon: "⚖", title: "Built for your risk appetite", sub: "QUANT and MACRO profiles, so the system matches you" },
              { icon: "⟲", title: "Tested honestly", sub: "Walk-forward validated — zero look-ahead bias" },
            ].map((row, i) => (
              <div key={row.title} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "9px 0",
                borderTop: i === 0 ? "none" : `1px solid rgba(231,240,234,0.06)`,
              }}>
                <span style={{ fontSize: 13, color: T.green, marginTop: 1 }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.pale, fontFamily: T.mono }}>{row.title}</div>
                  <div style={{ fontSize: 9, color: T.textDim, fontFamily: T.mono, marginTop: 2, lineHeight: 1.5 }}>{row.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 8.5, color: T.textFaint, fontFamily: T.mono, lineHeight: 1.6 }}>
              Quant trading isn't about predicting the future — it's about stacking small, disciplined edges and letting them compound. This is where you start.
            </div>
          </div>
        </div>
      </div>

      {/* PATH FORK — the two-way split */}
      <div id="path-fork" className="fade-in" style={s.forkSection}>
        <div style={s.forkHead}>
          <div style={{ fontSize: 8.5, color: T.textFaint, letterSpacing: "3px", textTransform: "uppercase", fontFamily: T.mono, marginBottom: 8 }}>
            $ choose a path
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            Read the market, or trade it
          </div>
        </div>
        <div style={s.forkGrid}>
          {renderForkCard(
            "signal", T.green, "Signal Engine", "See the signal, not the noise",
            "A daily BUY/HOLD call on the NSEI from a 27-feature ensemble, with full SHAP explainability behind every call — so you know why, not just what.",
            SIGNAL_ITEMS, "Explore signals", "/onboarding",
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", marginBottom: 14, borderRadius: 6,
              background: "rgba(34,197,94,0.06)", border: `1px solid rgba(34,197,94,0.15)`,
            }}>
              <span style={{ fontSize: 8.5, fontFamily: T.mono, color: T.textFaint, letterSpacing: "1px", textTransform: "uppercase" }}>
                Today's call
              </span>
              {signal ? (
                <span style={{ fontSize: 10.5, fontFamily: T.mono, fontWeight: 700, color: signal.action === "BUY" ? T.green : T.amber }}>
                  {signal.action} · {Math.round((signal.confidence ?? 0) * 100)}%
                </span>
              ) : (
                <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textFaint }}>— live on launch —</span>
              )}
            </div>
          )}
          {renderForkCard(
            "strategy", T.blue, "Strategy Lab", "Turn the call into a position",
            "QUANT and MACRO profiles run the same signal at different risk levels — backtested and position-sized, with more strategies shipping over time.",
            STRATEGY_ITEMS, "Explore strategies", "/clients"
          )}
        </div>
      </div>

      {/* CREDENTIALS — subtle, sits just above the footer */}
      <div className="fade-in" style={s.credStrip}>
        {MODEL_FACTS.map((f, i) => (
          <span key={f.label} style={{ ...s.credItem, borderRight: i === MODEL_FACTS.length - 1 ? "none" : s.credItem.borderRight }}>
            <span style={{ color: T.mint, fontWeight: 700 }}>{f.val}</span>{" "}
            <span>{f.label.toLowerCase()}</span>
            <span style={{ color: "rgba(231,240,234,0.15)" }}> · {f.sub.toLowerCase()}</span>
          </span>
        ))}
      </div>

      {/* FOOTER */}
      <div style={s.footer}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 8, color: "rgba(231,240,234,0.18)", fontFamily: T.mono, letterSpacing: "1.5px" }}>
            © {new Date().getFullYear()} ALGOTERMINAL · BUILT BY BHANU
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