const mono = "'Courier New', monospace"

export default function BackButton({ onBack, label = "← HOME" }) {
  if (!onBack) return null
  return (
    <button
      onClick={onBack}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "1px solid #ff6600",
        color: "#ff6600",
        fontFamily: mono,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        padding: "5px 14px",
        cursor: "pointer",
        marginBottom: 16,
        transition: "all 0.15s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "#ff6600"
        e.currentTarget.style.color = "#000"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = "#ff6600"
      }}
    >
      {label}
    </button>
  )
}