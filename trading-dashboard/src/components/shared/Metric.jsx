import { T } from "../../config/tokens";

/**
 * Metric — a labeled value display used in stat cards and panels.
 * Props: label, value, color, size, sub, trend ("+"/"-"/null)
 */
export default function Metric({ label, value, color = T.text, size = 24, sub, trend }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: T.textFaint,
        fontFamily: T.fontMono, letterSpacing: "1.5px",
        textTransform: "uppercase", marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: size, fontWeight: 700, color,
        fontFamily: T.fontMono, letterSpacing: "-0.5px", lineHeight: 1,
        display: "flex", alignItems: "baseline", gap: 6,
      }}>
        {value ?? "—"}
        {trend && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: trend === "+" ? T.green : T.red,
          }}>
            {trend === "+" ? "▲" : "▼"}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: T.fontMono, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}