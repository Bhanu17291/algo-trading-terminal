import { useState } from "react";
import { T } from "../../config/tokens";
import BacktestPage from "./BacktestPage";
import DrawdownPage from "./DrawdownPage";
import SimulatorPage from "./SimulatorPage";

const mono = T.fontMono;

const TABS = [
  { key: "backtest",  label: "Backtest" },
  { key: "drawdown",  label: "Drawdown" },
  { key: "simulator", label: "Simulator" },
];

export default function PerformanceLabPage(props) {
  const [tab, setTab] = useState("backtest");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
          Performance Lab
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>
          Performance Lab
        </h1>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, paddingBottom: 2 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              background: tab === t.key ? "rgba(34,197,94,0.1)" : "transparent",
              color: tab === t.key ? T.mint : T.textDim,
              border: "none",
              borderBottom: `2px solid ${tab === t.key ? T.green : "transparent"}`,
              borderRadius: "4px 4px 0 0",
              fontFamily: mono, fontSize: 11, fontWeight: tab === t.key ? 700 : 500,
              letterSpacing: "0.5px", textTransform: "uppercase",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "backtest"  && <BacktestPage {...props} showHeader={false} />}
      {tab === "drawdown"  && <DrawdownPage {...props} showHeader={false} />}
      {tab === "simulator" && <SimulatorPage {...props} showHeader={false} />}
    </div>
  );
}