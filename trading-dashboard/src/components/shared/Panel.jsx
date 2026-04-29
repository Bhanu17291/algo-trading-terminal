export default function Panel({ title, children, accent = "#ff6600", className = "" }) {
  return (
    <div className={`card bg-base-200 shadow-xl border border-base-300 ${className}`}
      style={{ borderTop: `2px solid ${accent}` }}>
      <div className="card-body p-0">
        <div className="px-4 py-2 border-b border-base-300">
          <span style={{ color: accent, fontFamily: "'Courier New', monospace", fontSize: 13, letterSpacing: 2, fontWeight: 700 }}>
            {title}
          </span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}