import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;

/* ── Sector ETF map ── */
const SECTOR_ETFS = [
  { name: "Technology",  symbol: "XLK"  },
  { name: "Healthcare",  symbol: "XLV"  },
  { name: "Finance",     symbol: "XLF"  },
  { name: "Energy",      symbol: "XLE"  },
  { name: "Consumer",    symbol: "XLY"  },
  { name: "Industrials", symbol: "XLI"  },
  { name: "Real Estate", symbol: "XLRE" },
  { name: "Utilities",   symbol: "XLU"  },
];

/* ── Category tabs ── */
const CATEGORIES = ["All", "Markets", "Tech", "Earnings", "Economy", "Crypto", "Energy"];

/* ── Category → Finnhub category filter map ── */
const TAB_FILTER = {
  All:      null,
  Markets:  "general",
  Tech:     "technology",
  Earnings: "general",
  Economy:  "general",
  Crypto:   "crypto",
  Energy:   "general",
};

/* ── Convert unix timestamp to "2h ago" ── */
function timeAgo(unixSeconds) {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Map sentiment score → up/dn/neu ── */
function mapSentiment(score) {
  if (score > 0) return "up";
  if (score < 0) return "dn";
  return "neu";
}

/* ── Parse tickers from related field ── */
function parseTickers(related) {
  if (!related) return [];
  return related
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 5)
    .slice(0, 4);
}

/* ── Map article to clean shape ── */
function mapArticle(a) {
  return {
    source:    a.source   || "News",
    age:       timeAgo(a.datetime),
    headline:  a.headline || "",
    summary:   a.summary  || "",
    category:  a.category || "general",
    sentiment: mapSentiment(a.sentiment ?? 0),
    tickers:   parseTickers(a.related),
    url:       a.url || "#",
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

/* ── Sector color ── */
function sectorColor(score) {
  if (score >= 70) return { bg: "rgba(29,158,117,0.15)", border: "#0F6E56", text: "#1D9E75" };
  if (score >= 50) return { bg: "rgba(29,158,117,0.07)", border: "#1e1e22", text: "#aaa"    };
  if (score >= 35) return { bg: "rgba(226,75,74,0.07)",  border: "#1e1e22", text: "#aaa"    };
  return                   { bg: "rgba(226,75,74,0.15)",  border: "#A32D2D", text: "#E24B4A" };
}

/* ── Format earnings date ── */
function formatEarningsDay(dateStr) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

function HomePage() {
  const navigate = useNavigate();

  const [activeTab,    setActiveTab]    = useState("All");
  const [query,        setQuery]        = useState("");

  // News state
  const [allArticles,  setAllArticles]  = useState([]);
  const [hero,         setHero]         = useState(null);
  const [topStories,   setTopStories]   = useState([]);
  const [gridNews,     setGridNews]     = useState([]);
  const [newsLoading,  setNewsLoading]  = useState(true);

  // Sector state
  const [sectors,      setSectors]      = useState(
    SECTOR_ETFS.map((s) => ({ name: s.name, score: 50, up: true, dp: 0 }))
  );

  // Earnings state
  const [earnings,     setEarnings]     = useState([]);
  const [earningsLoad, setEarningsLoad] = useState(true);

  /* ── Fetch live news ── */
  useEffect(() => {
    async function fetchNews() {
      try {
        const res  = await fetch(
          `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
        );
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;

        const mapped = data.map(mapArticle);
        setAllArticles(mapped);

        // Hero — first article with tickers
        const first = mapped[0];
        setHero(first);

        // Top stories — articles 2–6
        setTopStories(mapped.slice(1, 6));

        // Grid — articles 7–9
        setGridNews(mapped.slice(6, 9));

      } catch (err) {
        console.error("News fetch failed:", err);
      } finally {
        setNewsLoading(false);
      }
    }
    fetchNews();
  }, []);

  /* ── Filter grid when tab changes ── */
  useEffect(() => {
    if (allArticles.length === 0) return;

    if (activeTab === "All") {
      setGridNews(allArticles.slice(6, 9));
      return;
    }

    // keyword filter against headline + category
    const keyword = activeTab.toLowerCase();
    const filtered = allArticles.filter((a) =>
      a.category?.toLowerCase().includes(keyword) ||
      a.headline?.toLowerCase().includes(keyword)
    );

    setGridNews(filtered.slice(0, 3));
  }, [activeTab, allArticles]);

  /* ── Fetch live sector ETF quotes ── */
  useEffect(() => {
    async function fetchSectors() {
      try {
        const results = await Promise.all(
          SECTOR_ETFS.map(async ({ name, symbol }) => {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
            );
            const q = await res.json();
            const dp    = q.dp ?? 0;
            const score = Math.round(Math.min(100, Math.max(0, 50 + dp * 10)));
            return { name, score, up: dp >= 0, dp };
          })
        );
        setSectors(results);
      } catch (err) {
        console.error("Sector fetch failed:", err);
      }
    }
    fetchSectors();
  }, []);

  /* ── Fetch live earnings calendar ── */
  useEffect(() => {
    async function fetchEarnings() {
      try {
        const today = new Date();
        const from  = today.toISOString().split("T")[0];
        const to    = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];

        const res  = await fetch(
          `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`
        );
        const data = await res.json();

        const items = (data.earningsCalendar || [])
          .filter((e) => e.symbol && e.date)
          .slice(0, 8)
          .map((e) => ({
            ticker:   e.symbol,
            day:      formatEarningsDay(e.date),
            date:     e.date,
            time:     e.hour === "bmo" ? "Before open" : "After close",
            estimate: e.epsEstimate != null
              ? `EPS est. $${Number(e.epsEstimate).toFixed(2)}`
              : "Est. N/A",
            expected: e.revenueEstimate != null
              ? `$${(e.revenueEstimate / 1e9).toFixed(1)}B rev`
              : null,
          }));

        setEarnings(items);
      } catch (err) {
        console.error("Earnings fetch failed:", err);
      } finally {
        setEarningsLoad(false);
      }
    }
    fetchEarnings();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) navigate(`/stock/${query.trim().toUpperCase()}`);
  }

  return (
    <div className="homepage">

      {/* ── HERO + TOP STORIES ── */}
      <section className="hp-main-grid">

        {/* LEFT */}
        <div className="hp-left">

          {/* Hero card */}
          <div className="hero-card">
            <div className="hero-img">
              <div className="hero-img-placeholder">
                <i className="ti ti-photo" aria-hidden="true" />
                <p>News image</p>
              </div>
              {hero?.breaking && <span className="breaking-badge">Breaking</span>}
              {hero && (
                <span className={`hero-sentiment-badge badge badge-${hero.sentiment}`}>
                  {hero.category}
                </span>
              )}
            </div>

            <div className="hero-body">
              {newsLoading ? (
                <div className="loading-text">Loading news…</div>
              ) : hero ? (
                <>
                  <div className="hero-source">{hero.source} · {hero.age}</div>
                  <div className="hero-headline">{hero.headline}</div>
                  <div className="hero-summary">{hero.summary}</div>
                  {hero.tickers.length > 0 && (
                    <div className="hero-tickers">
                      {hero.tickers.map((t) => (
                        <span
                          key={t}
                          className="ticker-tag"
                          onClick={() => navigate(`/stock/${t}`)}
                          style={{ cursor: "pointer" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="loading-text">No news available</div>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="cat-tabs" style={{ marginTop: 16 }}>
            {CATEGORIES.map((cat) => (
              <div
                key={cat}
                className={`cat-tab${activeTab === cat ? " active" : ""}`}
                onClick={() => setActiveTab(cat)}
              >
                {cat}
              </div>
            ))}
          </div>

          {/* News grid */}
          <div className="news-grid" style={{ marginTop: 0 }}>
            {newsLoading ? (
              <div className="loading-text">Loading…</div>
            ) : gridNews.length > 0 ? (
              gridNews.map((item, i) => (
                <a
                  key={i}
                  className="news-grid-card"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="ngc-cat">{item.category}</div>
                  <div className="ngc-title">{item.headline}</div>
                  <div className="ngc-sum">{item.summary}</div>
                  <div className="ngc-foot">
                    <span className="ngc-src">{item.source} · {item.age}</span>
                    <SentimentBadge type={item.sentiment} />
                  </div>
                </a>
              ))
            ) : (
              <div className="loading-text">No articles found for this category</div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="hp-right">

          {/* Search */}
          <form className="hp-search-wrap" onSubmit={handleSearch}>
            <div className="stock-search-inner">
              <span className="stock-search-icon">🔍</span>
              <input
                className="stock-search-input"
                type="text"
                placeholder="Search ticker, e.g. AAPL..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <button className="stock-search-btn" type="submit">Analyze</button>
            </div>
          </form>

          {/* Top stories */}
          <div className="hp-panel">
            <div className="hp-panel-header">
              <span className="panel-section-title" style={{ margin: 0 }}>Top stories</span>
              <span className="hp-panel-link">View all</span>
            </div>
            {newsLoading ? (
              <div className="loading-text">Loading…</div>
            ) : (
              topStories.map((item, i) => (
                <a
                  key={i}
                  className="news-item"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="news-dot news-dot-neu" />
                  <div>
                    <div className="news-source">{item.source}</div>
                    <div className="news-title">{item.headline}</div>
                    <div className="news-meta">
                      <span className="news-time">{item.age}</span>
                      <SentimentBadge type={item.sentiment} />
                      {item.tickers[0] && (
                        <span
                          className="ticker-tag"
                          style={{ fontSize: 10, cursor: "pointer" }}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/stock/${item.tickers[0]}`);
                          }}
                        >
                          {item.tickers[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── SECTOR + EARNINGS ── */}
      <section className="hp-bottom-grid">

        {/* Sector heatmap — live */}
        <div className="hp-panel hp-panel-full-pad">
          <div className="hp-panel-header">
            <span className="panel-section-title" style={{ margin: 0 }}>
              <i className="ti ti-grid-dots" aria-hidden="true" style={{ fontSize: 14 }} />
              Sector sentiment
            </span>
            <span className="hp-panel-link">Live ETF data</span>
          </div>
          <div className="sector-grid">
            {sectors.map((s) => {
              const col = sectorColor(s.score);
              const sign = s.dp >= 0 ? "+" : "";
              return (
                <div
                  key={s.name}
                  className="sector-card"
                  style={{ background: col.bg, border: `0.5px solid ${col.border}` }}
                >
                  <div className="sector-name">{s.name}</div>
                  <div className="sector-score" style={{ color: col.text }}>{s.score}</div>
                  <div className="sector-chg" style={{ color: col.text }}>
                    {s.up ? "▲" : "▼"} {sign}{s.dp.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Earnings calendar — live */}
        <div className="hp-panel hp-panel-full-pad">
          <div className="hp-panel-header">
            <span className="panel-section-title" style={{ margin: 0 }}>
              <i className="ti ti-calendar" aria-hidden="true" style={{ fontSize: 14 }} />
              Earnings this week
            </span>
            <span className="hp-panel-link">Full calendar</span>
          </div>
          <div className="earnings-list">
            {earningsLoad ? (
              <div className="loading-text">Loading…</div>
            ) : earnings.length > 0 ? (
              earnings.map((e) => (
                <div
                  key={`${e.ticker}-${e.date}`}
                  className="earnings-item"
                  onClick={() => navigate(`/stock/${e.ticker}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="earnings-left">
                    <span className="earnings-ticker">{e.ticker}</span>
                    <span className="earnings-time">{e.time}</span>
                  </div>
                  <div className="earnings-right">
                    <span className="earnings-day">{e.day}</span>
                    <span className="earnings-expected" style={{ color: "#aaa" }}>
                      {e.estimate}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="loading-text">No earnings this week</div>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}

export default HomePage;