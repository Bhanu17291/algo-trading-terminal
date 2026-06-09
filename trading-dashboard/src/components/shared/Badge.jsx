import { T, signalColor } from "../../config/tokens";

/**
 * Badge — inline label chip.
 * variant: "signal" | "success" | "danger" | "warning" | "info" | "neutral"
 */
export default function Badge({ children, variant = "neutral", size = "sm" }) {
  const colors = {
    signal:  { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  text: T.green  },
    success: { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  text: T.green  },
    danger:  { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.35)", text: T.red   },
    warning: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", text: T.amber  },
    info:    { bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.35)", text: T.blue   },
    purple:  { bg: "rgba(192,132,252,0.12)", border: "rgba(192,132,252,0.35)", text: T.purple },
    neutral: { bg: "rgba(255,255,255,0.06)", border: T.border,               text: T.textDim },
  };

  const c = colors[variant] || colors.neutral;
  const pad = size === "lg" ? "5px 14px" : size === "sm" ? "2px 8px" : "3px 10px";
  const fs  = size === "lg" ? 13 : size === "sm" ? 10 : 11;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: pad, borderRadius: T.rSm,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: T.fontMono, fontSize: fs, fontWeight: 700,
      letterSpacing: "0.5px", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

/** Convenience: SignalBadge auto-colors based on signal value */
export function SignalBadge({ signal, size = "md" }) {
  const v = signal === "BUY" ? "success" : signal === "SELL" ? "danger" : "warning";
  return (
    <Badge variant={v} size={size}>
      <span style={{ fontSize: size === "lg" ? 8 : 7 }}>●</span> {signal ?? "—"}
    </Badge>
  );
}