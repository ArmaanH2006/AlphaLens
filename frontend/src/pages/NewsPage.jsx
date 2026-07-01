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

// Visual identity per category — drives the placeholder art + accent
// whenever an article has no usable image.
const CATEGORY_STYLE = {
  general: { accent: "#5B8DEF", gradient: "linear-gradient(135deg, #1a2332 0%, #0f1420 100%)", icon: "📰" },
  crypto:  { accent: "#F2B84B", gradient: "linear-gradient(135deg, #2b2210 0%, #16130a 100%)", icon: "◈"  },
  forex:   { accent: "#3FC1A6", gradient: "linear-gradient(135deg, #0f2620 0%, #0a1512 100%)", icon: "⇄"  },
  merger:  { accent: "#B37FEB", gradient: "linear-gradient(135deg, #251a2e 0%, #140e19 100%)", icon: "⬡"  },
};
function categoryStyle(cat) {
  return CATEGORY_STYLE[cat] || CATEGORY_STYLE.general;
}

/* ── Helpers ── */
function timeAgo(unixSeconds) {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Finnhub's /news endpoint doesn't return a real sentiment score per article
// (that only exists on their separate per-symbol sentiment endpoint), so we
// derive sentiment ourselves from the headline + summary text.
const POSITIVE_WORDS = [
  "surge", "soar", "rally", "jump", "gain", "gains", "climb", "rebound",
  "beat", "beats", "upgrade", "upgraded", "record high", "outperform",
  "bullish", "strong", "strength", "growth", "profit", "profits", "rise",
  "rises", "rising", "boost", "boosted", "recovery", "optimis", "upside",
  "breakthrough", "expand", "expansion", "exceed", "exceeds", "rebounded",
];
const NEGATIVE_WORDS = [
  "plunge", "plummet", "crash", "slump", "slide", "drop", "drops", "dropped",
  "fall", "falls", "falling", "tumble", "miss", "misses", "missed",
  "downgrade", "downgraded", "weak", "weakness", "decline", "declines",
  "loss", "losses", "bearish", "sell-off", "selloff", "recession", "layoff",
  "layoffs", "warn", "warns", "warning", "fraud", "lawsuit", "probe",
  "investigation", "concern", "concerns", "risk", "default", "bankruptcy",
  "volatil", "cut rates", "rate cut fears",
];

function analyzeSentiment(text) {
  if (!text) return "neu";
  const t = text.toLowerCase();

  let score = 0;
  for (const w of POSITIVE_WORDS) if (t.includes(w)) score++;
  for (const w of NEGATIVE_WORDS) if (t.includes(w)) score--;

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
    sentiment: analyzeSentiment(`${a.headline || ""} ${a.summary || ""}`),
    tickers:   parseTickers(a.related),
    url:       a.url || "#",
    image:     a.image || null,
  };
}

// Finnhub's news feed (forex especially) tends to include junk entries —
// missing headlines, bad/zero timestamps, and the same story reposted
// near-verbatim by multiple wire sources. Clean + dedupe + force a
// consistent newest-first order.
function cleanArticles(mapped) {
  const seen = new Set();
  return mapped
    .filter((a) => a.headline && a.headline.trim().length > 8)
    .filter((a) => a.datetime && a.datetime > 0)
    .filter((a) => {
      const key = a.headline
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.datetime - a.datetime);
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

/* ── Image with graceful fallback to category art ── */
function ArticleImage({ src, category, height }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  const style = categoryStyle(category);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className="np-img-wrap"
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        background: style.gradient,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="np-img"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: height > 150 ? 42 : 24,
            color: style.accent,
            opacity: 0.6,
          }}
        >
          {style.icon}
        </div>
      )}
    </div>
  );
}

/* ── Large hero article ── */
function HeroArticle({ article, navigate }) {
  const isBreaking = Date.now() / 1000 - article.datetime < 3600;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        className="np-card np-hero np-fade"
        style={{
          background: "#141417",
          border: "1px solid #1e1e24",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        <div style={{ position: "relative" }}>
          <ArticleImage src={article.image} category={article.category} height={300} />

          {/* Bottom gradient so overlaid text stays legible over any photo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(10,10,12,0.55) 70%, rgba(10,10,12,0.92) 100%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8 }}>
            {isBreaking && (
              <span
                style={{
                  background: "#E24B4A",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 9px",
                  borderRadius: 5,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Breaking
              </span>
            )}
          </div>
          <div style={{ position: "absolute", top: 14, right: 14 }}>
            <SentimentBadge type={article.sentiment} />
          </div>

          {/* Headline overlaid on the image, editorial-style */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 24px 18px" }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginBottom: 8, fontWeight: 500 }}>
              {article.source} · {article.age}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
              {article.headline}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 24px 22px" }}>
          <div style={{ fontSize: 13.5, color: "#8a8a92", lineHeight: 1.65, marginBottom: article.tickers.length ? 14 : 0 }}>
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
function ArticleCard({ article, navigate, delay }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <div
        className="np-card np-fade"
        style={{
          background: "#141417",
          border: "1px solid #1e1e24",
          borderRadius: 10,
          overflow: "hidden",
          cursor: "pointer",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          animationDelay: `${delay}ms`,
        }}
      >
        <ArticleImage src={article.image} category={article.category} height={140} />

        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
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
      </div>
    </a>
  );
}

/* ── Skeleton placeholders shown while a category is loading ── */
function SkeletonBlock({ style }) {
  return (
    <div
      className="np-shimmer"
      style={{ background: "#1c1c22", borderRadius: 4, ...style }}
    />
  );
}

function SkeletonHero() {
  return (
    <div style={{ background: "#141417", border: "1px solid #1e1e24", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
      <SkeletonBlock style={{ height: 300, borderRadius: 0 }} />
      <div style={{ padding: "18px 24px 22px" }}>
        <SkeletonBlock style={{ height: 12, width: "90%", marginBottom: 8 }} />
        <SkeletonBlock style={{ height: 12, width: "60%" }} />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#141417", border: "1px solid #1e1e24", borderRadius: 10, overflow: "hidden" }}>
      <SkeletonBlock style={{ height: 140, borderRadius: 0 }} />
      <div style={{ padding: "14px 16px 16px" }}>
        <SkeletonBlock style={{ height: 9, width: "35%", marginBottom: 10 }} />
        <SkeletonBlock style={{ height: 13, width: "95%", marginBottom: 8 }} />
        <SkeletonBlock style={{ height: 13, width: "75%", marginBottom: 12 }} />
        <SkeletonBlock style={{ height: 9, width: "45%" }} />
      </div>
    </div>
  );
}

function NewsPage() {
  const navigate = useNavigate();

  const [activeTab,     setActiveTab]     = useState("All");
  const [allArticles,   setAllArticles]   = useState({});  // keyed by category
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [page,          setPage]          = useState(0);
  const [retryToken,    setRetryToken]    = useState(0);

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

        const mapped = cleanArticles(data.map(mapArticle));
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
  }, [activeTab, retryToken]);

  function handleRetry() {
    setAllArticles((prev) => {
      const next = { ...prev };
      delete next[activeTab];
      return next;
    });
    setRetryToken((t) => t + 1);
  }

  const articles   = allArticles[activeTab] || [];
  const hero       = articles[0] || null;
  const rest       = articles.slice(1);
  const totalPages = Math.ceil(rest.length / PAGE_SIZE);
  const paged      = rest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Local styles for hover / motion — scoped by class name, doesn't touch global CSS */}
      <style>{`
        .np-card { transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
        .np-card:hover { border-color: #2e2e44; transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
        .np-img { transition: transform .5s ease; }
        .np-card:hover .np-img { transform: scale(1.06); }
        .np-fade { animation: npFadeIn .4s ease both; }
        @keyframes npFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .np-shimmer {
          background: linear-gradient(90deg, #1c1c22 0%, #26262e 50%, #1c1c22 100%);
          background-size: 600px 100%;
          animation: npShimmer 1.5s infinite linear;
        }
        @keyframes npShimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div className="panel-section-title" style={{ fontSize: 18, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            News
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#1D9E75", display: "inline-block",
                boxShadow: "0 0 0 3px rgba(29,158,117,0.2)",
              }}
            />
          </div>
          <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
            Live market news — powered by Finnhub
          </p>
        </div>
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

      {/* ── Loading (skeletons) ── */}
      {loading && (
        <>
          <SkeletonHero />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
          <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 16 }}>{error}</p>
          <button
            onClick={handleRetry}
            style={{
              background: "#1D9E75",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
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
              <ArticleCard key={article.url + i} article={article} navigate={navigate} delay={i * 35} />
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
                  transition: "opacity .15s ease",
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
                      transition: "background .15s ease, color .15s ease",
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
                  transition: "opacity .15s ease",
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