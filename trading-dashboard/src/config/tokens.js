/**
 * tokens.js — Design system tokens for AlgoTerminal
 * Single source of truth. Import everywhere.
 */

export const T = {
    // ── Palette ───────────────────────────────────────────────────────────
    bg: "#07100C", // near-black, green-tinted
    surface: "#0D1A13", // card background
    surfaceHov: "#112018", // card hover
    border: "#1A3025", // subtle border
    borderGlow: "rgba(34,197,94,0.35)", // accent border on hover/active

    // Accent
    green: "#22C55E", // primary action / BUY
    greenDim: "#16A34A",
    greenGlow: "rgba(34,197,94,0.12)",
    mint: "#86EFAC", // secondary text / labels
    paleGreen: "#BBF7D0", // headings

    // Semantic
    red: "#F87171", // SELL / danger
    amber: "#FBBF24", // HOLD / warning
    blue: "#60A5FA", // info
    purple: "#C084FC", // ML / AI accent

    // Text
    text: "#E7F0EA",
    textDim: "rgba(231,240,234,0.55)",
    textFaint: "rgba(231,240,234,0.28)",

    // ── Typography ────────────────────────────────────────────────────────
    fontMono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontSans: "'Inter', 'Segoe UI', system-ui, sans-serif",
    fontSerif: "'Georgia', 'Times New Roman', serif",

    // ── Radii ─────────────────────────────────────────────────────────────
    r: "6px",
    rLg: "10px",
    rSm: "4px",

    // ── Shadows ───────────────────────────────────────────────────────────
    shadow: "0 4px 24px rgba(0,0,0,0.4)",
    glowGreen: "0 0 20px rgba(34,197,94,0.15)",
};

// Signal color helper
export function signalColor(sig) {
    if (sig === "BUY") return T.green;
    if (sig === "SELL") return T.red;
    return T.amber;
}

// Format helpers
export const fmt = {
    pct: (v) => v != null ? `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—",
    inr: (v) => v != null ? `₹${Number(v).toLocaleString("en-IN")}` : "—",
    num: (v) => v != null ? Number(v).toLocaleString() : "—",
    conf: (v) => v != null ? `${Number(v).toFixed(1)}%` : "—",
};