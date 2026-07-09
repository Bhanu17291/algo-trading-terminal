import { useState } from "react";
import { T } from "../../config/tokens";

/**
 * StatCard — a standalone metric card with hover glow.
 * Used in Dashboard, ClientsPage, etc.
 */
export default function StatCard({ label, value, sub, color = T.green, icon, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.surfaceHov : T.surface,
        border: `1px solid ${hov ? T.borderGlow : T.border}`,
        borderRadius: T.rLg,
        padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        boxShadow: hov ? T.glowGreen : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle accent glow in corner */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 60, height: 60,
        background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10, color: T.textFaint,
          fontFamily: T.fontMono, letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}>
          {label}
        </div>
        {icon && (
          <div style={{ fontSize: 16, color: color, opacity: 0.7 }}>{icon}</div>
        )}
      </div>

      <div style={{
        fontSize: 28, fontWeight: 700, color,
        fontFamily: T.fontMono, letterSpacing: "-1px", lineHeight: 1,
      }}>
        {value ?? "—"}
      </div>

      {sub && (
        <div style={{
          fontSize: 11, color: T.textDim,
          fontFamily: T.fontMono, marginTop: 6,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}