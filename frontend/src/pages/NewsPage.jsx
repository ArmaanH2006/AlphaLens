import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;

const CATEGORIES = ["All", "General", "Crypto", "Forex", "Merger"];

const FINNHUB_CATEGORIES = {
  All:     "general",
  General: "general",
  Crypto:  "crypto",
  Forex:   "forex",
  Merger:  "merger",
};

const PAGE_SIZE = 12;

/* ── Helpers ── */
function timeAgo(unixSeconds) {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function mapSentiment(score) {
  if (score > 0) return "up";
  if (score < 0) return "dn";
  return "neu";
}

function parseTickers(related) {
  if (!related) return [];
  return related
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 5)
    .slice(0, 3);
}

function mapArticle(a) {
  return {
    source:    a.source   || "News",
    age:       timeAgo(a.datetime),
    datetime:  a.datetime,
    headline:  a.headline || "",
    summary:   a.summary  || "",
    category:  a.category || "general",
    sentiment: mapSentiment(a.sentiment ?? 0),
    tickers:   parseTickers(a.related),
    url:       a.url || "#",
    image:     a.image || null,
  };
}

/* ── Sentiment badge ── */
function SentimentBadge({ type }) {
  const map = {
    up:  { label: "Bullish", cls: "badge badge-up"  },
    dn:  { label: "Bearish", cls: "badge badge-dn"  },
    neu: { label: "Neutral", cls: "badge badge-neu" },
  };
  const { label, cls } = map[type] ?? map.neu;
  return <span className={cls}>{label}</span>;
}

/* ── Large hero article ── */
function HeroArticle({ article, navigate }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div style={{
        background: "#141417",
        border: "1px solid #1e1e24",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 24,
        cursor: "pointer",
      }}>
        {/* Image placeholder */}
        <div style={{
          height: 220,
          background: "#1a1a1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontSize: 13,
          position: "relative",
        }}>
          <span>News image</span>
          <span style={{
            position: "absolute", top: 12, left: 12,
            background: "#E24B4A", color: "#fff",
            fontSize: 10, fontWeight: 700,
            padding: "3px 8px", borderRadius: 4,
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            Breaking
          </span>
          <span style={{
            position: "absolute", top: 12, right: 12,
          }}>
            <SentimentBadge type={article.sentiment} />
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
            {article.source} · {article.age}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, marginBottom: 10, color: "#fff" }}>
            {article.headline}
          </div>
          <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 12 }}>
            {article.summary}
          </div>
          {article.tickers.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {article.tickers.map((t) => (
                <span
                  key={t}
                  className="ticker-tag"
                  onClick={(e) => { e.preventDefault(); navigate(`/stock/${t}`); }}
                  style={{ cursor: "pointer" }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

/* ── Regular article card ── */
function ArticleCard({ article, navigate }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div style={{
        background: "#141417",
        border: "1px solid #1e1e24",
        borderRadius: 10,
        padding: "16px",
        cursor: "pointer",
        transition: "border-color 0.15s",
        height: "100%",
        boxSizing: "border-box",
      }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#2e2e44"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e1e24"}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {article.category}
          </span>
          <SentimentBadge type={article.sentiment} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, marginBottom: 8, color: "#e0e0e0" }}>
          {article.headline}
        </div>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginBottom: 12 }}>
          {article.summary?.slice(0, 120)}{article.summary?.length > 120 ? "…" : ""}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#555" }}>{article.source} · {article.age}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {article.tickers.map((t) => (
              <span
                key={t}
                className="ticker-tag"
                style={{ fontSize: 10, cursor: "pointer" }}
                onClick={(e) => { e.preventDefault(); navigate(`/stock/${t}`); }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
}

function NewsPage() {
  const navigate = useNavigate();

  const [activeTab,   setActiveTab]   = useState("All");
  const [allArticles, setAllArticles] = useState({});  // keyed by category
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [page,        setPage]        = useState(0);

  /* ── Fetch news for active category ── */
  useEffect(() => {
    const cat = FINNHUB_CATEGORIES[activeTab];

    // Use cache if already fetched
    if (allArticles[activeTab]) {
      setLoading(false);
      return;
    }

    async function fetchNews() {
      try {
        setLoading(true);
        setError("");
        const res  = await fetch(
          `https://finnhub.io/api/v1/news?category=${cat}&token=${FINNHUB_KEY}`
        );
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid response");

        const mapped = data.map(mapArticle);
        setAllArticles((prev) => ({ ...prev, [activeTab]: mapped }));
      } catch (err) {
        console.error("News fetch failed:", err);
        setError("Could not load news. Try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
    setPage(0);
  }, [activeTab]);

  const articles   = allArticles[activeTab] || [];
  const hero       = articles[0] || null;
  const rest       = articles.slice(1);
  const totalPages = Math.ceil(rest.length / PAGE_SIZE);
  const paged      = rest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div className="panel-section-title" style={{ fontSize: 18, marginBottom: 4 }}>
          News
        </div>
        <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
          Live market news — powered by Finnhub
        </p>
      </div>

      {/* ── Category tabs ── */}
      <div className="cat-tabs" style={{ marginBottom: 24 }}>
        {CATEGORIES.map((cat) => (
          <div
            key={cat}
            className={`cat-tab${activeTab === cat ? " active" : ""}`}
            onClick={() => { setActiveTab(cat); setPage(0); }}
          >
            {cat}
          </div>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <p style={{ fontSize: 14 }}>Loading news…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <p style={{ color: "#E24B4A", fontSize: 13 }}>{error}</p>
      )}

      {/* ── Content ── */}
      {!loading && !error && articles.length > 0 && (
        <>
          {/* Hero — only on page 0 */}
          {page === 0 && hero && (
            <HeroArticle article={hero} navigate={navigate} />
          )}

          {/* Article grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}>
            {paged.map((article, i) => (
              <ArticleCard key={i} article={article} navigate={navigate} />
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 32 }}>
              <button
                onClick={() => { setPage((p) => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
                disabled={page === 0}
                style={{
                  background: page === 0 ? "#1a1a1e" : "#1D9E75",
                  border: "1px solid #2e2e36",
                  borderRadius: 8,
                  padding: "8px 18px",
                  color: page === 0 ? "#444" : "#fff",
                  fontSize: 13,
                  cursor: page === 0 ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                ← Prev
              </button>

              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setPage(i); window.scrollTo(0, 0); }}
                    style={{
                      width: 32, height: 32,
                      borderRadius: 6,
                      border: "1px solid #2e2e36",
                      background: page === i ? "#1D9E75" : "#1a1a1e",
                      color: page === i ? "#fff" : "#666",
                      fontSize: 13,
                      cursor: "pointer",
                      fontWeight: page === i ? 600 : 400,
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0); }}
                disabled={page === totalPages - 1}
                style={{
                  background: page === totalPages - 1 ? "#1a1a1e" : "#1D9E75",
                  border: "1px solid #2e2e36",
                  borderRadius: 8,
                  padding: "8px 18px",
                  color: page === totalPages - 1 ? "#444" : "#fff",
                  fontSize: 13,
                  cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Empty ── */}
      {!loading && !error && articles.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📰</div>
          <p style={{ fontSize: 14 }}>No articles found for this category</p>
        </div>
      )}
    </div>
  );
}

export default NewsPage;
