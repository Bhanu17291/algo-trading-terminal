/**
 * src/components/shared/WakeScreen.jsx
 */

import { T } from "../../config/tokens";

const MAX_S = 180;  // 3 min

const MESSAGES = [
  { at:   0, text: "Connecting to backend…" },
  { at:   8, text: "Server is waking up on Render free tier…" },
  { at:  20, text: "Still starting — this takes 30–120 s on first visit…" },
  { at:  60, text: "Allocating compute resources, almost there…" },
  { at: 100, text: "Taking longer than usual, still trying…" },
  { at: 140, text: "Final startup steps, hang tight…" },
];

function currentMessage(elapsed) {
  let msg = MESSAGES[0].text;
  for (const m of MESSAGES) {
    if (elapsed >= m.at) msg = m.text;
  }
  return msg;
}

export default function WakeScreen({ elapsed, failed, onRetry }) {
  const pct     = Math.min((elapsed / MAX_S) * 100, 99);
  const message = failed
    ? "Backend did not respond after 3 min."
    : currentMessage(elapsed);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0a0f0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace",
      zIndex: 9999,
    }}>
      <div style={{
        width: "min(420px, 90vw)",
        display: "flex", flexDirection: "column", gap: 28,
        alignItems: "center",
      }}>

        <div style={{
          fontSize: 11, letterSpacing: "4px", textTransform: "uppercase",
          color: "rgba(231,240,234,0.25)",
        }}>
          NSEI · ALGO TERMINAL
        </div>

        {!failed ? (
          <div style={{ position: "relative", width: 56, height: 56 }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="28" cy="28" r="24"
                fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="3" />
              <circle cx="28" cy="28" r="24"
                fill="none" stroke="#22C55E" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "#22C55E", fontWeight: 700,
            }}>
              {elapsed}s
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 36, color: "#EF4444" }}>✕</div>
        )}

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            fontSize: 13, color: "rgba(231,240,234,0.85)", fontWeight: 600, minHeight: 20,
          }}>
            {message}
          </div>
          {!failed && (
            <div style={{ fontSize: 11, color: "rgba(231,240,234,0.3)" }}>
              Pinging every 3 s · auto-loads when ready
            </div>
          )}
        </div>

        {!failed && (
          <div style={{
            width: "100%", height: 3,
            background: "rgba(34,197,94,0.1)",
            borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: "linear-gradient(90deg, #16a34a, #22C55E)",
              borderRadius: 2,
              transition: "width 1s linear",
              boxShadow: "0 0 8px #22C55E66",
            }} />
          </div>
        )}

        {failed && (
          <button
            onClick={onRetry}
            style={{
              padding: "10px 28px",
              background: "transparent",
              border: "1px solid #22C55E",
              borderRadius: 6,
              color: "#22C55E",
              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
              cursor: "pointer",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}