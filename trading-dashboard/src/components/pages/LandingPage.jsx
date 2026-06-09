import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  bg:        "#060D0A",
  surface:   "#0C1A14",
  card:      "#101F17",
  border:    "rgba(34,197,94,0.14)",
  primary:   "#22C55E",
  accent:    "#86EFAC",
  highlight: "#BBF7D0",
  muted:     "#4B7A5E",
  text:      "#E7F0EA",
  textDim:   "rgba(231,240,234,0.5)",
  textFaint: "rgba(231,240,234,0.28)",
  danger:    "#F87171",
  warning:   "#FBBF24",
};

const S = {
  root: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    background: C.bg, color: C.text,
    overflowX: "hidden", minHeight: "100vh",
  },
  loader: (done) => ({
    position: "fixed", inset: 0, zIndex: 9999, background: C.bg,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    transition: "opacity 0.9s ease, visibility 0.9s ease",
    opacity: done ? 0 : 1, visibility: done ? "hidden" : "visible",
    pointerEvents: done ? "none" : "all",
  }),
  loaderLogo: { fontSize: 13, letterSpacing: "4px", textTransform: "uppercase", color: C.accent, marginBottom: 32, fontFamily: "'Segoe UI', sans-serif" },
  loaderBar:  { width: 180, height: 1, background: "rgba(34,197,94,0.12)", marginTop: 20 },
  loaderFill: (pct) => ({ height: "100%", width: `${pct}%`, background: C.primary, transition: "width 0.08s linear" }),
  loaderPct:  { fontSize: 11, color: C.muted, marginTop: 12, letterSpacing: "1px", fontFamily: "'Segoe UI', sans-serif" },

  nav: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 6%", height: 60,
    background: "rgba(6,13,10,0.88)", backdropFilter: "blur(20px)",
    borderBottom: `1px solid ${C.border}`,
  },
  logo:     { fontSize: 15, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: C.accent, fontFamily: "'Segoe UI', sans-serif", cursor: "pointer", background: "none", border: "none" },
  navLinks: { display: "flex", gap: 36, listStyle: "none", margin: 0, padding: 0 },
  navLink:  { fontSize: 12.5, color: C.textDim, cursor: "pointer", letterSpacing: "0.6px", fontFamily: "'Segoe UI', sans-serif", textTransform: "uppercase", background: "none", border: "none", outline: "none" },
  navCta:   { padding: "7px 20px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1px solid ${C.primary}`, color: C.primary, letterSpacing: "0.8px", textTransform: "uppercase", fontFamily: "'Segoe UI', sans-serif", transition: "background 0.2s, color 0.2s" },

  hero: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: "120px 6% 80px", textAlign: "center", position: "relative", zIndex: 1 },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 2, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)", fontSize: 10.5, letterSpacing: "2px", textTransform: "uppercase", color: C.accent, marginBottom: 32, fontFamily: "'Segoe UI', sans-serif" },
  heroDot:   { width: 5, height: 5, borderRadius: "50%", background: C.primary, animation: "blink 2s infinite" },
  h1:        { fontSize: "clamp(2.2rem,5vw,4rem)", fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.5px", marginBottom: 22, color: C.highlight, maxWidth: 780 },
  h1Span:    { color: C.primary },
  heroSub:   { fontSize: "clamp(0.9rem,1.6vw,1.05rem)", color: C.textDim, maxWidth: 580, lineHeight: 1.8, marginBottom: 44, fontFamily: "'Segoe UI', sans-serif" },
  heroButtons: { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", position: "relative", zIndex: 2 },
  btnPrimary:   { padding: "12px 30px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: C.primary, color: "#060D0A", letterSpacing: "0.5px", fontFamily: "'Segoe UI', sans-serif", transition: "opacity 0.2s", position: "relative", zIndex: 2 },
  btnSecondary: { padding: "12px 30px", borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: "pointer", background: "transparent", border: "1px solid rgba(134,239,172,0.3)", color: C.accent, letterSpacing: "0.5px", fontFamily: "'Segoe UI', sans-serif", transition: "border-color 0.2s, color 0.2s", position: "relative", zIndex: 2 },

  statsStrip: { display: "flex", flexWrap: "wrap", justifyContent: "center", padding: "50px 6%", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.surface, position: "relative", zIndex: 1 },
  statCard:   { flex: "1 1 130px", textAlign: "center", padding: "24px 16px", borderRight: `1px solid ${C.border}` },
  statNum:    { fontSize: 30, fontWeight: 700, color: C.primary, fontFamily: "'Segoe UI', sans-serif" },
  statLabel:  { fontSize: 11, color: C.textFaint, marginTop: 6, letterSpacing: "0.8px", textTransform: "uppercase", fontFamily: "'Segoe UI', sans-serif" },

  marqueeWrap:  { position: "relative", overflow: "hidden", padding: "12px 0" },
  marqueeGradL: { position: "absolute", left: 0, top: 0, bottom: 0, width: 80, zIndex: 2, background: `linear-gradient(90deg,${C.bg},transparent)`, pointerEvents: "none" },
  marqueeGradR: { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, zIndex: 2, background: `linear-gradient(-90deg,${C.bg},transparent)`, pointerEvents: "none" },
  marqueeTrack: (dir, paused) => ({ display: "flex", gap: 10, width: "max-content", animation: `marquee${dir} 36s linear infinite`, animationPlayState: paused ? "paused" : "running" }),
  marqueeBadge: { padding: "6px 16px", borderRadius: 2, fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap", letterSpacing: "0.6px", border: "1px solid rgba(34,197,94,0.18)", background: "rgba(34,197,94,0.04)", color: C.muted, textTransform: "uppercase", fontFamily: "'Segoe UI', sans-serif" },

  section:      { padding: "90px 6%", position: "relative", zIndex: 1 },
  sectionLabel: { fontSize: 10.5, letterSpacing: "2.5px", textTransform: "uppercase", color: C.muted, marginBottom: 14, fontFamily: "'Segoe UI', sans-serif" },
  sectionTitle: { fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: 16, color: C.highlight },
  sectionSub:   { fontSize: 14.5, color: C.textDim, maxWidth: 520, lineHeight: 1.8, fontFamily: "'Segoe UI', sans-serif" },

  featureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 1, marginTop: 56, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" },
  featureCard: (hov) => ({ padding: "32px 28px", background: hov ? "rgba(34,197,94,0.06)" : C.card, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, transition: "background 0.25s", cursor: "default" }),
  featureIcon:  { fontSize: 22, marginBottom: 16 },
  featureTitle: { fontSize: 15, fontWeight: 600, marginBottom: 10, color: C.highlight, fontFamily: "'Segoe UI', sans-serif" },
  featureDesc:  { fontSize: 13, color: C.textDim, lineHeight: 1.75, fontFamily: "'Segoe UI', sans-serif" },
  featureTag:   { display: "inline-block", marginTop: 14, padding: "2px 9px", borderRadius: 2, fontSize: 10, letterSpacing: "0.8px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", color: C.muted, textTransform: "uppercase", fontFamily: "'Segoe UI', sans-serif" },

  archWrap:      { display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 56 },
  archNode: (i) => ({ display: "flex", alignItems: "center", gap: 18, padding: "16px 28px", borderRadius: 4, background: C.card, border: `1px solid ${C.border}`, width: "100%", maxWidth: 460, animation: `fadeUp 0.5s ease ${i * 0.1}s both` }),
  archConnector: { width: 1, height: 24, background: C.muted, opacity: 0.4 },
  archNum:       { width: 28, height: 28, borderRadius: 2, flexShrink: 0, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.primary, fontFamily: "'Segoe UI', sans-serif" },
  archLabel:     { fontSize: 14, fontWeight: 600, color: C.highlight, fontFamily: "'Segoe UI', sans-serif" },
  archSub:       { fontSize: 11.5, color: C.textFaint, marginTop: 2, fontFamily: "'Segoe UI', sans-serif" },

  analyticsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 1, marginTop: 56, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" },
  analyticsCard: { padding: "22px 20px", background: C.card, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` },
  analyticsLabel:{ fontSize: 10, color: C.textFaint, letterSpacing: "1.2px", marginBottom: 10, textTransform: "uppercase", fontFamily: "'Segoe UI', sans-serif" },
  signalBuy:     { display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 2, fontSize: 12, fontWeight: 700, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: C.primary, fontFamily: "'Segoe UI', sans-serif" },

  ctaSection: { padding: "100px 6%", textAlign: "center", background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, position: "relative", zIndex: 1 },

  footer:      { padding: "56px 6% 36px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 40, position: "relative", zIndex: 1 },
  footerTitle: { fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 16, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'Segoe UI', sans-serif" },
  footerLink:  { display: "block", fontSize: 12.5, color: C.textFaint, marginBottom: 10, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif", background: "none", border: "none", outline: "none", textAlign: "left", padding: 0 },
  footerCopy:  { padding: "20px 6%", textAlign: "center", fontSize: 11, color: C.textFaint, borderTop: `1px solid ${C.border}`, fontFamily: "'Segoe UI', sans-serif", letterSpacing: "0.4px", position: "relative", zIndex: 1 },
};

/* ── Data ───────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: "◈", tag: "XGBoost · LightGBM · CatBoost", title: "Ensemble ML Engine",   desc: "Combines three gradient boosting frameworks to reduce variance and improve signal robustness across NSEI market regimes." },
  { icon: "◎", tag: "BUY · HOLD · Real-Time",         title: "Signal Generation",    desc: "Generates actionable trading recommendations using live feature pipelines and ensemble model consensus scores." },
  { icon: "◉", tag: "SHAP · Transparency",             title: "Explainable AI",       desc: "Surfaces SHAP feature attributions for every signal — showing exactly which indicators drove each recommendation." },
  { icon: "▦", tag: "PnL · Holdings · Exposure",       title: "Portfolio Analytics",  desc: "Institutional-grade dashboard tracking live holdings, cumulative PnL, risk exposure, and portfolio drawdown in real time." },
  { icon: "⟲", tag: "Historical · Walk-Forward",       title: "Backtesting Engine",   desc: "Evaluate strategies against full NSEI price history using walk-forward validation and out-of-sample performance metrics." },
  { icon: "⊕", tag: "Position Sizing · VaR",           title: "Risk Management",      desc: "Quantitative position sizing, stop-loss simulation, maximum drawdown controls, and portfolio-level exposure management." },
  { icon: "∑", tag: "Factor Models · Alpha",            title: "Quant Simulator",      desc: "Simulates factor-based investment strategies and alpha signal execution across configurable time horizons." },
  { icon: "⊞", tag: "Macro · Regime Analysis",          title: "Macro Simulator",      desc: "Models macroeconomic regime shifts and aligns portfolio positioning with prevailing market conditions." },
];

const ARCH = [
  { label: "Market Data Ingestion",  sub: "NSEI OHLCV · Volume · Orderflow" },
  { label: "Feature Engineering",    sub: "150+ Technical & Macro Indicators" },
  { label: "Ensemble ML Models",     sub: "XGBoost · LightGBM · CatBoost" },
  { label: "SHAP Explainability",    sub: "Per-signal feature attribution" },
  { label: "Signal Engine",          sub: "BUY / HOLD generation pipeline" },
  { label: "Portfolio Management",   sub: "Holdings tracking · PnL analytics" },
  { label: "Risk Analytics",         sub: "Drawdown · Position sizing · VaR" },
];

const STATS = [
  { num: "92%",   label: "Signal Accuracy" },
  { num: "500K+", label: "Historical Records" },
  { num: "150+",  label: "Indicators Evaluated" },
  { num: "24/7",  label: "Market Monitoring" },
  { num: "50+",   label: "Backtest Scenarios" },
  { num: "<1ms",  label: "Signal Latency" },
];

const MARQUEE1 = ["Machine Learning","Quantitative Finance","Explainable AI","Portfolio Analytics","NSEI Signals","Backtesting","Risk Management","Walk-Forward Validation","Alpha Generation","Factor Models"];
const MARQUEE2 = ["XGBoost","LightGBM","CatBoost","SHAP","MACD","RSI","Bollinger Bands","Drawdown Analytics","Heatmaps","Position Sizing","Quant Investing","Macro Investing","ATR","EMA","Regime Detection"];

// Nav items scroll to section IDs on this page
const NAV_ITEMS = [
  { label: "Features",     id: "features"     },
  { label: "Architecture", id: "architecture" },
  { label: "Analytics",    id: "analytics"    },
  { label: "Research",     id: "research"     },
];

// Footer links navigate to actual dashboard routes
const FOOTER_COLS = [
  {
    title: "Platform",
    links: [
      { label: "Dashboard",    path: "/dashboard"  },
      { label: "Trade Log",    path: "/trades"     },
      { label: "Backtesting",  path: "/backtest"   },
      { label: "Walk-Forward", path: "/backtest"   },
    ],
  },
  {
    title: "Analytics",
    links: [
      { label: "Portfolio",    path: "/dashboard"  },
      { label: "Drawdown",     path: "/drawdown"   },
      { label: "Heatmaps",     path: "/heatmap"    },
      { label: "Indicators",   path: "/indicators" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Quant Simulator", path: "/simulator"  },
      { label: "ML Explainer",    path: "/explainer"  },
      { label: "Screener",        path: "/screener"   },
      { label: "Clients",         path: "/clients"    },
    ],
  },
];

/* ── Sub-components ─────────────────────────────────────────────────── */
function CandleChart() {
  const candles = [
    {x:10,o:80,c:62,h:55,l:88,bull:false},{x:34,o:63,c:48,h:42,l:68,bull:true},
    {x:58,o:47,c:58,h:40,l:62,bull:true},{x:82,o:57,c:50,h:44,l:63,bull:false},
    {x:106,o:51,c:38,h:30,l:55,bull:true},{x:130,o:39,c:52,h:32,l:57,bull:true},
    {x:154,o:53,c:44,h:38,l:58,bull:false},{x:178,o:45,c:32,h:26,l:50,bull:true},
    {x:202,o:33,c:47,h:26,l:52,bull:true},{x:226,o:48,c:40,h:34,l:54,bull:false},
    {x:250,o:41,c:28,h:20,l:46,bull:true},
  ];
  return (
    <svg viewBox="0 0 290 110" style={{ width:"100%", maxWidth:320, opacity:0.9 }}>
      {candles.map((c,i)=>(
        <g key={i}>
          <line x1={c.x+7} y1={c.h} x2={c.x+7} y2={c.l} stroke={c.bull?"#22C55E":"#F87171"} strokeWidth="1"/>
          <rect x={c.x} y={Math.min(c.o,c.c)} width={14} height={Math.abs(c.o-c.c)||2} fill={c.bull?"#22C55E":"#F87171"} rx="1" opacity="0.85"/>
        </g>
      ))}
      <polyline points="17,80 41,63 65,47 89,57 113,51 137,39 161,53 185,45 209,33 233,48 257,41"
        fill="none" stroke="#86EFAC" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.45"/>
    </svg>
  );
}

function MiniBar({ color = "#22C55E" }) {
  const bars = [28,44,38,60,50,72,58,80,66,88];
  return (
    <svg viewBox="0 0 110 44" style={{ width:"100%", height:44 }}>
      {bars.map((h,i)=>(
        <rect key={i} x={i*11+1} y={44-h*0.42} width={9} height={h*0.42}
          fill={color} opacity={0.18+(i/bars.length)*0.7} rx="1.5"/>
      ))}
    </svg>
  );
}

function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(()=>{
    const canvas=ref.current, ctx=canvas.getContext("2d");
    let W,H,pts=[],raf;
    function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
    resize(); window.addEventListener("resize",resize);
    for(let i=0;i<48;i++) pts.push({ x:Math.random()*1400, y:Math.random()*900, vx:(Math.random()-0.5)*0.25, vy:(Math.random()-0.5)*0.25, r:Math.random()*1.2+0.4 });
    function draw(){
      ctx.clearRect(0,0,W,H);
      pts.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle="rgba(34,197,94,0.28)"; ctx.fill(); });
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){ const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy); if(d<120){ ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.strokeStyle=`rgba(34,197,94,${0.06*(1-d/120)})`; ctx.lineWidth=0.5; ctx.stroke(); } }
      raf=requestAnimationFrame(draw);
    }
    draw();
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", opacity:0.55 }}/>;
}

function Marquee({ items, reverse }) {
  const [paused,setPaused]=useState(false);
  const doubled=[...items,...items];
  return (
    <div style={S.marqueeWrap} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
      <div style={S.marqueeGradL}/><div style={S.marqueeGradR}/>
      <div style={S.marqueeTrack(reverse?"R":"L",paused)}>
        {doubled.map((t,i)=><span key={i} style={S.marqueeBadge}>— {t}</span>)}
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [loaderDone, setLoaderDone] = useState(false);
  const [loadPct, setLoadPct]       = useState(0);
  const [hovCard, setHovCard]       = useState(null);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToDashboard = () => navigate("/dashboard");

  useEffect(()=>{
    const iv=setInterval(()=>{
      setLoadPct(p=>{ if(p>=100){ clearInterval(iv); setTimeout(()=>setLoaderDone(true),500); return 100; } return Math.min(100,p+Math.random()*10); });
    },75);
    return ()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=`
      @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
      @keyframes marqueeL{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      @keyframes marqueeR{from{transform:translateX(-50%)}to{transform:translateX(0)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      .chart-float{animation:floatY 5s ease-in-out infinite}
    `;
    document.head.appendChild(el);
    return ()=>document.head.removeChild(el);
  },[]);

  return (
    <div style={S.root}>
      <ParticleCanvas/>

      {/* LOADER */}
      <div style={S.loader(loaderDone)}>
        <div style={S.loaderLogo}>AlgoTerminal · NSEI</div>
        <div style={{ fontSize:11, color:C.textFaint, letterSpacing:"2px", fontFamily:"'Segoe UI',sans-serif" }}>Initialising Signal Engine</div>
        <div style={S.loaderBar}><div style={S.loaderFill(loadPct)}/></div>
        <div style={S.loaderPct}>{Math.min(100,Math.round(loadPct))}%</div>
      </div>

      {/* NAV */}
      <nav style={S.nav}>
        <button style={S.logo} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>AlgoTerminal</button>
        <ul style={S.navLinks}>
          {NAV_ITEMS.map(({label,id})=>(
            <li key={label}>
              <button style={S.navLink} onClick={()=>scrollTo(id)}
                onMouseOver={e=>e.currentTarget.style.color=C.accent}
                onMouseOut={e=>e.currentTarget.style.color=C.textDim}>
                {label}
              </button>
            </li>
          ))}
        </ul>
        <button style={S.navCta} onClick={goToDashboard}
          onMouseOver={e=>{e.currentTarget.style.background=C.primary;e.currentTarget.style.color="#060D0A"}}
          onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.primary}}>
          Launch App
        </button>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <div style={S.heroBadge}><span style={S.heroDot}/> Live · NSEI · ML Signals</div>
        <h1 style={S.h1}>AI-Powered Quantitative<br/><span style={S.h1Span}>Trading Intelligence</span></h1>
        <p style={S.heroSub}>Machine Learning, Explainable AI, Backtesting, Portfolio Analytics, and Institutional-Grade Risk Management for NSEI Markets.</p>
        <div style={S.heroButtons}>
          <button style={S.btnPrimary} onClick={goToDashboard}
            onMouseOver={e=>e.currentTarget.style.opacity="0.85"}
            onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            Explore Platform
          </button>
          <button style={S.btnSecondary} onClick={()=>scrollTo("analytics")}
            onMouseOver={e=>{e.currentTarget.style.borderColor="rgba(134,239,172,0.6)";e.currentTarget.style.color=C.highlight}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="rgba(134,239,172,0.3)";e.currentTarget.style.color=C.accent}}>
            View Analytics
          </button>
        </div>

        {/* Floating chart */}
        <div className="chart-float" style={{ marginTop:60, display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center", alignItems:"flex-end" }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"20px 22px", minWidth:290 }}>
            <div style={{ fontSize:10, color:C.textFaint, letterSpacing:"1.5px", marginBottom:10, fontFamily:"'Segoe UI',sans-serif", textTransform:"uppercase" }}>NSEI · Candlestick View</div>
            <CandleChart/>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { label:"SIGNAL",     signal:"BUY" },
              { label:"CONFIDENCE", value:"91.4%" },
              { label:"TOP DRIVER", value:"RSI Divergence" },
            ].map((item,i)=>(
              <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:4, padding:"12px 18px", minWidth:170 }}>
                <div style={{ fontSize:9.5, color:C.textFaint, letterSpacing:"1px", marginBottom:6, textTransform:"uppercase", fontFamily:"'Segoe UI',sans-serif" }}>{item.label}</div>
                {item.signal
                  ? <span style={S.signalBuy}>● {item.signal}</span>
                  : <div style={{ fontSize:15, fontWeight:600, color:C.highlight, fontFamily:"'Segoe UI',sans-serif" }}>{item.value}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <div style={S.statsStrip}>
        {STATS.map((s,i)=>(
          <div key={i} style={{...S.statCard, borderRight:i===STATS.length-1?"none":`1px solid ${C.border}`}}>
            <div style={S.statNum}>{s.num}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* MARQUEES */}
      <div style={{ position:"relative", zIndex:1, padding:"20px 0", borderBottom:`1px solid ${C.border}`, background:C.surface }}>
        <Marquee items={MARQUEE1} reverse={false}/>
        <div style={{ height:8 }}/>
        <Marquee items={MARQUEE2} reverse={true}/>
      </div>

      {/* FEATURES */}
      <section id="features" style={S.section}>
        <div style={S.sectionLabel}>Platform Capabilities</div>
        <h2 style={S.sectionTitle}>Eight Modules.<br/>One Intelligence Layer.</h2>
        <p style={S.sectionSub}>End-to-end quantitative infrastructure — from raw market data to risk-managed, explainable trading signals.</p>
        <div style={S.featureGrid}>
          {FEATURES.map((f,i)=>(
            <div key={i} style={S.featureCard(hovCard===i)} onMouseEnter={()=>setHovCard(i)} onMouseLeave={()=>setHovCard(null)}>
              <div style={{...S.featureIcon, color:C.primary}}>{f.icon}</div>
              <div style={S.featureTitle}>{f.title}</div>
              <div style={S.featureDesc}>{f.desc}</div>
              <div style={S.featureTag}>{f.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" style={{...S.section, background:C.surface, borderTop:`1px solid ${C.border}`}}>
        <div style={S.sectionLabel}>System Architecture</div>
        <h2 style={S.sectionTitle}>From Raw Data<br/>to Actionable Signal</h2>
        <p style={S.sectionSub}>A seven-stage quantitative pipeline transforms raw NSEI market data into explainable, risk-managed trading decisions.</p>
        <div style={S.archWrap}>
          {ARCH.map((a,i)=>(
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%" }}>
              {i>0 && <div style={S.archConnector}/>}
              <div style={S.archNode(i)}>
                <div style={S.archNum}>{i+1}</div>
                <div><div style={S.archLabel}>{a.label}</div><div style={S.archSub}>{a.sub}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="analytics" style={S.section}>
        <div style={S.sectionLabel}>Live Analytics</div>
        <h2 style={S.sectionTitle}>Dashboard Snapshot</h2>
        <p style={S.sectionSub}>Real-time portfolio, risk, and signal analytics in one view.</p>
        <div style={S.analyticsGrid}>
          {[
            { label:"PORTFOLIO GROWTH", content:<MiniBar color="#22C55E"/> },
            { label:"PnL TODAY",        content:<div style={{fontSize:26,fontWeight:700,color:"#22C55E",marginTop:8,fontFamily:"'Segoe UI',sans-serif"}}>+₹ 24,810</div> },
            { label:"SIGNAL ACCURACY",  content:<div style={{fontSize:26,fontWeight:700,color:C.accent,marginTop:8,fontFamily:"'Segoe UI',sans-serif"}}>91.4%</div> },
            { label:"ACTIVE SIGNAL",    content:<div style={{marginTop:8}}><span style={S.signalBuy}>● BUY</span><div style={{fontSize:10.5,color:C.textFaint,marginTop:8,fontFamily:"'Segoe UI',sans-serif"}}>NSEI · Conf. 91.4%</div></div> },
            { label:"MAX DRAWDOWN",     content:<div style={{fontSize:26,fontWeight:700,color:C.danger,marginTop:8,fontFamily:"'Segoe UI',sans-serif"}}>-7.2%</div> },
            { label:"RISK EXPOSURE",    content:<MiniBar color="#86EFAC"/> },
          ].map((card,i)=>(
            <div key={i} style={S.analyticsCard}>
              <div style={S.analyticsLabel}>{card.label}</div>
              {card.content}
            </div>
          ))}
        </div>
      </section>

      {/* RESEARCH / CTA */}
      <section id="research" style={S.ctaSection}>
        <div style={S.sectionLabel}>Get Started</div>
        <h2 style={{...S.sectionTitle, maxWidth:540, margin:"0 auto 16px"}}>Transform Market Data into<br/>Intelligent Decisions</h2>
        <p style={{...S.sectionSub, margin:"0 auto 40px"}}>Deploy institutional-grade AI on NSEI markets.<br/>Backtest. Explain. Manage risk. Repeat.</p>
        <div style={S.heroButtons}>
          <button style={S.btnPrimary} onClick={goToDashboard}
            onMouseOver={e=>e.currentTarget.style.opacity="0.85"}
            onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            Explore Platform
          </button>
          <button style={S.btnSecondary} onClick={()=>scrollTo("analytics")}
            onMouseOver={e=>{e.currentTarget.style.borderColor="rgba(134,239,172,0.6)";e.currentTarget.style.color=C.highlight}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="rgba(134,239,172,0.3)";e.currentTarget.style.color=C.accent}}>
            View Analytics
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={S.footer}>
        <div>
          <button style={{...S.logo, fontSize:14, cursor:"default", pointerEvents:"none"}}>AlgoTerminal</button>
          <div style={{ fontSize:12.5, color:C.textFaint, lineHeight:1.8, fontFamily:"'Segoe UI',sans-serif", maxWidth:200, marginTop:10 }}>
            AI-powered quantitative trading intelligence for NSEI markets.
          </div>
        </div>
        {FOOTER_COLS.map(col=>(
          <div key={col.title}>
            <div style={S.footerTitle}>{col.title}</div>
            {col.links.map(({label,path})=>(
              <button key={label} style={S.footerLink} onClick={()=>navigate(path)}
                onMouseOver={e=>e.currentTarget.style.color=C.accent}
                onMouseOut={e=>e.currentTarget.style.color=C.textFaint}>
                {label}
              </button>
            ))}
          </div>
        ))}
      </footer>
      <div style={S.footerCopy}>© 2025 AlgoTerminal · Built by Bhanu · NSEI Quantitative Intelligence Platform</div>
    </div>
  );
}