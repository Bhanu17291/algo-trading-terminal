import { useState, useEffect } from "react";
import { T } from "../../config/tokens";

const mono = T.fontMono;
const NEWS_API_KEY = "e49d012d11044821a1426a79e9a35045";

function getSentiment(title) {
  const pos = ["surge","rally","gain","rise","bull","growth","profit","high","record","strong","up","boost"];
  const neg = ["fall","drop","crash","loss","bear","decline","weak","low","risk","sell","down","cut"];
  const text = title.toLowerCase();
  const posScore = pos.filter(w => text.includes(w)).length;
  const negScore = neg.filter(w => text.includes(w)).length;
  if (posScore > negScore) return { label: "POSITIVE", color: T.green };
  if (negScore > posScore) return { label: "NEGATIVE", color: T.red };
  return { label: "NEUTRAL", color: T.amber };
}

export default function NewsPage() {
  const [news,    setNews]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("ALL");

  useEffect(() => {
    fetch(`https://newsapi.org/v2/everything?q=NSE+India+stock+market&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === "ok") {
          setNews(data.articles.map(a => ({
            title: a.title, source: a.source?.name, url: a.url,
            publishedAt: new Date(a.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            sentiment: getSentiment(a.title),
          })));
        } else setError(data.message || "Failed to fetch");
      })
      .catch(() => setError("Network error — NewsAPI free tier only works on localhost"))
      .finally(() => setLoading(false));
  }, []);

  const filtered  = filter === "ALL" ? news : news.filter(n => n.sentiment.label === filter);
  const positive  = news.filter(n => n.sentiment.label === "POSITIVE").length;
  const negative  = news.filter(n => n.sentiment.label === "NEGATIVE").length;
  const neutral   = news.filter(n => n.sentiment.label === "NEUTRAL").length;
  const overall   = positive > negative ? "BULLISH" : negative > positive ? "BEARISH" : "NEUTRAL";
  const overallC  = positive > negative ? T.green : negative > positive ? T.red : T.amber;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 3 }}>Market Intelligence</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>Market News Feed</h1>
      </div>

      {/* Stat tiles + filter */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 10 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Filter</div>
          {["ALL","POSITIVE","NEUTRAL","NEGATIVE"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "4px 10px", background: filter === f ? T.green : "transparent",
              color: filter === f ? T.bg : T.textDim, border: `1px solid ${filter===f?T.green:T.border}`,
              borderRadius: T.rSm, fontFamily: mono, fontSize: 8, cursor: "pointer", fontWeight: filter===f?700:400,
            }}>{f}</button>
          ))}
        </div>
        {[
          { label: "Sentiment",     value: overall,  color: overallC },
          { label: "Positive",      value: positive, color: T.green },
          { label: "Negative",      value: negative, color: T.red },
          { label: "Neutral",       value: neutral,  color: T.amber },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`, borderRadius: T.rLg, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: news.length > 0 ? 18 : 14, fontWeight: 700, color, fontFamily: mono }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sentiment bar */}
      {news.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: T.textFaint, fontFamily: mono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>Sentiment Distribution</div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${(positive/news.length)*100}%`, background: T.green, transition: "width 1s ease" }} />
            <div style={{ width: `${(neutral/news.length)*100}%`,  background: T.amber, transition: "width 1s ease" }} />
            <div style={{ width: `${(negative/news.length)*100}%`, background: T.red,   transition: "width 1s ease" }} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {[[T.green,"POSITIVE",positive],[T.amber,"NEUTRAL",neutral],[T.red,"NEGATIVE",negative]].map(([c,l,v]) => (
              <span key={l} style={{ fontSize: 9, color: c, fontFamily: mono }}>● {l} {news.length > 0 ? ((v/news.length)*100).toFixed(0) : 0}%</span>
            ))}
          </div>
        </div>
      )}

      {/* News feed */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: T.rLg, padding: "14px 16px", flex: 1, overflowY: "auto", maxHeight: 340 }}>
        <div style={{ fontSize: 9, color: T.green, fontFamily: mono, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 10 }}>
          Live NSE News — {filtered.length} Articles
        </div>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", justifyContent: "center", color: T.textFaint, fontFamily: mono, fontSize: 11 }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Fetching market news...
          </div>
        )}
        {error && (
          <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.2)`, borderRadius: T.r, fontSize: 10, color: T.red, fontFamily: mono }}>
            ⚠ {error}
          </div>
        )}
        {!loading && !error && filtered.map((a, i) => (
          <div key={i} onClick={() => window.open(a.url,"_blank")} style={{
            padding: "10px 12px", marginBottom: 6,
            background: "rgba(0,0,0,0.15)", border: `1px solid ${T.border}`,
            borderLeft: `2px solid ${a.sentiment.color}`, borderRadius: T.r,
            cursor: "pointer", transition: "background 0.15s",
          }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(34,197,94,0.04)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(0,0,0,0.15)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 4 }}>{a.title}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 9, color: T.textFaint, fontFamily: mono }}>{a.source}</span>
                  <span style={{ fontSize: 9, color: T.textFaint, fontFamily: mono }}>{a.publishedAt}</span>
                </div>
              </div>
              <div style={{ padding: "2px 8px", border: `1px solid ${a.sentiment.color}`, borderRadius: T.rSm, fontSize: 8, color: a.sentiment.color, fontFamily: mono, fontWeight: 700, flexShrink: 0 }}>
                {a.sentiment.label}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}