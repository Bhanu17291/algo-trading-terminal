const mono = "'Courier New', monospace"

export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card bg-base-200 border border-base-300 shadow-lg p-3"
      style={{ fontFamily: mono, fontSize: 11 }}>
      <div style={{ color: "#ff6600", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#cccccc" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </div>
      ))}
    </div>
  )
}