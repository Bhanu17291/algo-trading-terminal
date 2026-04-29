import { useState, useEffect } from "react"
import Panel from "../shared/Panel"

const mono = "'Courier New', monospace"
const NEWS_API_KEY = "e49d012d11044821a1426a79e9a35045"

function getSentiment(title) {
  const pos = ["surge", "rally", "gain", "rise", "bull", "growth", "profit", "high", "record", "strong", "up", "boost"]
  const neg = ["fall", "drop", "crash", "loss", "bear", "decline", "weak", "low", "risk", "sell", "down", "cut"]
  const text = title.toLowerCase()
  const posScore = pos.filter(w => text.includes(w)).length
  const negScore = neg.filter(w => text.includes(w)).length
  if (posScore > negScore) return { label: "POSITIVE", color: "#00ff41", score: posScore }
  if (negScore > posScore) return { label: "NEGATIVE", color: "#ff3131", score: negScore }
  return { label: "NEUTRAL", color: "#ffd700", score: 0 }
}

export default function NewsPage() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("ALL")

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(
          `https://newsapi.org/v2/everything?q=NSE+India+stock+market&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`
        )
        const data = await res.json()
        if (data.status === "ok") {
          const articles = data.articles.map(a => ({
            title: a.title,
            source: a.source?.name,
            url: a.url,
            publishedAt: new Date(a.publishedAt).toLocaleString(),
            sentiment: getSentiment(a.title),
          }))
          setNews(articles)
        } else {
          setError(data.message || "Failed to fetch news")
        }
      } catch (e) {
        setError("Network error fetching news")
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [])

  const filtered = filter === "ALL" ? news : news.filter(n => n.sentiment.label === filter)
  const positive = news.filter(n => n.sentiment.label === "POSITIVE").length
  const negative = news.filter(n => n.sentiment.label === "NEGATIVE").length
  const neutral = news.filter(n => n.sentiment.label === "NEUTRAL").length
  const overallSentiment = positive > negative ? "BULLISH" : negative > positive ? "BEARISH" : "NEUTRAL"
  const overallColor = positive > negative ? "#00ff41" : negative > positive ? "#ff3131" : "#ffd700"

  return (
    <div className="flex flex-col gap-3">

      {/* Overall sentiment */}
      <div className="grid grid-cols-4 gap-3">
        {[
          ["MARKET SENTIMENT", overallSentiment, overallColor],
          ["POSITIVE NEWS", positive, "#00ff41"],
          ["NEGATIVE NEWS", negative, "#ff3131"],
          ["NEUTRAL NEWS", neutral, "#ffd700"],
        ].map(([l, v, c]) => (
          <div key={l} className="stat bg-base-200 rounded-box border border-base-300"
            style={{ borderTop: `2px solid ${c}` }}>
            <div className="stat-title" style={{ fontFamily: mono, fontSize: 10 }}>{l}</div>
            <div className="stat-value" style={{ color: c, fontFamily: mono, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Sentiment bar */}
      {news.length > 0 && (
        <Panel title="SENTIMENT DISTRIBUTION">
          <div className="flex rounded overflow-hidden" style={{ height: 20 }}>
            <div style={{ width: `${(positive / news.length) * 100}%`, background: "#00ff41", transition: "width 1s ease" }} />
            <div style={{ width: `${(neutral / news.length) * 100}%`, background: "#ffd700", transition: "width 1s ease" }} />
            <div style={{ width: `${(negative / news.length) * 100}%`, background: "#ff3131", transition: "width 1s ease" }} />
          </div>
          <div className="flex gap-4 mt-2" style={{ fontFamily: mono, fontSize: 11 }}>
            <span style={{ color: "#00ff41" }}>● POSITIVE {((positive / news.length) * 100).toFixed(0)}%</span>
            <span style={{ color: "#ffd700" }}>● NEUTRAL {((neutral / news.length) * 100).toFixed(0)}%</span>
            <span style={{ color: "#ff3131" }}>● NEGATIVE {((negative / news.length) * 100).toFixed(0)}%</span>
          </div>
        </Panel>
      )}

      {/* Filter */}
      <div className="join">
        {["ALL", "POSITIVE", "NEUTRAL", "NEGATIVE"].map(f => (
          <button key={f}
            className={`btn btn-sm join-item ${filter === f ? "btn-warning" : "btn-outline"}`}
            style={{ fontFamily: mono }}
            onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {/* News feed */}
      <Panel title={`LIVE NSE NEWS FEED — ${filtered.length} ARTICLES`}>
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <span className="loading loading-spinner loading-lg" style={{ color: "#ff6600" }}></span>
            <span style={{ fontFamily: mono, color: "#666" }}>Fetching latest market news...</span>
          </div>
        )}
        {error && (
          <div className="alert alert-error" style={{ fontFamily: mono, fontSize: 12 }}>
            ⚠️ {error} — NewsAPI free tier only works on localhost
          </div>
        )}
        {!loading && !error && (
          <div className="flex flex-col gap-3">
            {filtered.map((article, i) => (
              <div key={i} className="card bg-base-300 p-4 hover:bg-base-200 transition-colors cursor-pointer"
                style={{ borderLeft: `3px solid ${article.sentiment.color}` }}
                onClick={() => window.open(article.url, "_blank")}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.5, marginBottom: 6 }}>
                      {article.title}
                    </div>
                    <div className="flex gap-3 items-center">
                      <span style={{ fontSize: 10, color: "#666", fontFamily: mono }}>{article.source}</span>
                      <span style={{ fontSize: 10, color: "#444", fontFamily: mono }}>·</span>
                      <span style={{ fontSize: 10, color: "#444", fontFamily: mono }}>{article.publishedAt}</span>
                    </div>
                  </div>
                  <div className={`badge badge-sm shrink-0 ${article.sentiment.label === "POSITIVE" ? "badge-success" : article.sentiment.label === "NEGATIVE" ? "badge-error" : "badge-warning"}`}
                    style={{ fontFamily: mono }}>
                    {article.sentiment.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}