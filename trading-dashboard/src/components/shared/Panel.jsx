import { T } from "../../config/tokens";

export default function Panel({ title, children, accent = T.green, padded = true, className = "", action }) {
  return (
    <div
      className={className}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderTop: `2px solid ${accent}`,
        borderRadius: T.rLg,
        overflow: "hidden",
        boxShadow: T.shadow,
      }}
    >
      {title && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          background: "rgba(0,0,0,0.2)",
        }}>
          <span style={{
            color: accent,
            fontFamily: T.fontMono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}>
            {title}
          </span>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ padding: padded ? "16px" : 0 }}>
        {children}
      </div>
    </div>
  );
}