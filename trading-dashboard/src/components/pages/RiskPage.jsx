import { useState, useEffect } from "react";
import { T } from "../../config/tokens";

const mono = T.fontMono;

function Tile({ label, value, color, sub }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: mono }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Slider({ label, value, setter, min, max, step, color }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: mono }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: mono, fontWeight: 700 }}>{value.toLocaleString("en-IN")}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setter(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, height: 3, cursor: "pointer" }} />
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 10, color: T.textDim, fontFamily: mono }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: mono }}>{value}</span>
    </div>
  );
}

const PROFILES = {
  CUSTOM: { capital: 100000, riskPct: 2,   entry: 23000, stop: 22500 },
  QUANT:  { capital: 100000, riskPct: 3,   entry: 23000, stop: 22310 },
  MACRO:  { capital: 100000, riskPct: 1.5, entry: 23000, stop: 22655 },
};

export default function RiskPage({ stats, trades, compare }) {
  const [profile,    setProfile]    = useState("CUSTOM");
  const [capital,    setCapital]    = useState(100000);
  const [riskPct,    setRiskPct]    = useState(2);
  const [entryPrice, setEntryPrice] = useState(23000);
  const [stopLoss,   setStopLoss]   = useState(22500);
  const [winRate,    setWinRate]    = useState(50);
  const [avgWin,     setAvgWin]     = useState(3000);
  const [avgLoss,    setAvgLoss]    = useState(2000);

  useEffect(() => {
    if (stats) setWinRate(stats.win_rate ?? 50);
  }, [stats]);

  useEffect(() => {
    if (!trades?.length) return;
    const sells  = trades.filter(t => t.action === "SELL");
    const wins   = sells.filter(t => t.pnl > 0);
    const losses = sells.filter(t => t.pnl < 0);
    if (wins.length)   setAvgWin(Math.round(wins.reduce((s,t)=>s+t.pnl,0)/wins.length));
    if (losses.length) setAvgLoss(Math.round(Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length)));
  }, [trades]);

  const loadProfile = (p) => {
    setProfile(p);
    const pr = PROFILES[p];
    setCapital(pr.capital); setRiskPct(pr.riskPct);
    setEntryPrice(pr.entry); setStopLoss(pr.stop);
    if (p === "QUANT") setWinRate(stats?.win_rate ?? 72);
    if (p === "MACRO") setWinRate(compare?.macro_stats?.win_rate ?? 68);
  };

  const riskAmount   = (capital * riskPct) / 100;
  const priceDiff    = Math.abs(entryPrice - stopLoss);
  const positionSize = priceDiff > 0 ? Math.floor(riskAmount / priceDiff) : 0;
  const positionVal  = positionSize * entryPrice;
  const positionPct  = ((positionVal / capital) * 100).toFixed(1);
  const wr           = winRate / 100;
  const wlRatio      = avgWin / avgLoss;
  const kelly        = ((wr * (wlRatio + 1) - 1) / wlRatio * 100).toFixed(1);
  const halfKelly    = (kelly / 2).toFixed(1);
  const ev           = ((wr * avgWin) - ((1 - wr) * avgLoss)).toFixed(0);
  const pf           = (wr * avgWin / ((1 - wr) * avgLoss)).toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Risk Management</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Risk Calculator</h1>
      </div>

      {/* Profile selector + result tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 10, alignItems: "stretch" }}>
        {/* Profile selector */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Profile</div>
          {[
            ["CUSTOM", T.amber,  "Manual"],
            ["QUANT",  T.green,  "3% risk"],
            ["MACRO",  T.blue,   "1.5% risk"],
          ].map(([p, c, desc]) => (
            <button key={p} onClick={() => loadProfile(p)} style={{
              padding: "6px 14px", background: profile === p ? c : "transparent",
              color: profile === p ? T.bg : c,
              border: `1px solid ${c}`, borderRadius: T.r,
              fontFamily: mono, fontSize: 10, fontWeight: 700, cursor: "pointer",
              letterSpacing: "1px",
            }}>{p}<span style={{ fontSize: 8, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>{desc}</span></button>
          ))}
        </div>

        <Tile label="Risk Amount"    value={`₹${riskAmount.toLocaleString("en-IN")}`}  color={T.red}   sub={`${riskPct}% of capital`} />
        <Tile label="Position Size"  value={`${positionSize} units`}                    color={T.amber} sub={`₹${positionVal.toLocaleString("en-IN")} (${positionPct}%)`} />
        <Tile label="Kelly %"        value={`${kelly}%`}                                color={T.blue}  sub={`Half Kelly: ${halfKelly}%`} />
        <Tile label="Expected Value" value={`₹${Number(ev).toLocaleString("en-IN")}`}  color={Number(ev) > 0 ? T.green : T.red} sub="per trade average" />
      </div>

      {/* Main 3-col: position calc | kelly calc | analysis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

        {/* Position size calc */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.red}`, borderRadius: T.rLg, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 10, color: T.red, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>Position Sizing</div>
          <Slider label="Total Capital (₹)" value={capital}    setter={setCapital}    min={1000}  max={10000000} step={1000}  color={T.green} />
          <Slider label="Risk Per Trade (%)" value={riskPct}   setter={setRiskPct}    min={0.5}   max={10}       step={0.5}   color={T.red} />
          <Slider label="Entry Price (₹)"   value={entryPrice} setter={setEntryPrice} min={100}   max={100000}   step={100}   color={T.amber} />
          <Slider label="Stop Loss (₹)"     value={stopLoss}   setter={setStopLoss}   min={100}   max={100000}   step={100}   color={T.red} />
          <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(0,0,0,0.2)", border: `1px solid ${T.border}`, borderRadius: T.r }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginBottom: 4 }}>STOP DISTANCE</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, fontFamily: mono }}>
              ₹{priceDiff.toLocaleString("en-IN")} · {priceDiff > 0 ? ((priceDiff/entryPrice)*100).toFixed(2) : 0}%
            </div>
          </div>
        </div>

        {/* Kelly calc */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.blue}`, borderRadius: T.rLg, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 10, color: T.blue, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>Kelly Criterion</div>
          <Slider label="Win Rate (%)"  value={winRate} setter={setWinRate} min={30}  max={95}    step={0.5}  color={T.green} />
          <Slider label="Avg Win (₹)"   value={avgWin}  setter={setAvgWin}  min={500} max={20000} step={100}  color={T.green} />
          <Slider label="Avg Loss (₹)"  value={avgLoss} setter={setAvgLoss} min={500} max={20000} step={100}  color={T.red} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <Row label="Win/Loss Ratio"  value={wlRatio.toFixed(2)}  color={wlRatio >= 1.5 ? T.green : T.amber} />
            <Row label="Full Kelly"      value={`${kelly}%`}         color={T.blue} />
            <Row label="Half Kelly (rec)" value={`${halfKelly}%`}    color={T.green} />
          </div>
          <div style={{ padding: "8px 10px", background: "rgba(251,191,36,0.08)", border: `1px solid rgba(251,191,36,0.2)`, borderRadius: T.r, fontSize: 9, color: T.amber, fontFamily: mono, lineHeight: 1.5 }}>
            ⚠ Never risk more than 2% per trade. Use Half Kelly for real trading.
          </div>
        </div>

        {/* Edge analysis */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>Edge Analysis</div>
          <Row label="Capital at Risk"   value={`₹${riskAmount.toLocaleString("en-IN")}`}  color={T.red} />
          <Row label="Position Value"    value={`₹${positionVal.toLocaleString("en-IN")}`} color={T.amber} />
          <Row label="Capital Exposure"  value={`${positionPct}%`}                         color={parseFloat(positionPct)>20?T.red:T.green} />
          <Row label="Max Loss"          value={`₹${riskAmount.toLocaleString("en-IN")}`}  color={T.red} />
          <Row label="2R Profit Target"  value={`₹${(riskAmount*2).toLocaleString("en-IN")}`} color={T.green} />
          <Row label="Profit Factor"     value={pf}                                         color={parseFloat(pf)>=1.5?T.green:T.amber} />
          <Row label="Expected Value"    value={`₹${Number(ev).toLocaleString("en-IN")}`}  color={Number(ev)>0?T.green:T.red} />
          <Row label="Win Rate"          value={`${winRate}%`}                              color={winRate>=60?T.green:T.amber} />
          <div style={{ marginTop: 8, padding: "10px 12px", background: `rgba(34,197,94,0.06)`, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: T.r }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginBottom: 3 }}>TRADE VERDICT</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: Number(ev) > 0 ? T.green : T.red, fontFamily: mono }}>
              {Number(ev) > 0 ? "✓ POSITIVE EDGE" : "✗ NEGATIVE EDGE"}
            </div>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, marginTop: 2 }}>
              {Number(ev) > 0 ? "System has statistical edge" : "Improve win rate or reward ratio"}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}