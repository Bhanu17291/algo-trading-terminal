const mono = "'Courier New', monospace"

export default function Metric({ label, value, color = "#ffffff", size = 26, sub }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#666666", fontFamily: mono, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 700, color, fontFamily: mono, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#666", fontFamily: mono, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}