import { useState } from "react";
import { T } from "../../config/tokens";
import RiskPage from "./RiskPage";
import PsychPage from "./PsychPage";

const mono = T.fontMono;

const TABS = [
  { key: "risk",  label: "Risk Calc" },
  { key: "psych", label: "Psychology" },
];

export default function RiskPsychologyPage(props) {
  const [tab, setTab] = useState("risk");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
          Risk & Psychology
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>
          Risk & Psychology
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

      {tab === "risk"  && <RiskPage {...props} showHeader={false} />}
      {tab === "psych" && <PsychPage {...props} showHeader={false} />}
    </div>
  );
}