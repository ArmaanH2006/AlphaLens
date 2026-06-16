import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

/* ── Static indices data (replace with live API later) ── */
const INDICES = [
  { name: "S&P 500",  value: "5,847.32",  change: "+0.72%", up: true  },
  { name: "NASDAQ",   value: "18,943.10", change: "+1.14%", up: true  },
  { name: "DOW",      value: "42,156.87", change: "-0.23%", up: false },
  { name: "VIX",      value: "14.82",     change: "-3.10%", up: false },
];

/* ── Sector sentiment data (replace with real sentiment API) ── */
const SECTORS = [
  { name: "Technology",   score: 82, up: true  },
  { name: "Healthcare",   score: 61, up: true  },
  { name: "Finance",      score: 54, up: true  },
  { name: "Energy",       score: 38, up: false },
  { name: "Consumer",     score: 45, up: false },
  { name: "Industrials",  score: 70, up: true  },
  { name: "Real Estate",  score: 29, up: false },
  { name: "Utilities",    score: 55, up: true  },
];

/* ── Earnings calendar data (replace with Finnhub API) ── */
const EARNINGS = [
  { ticker: "ORCL", day: "Mon",  time: "After close", expected: "+3.2%" },
  { ticker: "ADBE", day: "Tue",  time: "After close", expected: "+2.1%" },
  { ticker: "AVGO", day: "Wed",  time: "After close", expected: "+4.8%" },
  { ticker: "FDX",  day: "Thu",  time: "Before open", expected: "-1.2%" },
  { ticker: "NKE",  day: "Thu",  time: "After close", expected: "+1.9%" },
];

/* ── Category tabs ── */
const CATEGORIES = ["All", "Markets", "Tech", "Earnings", "Economy", "Crypto", "Energy"];

/* ── Placeholder news (replace with Finnhub/NewsAPI/Alpaca) ── */
const PLACEHOLDER_NEWS = {
  hero: {
    source: "Reuters",
    age: "14 min ago",
    breaking: true,
    headline: "Fed signals one cut in 2026 as inflation stays sticky — markets reprice rate path lower",
    summary: "The Federal Reserve held rates steady and revised its dot plot to show just one 25bp cut this year, down from two previously projected, as core PCE remains above the 2% target.",
    tickers: ["SPY", "TLT", "JPM", "GLD"],
    sentiment: "neutral",
    category: "Economy",
  },
  topStories: [
    { source: "Bloomberg", age: "1h ago", title: "NVDA smashes estimates, raises AI chip outlook for H2", sentiment: "up", ticker: "NVDA", hot: true },
    { source: "FT",        age: "2h ago", title: "Apple faces fresh EU antitrust probe over App Store fees", sentiment: "dn", ticker: "AAPL", hot: false },
    { source: "WSJ",       age: "3h ago", title: "Jobs report beats — 230k added, unemployment dips to 3.8%", sentiment: "neu", ticker: "SPY", hot: false },
    { source: "CNBC",      age: "4h ago", title: "AMD gains as MI400 chip targets NVDA datacenter share", sentiment: "up", ticker: "AMD", hot: false },
    { source: "Barron's",  age: "5h ago", title: "Tesla delivery numbers miss expectations for third straight quarter", sentiment: "dn", ticker: "TSLA", hot: false },
  ],
  grid: [
    { category: "Energy",   source: "Reuters · 5h",  title: "Oil slips to $74 as OPEC signals output flexibility", summary: "Crude falls on softer China demand. XOM and CVX weaken pre-market.", sentiment: "dn" },
    { category: "Crypto",   source: "CoinDesk · 6h", title: "Bitcoin reclaims $72k as ETF inflows hit 3-month high", summary: "Spot ETF products saw $840M in daily inflows — highest since March halving rally.", sentiment: "up" },
    { category: "Earnings", source: "Whispers · 7h", title: "This week: ORCL, ADBE, AVGO report after market close", summary: "Analysts watching AVGO's AI segment guidance most closely this cycle.", sentiment: "neu" },
  ],
};

/* ── Sentiment badge helper ── */
function SentimentBadge({ type }) {
  const map = {
    up:  { label: "Bullish", cls: "badge badge-up"  },
    dn:  { label: "Bearish", cls: "badge badge-dn"  },
    neu: { label: "Neutral", cls: "badge badge-neu" },
  };
  const { label, cls } = map[type] ?? map.neu;
  return <span className={cls}>{label}</span>;
}

/* ── Sector color helper ── */
function sectorColor(score) {
  if (score >= 70) return { bg: "rgba(29,158,117,0.15)", border: "#0F6E56", text: "#1D9E75" };
  if (score >= 50) return { bg: "rgba(29,158,117,0.07)", border: "#1e1e22", text: "#aaa" };
  if (score >= 35) return { bg: "rgba(226,75,74,0.07)",  border: "#1e1e22", text: "#aaa" };
  return              { bg: "rgba(226,75,74,0.15)",  border: "#A32D2D", text: "#E24B4A" };
}

function HomePage() {
  const navigate  = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [query, setQuery]         = useState("");

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/stock/${query.trim().toUpperCase()}`);
    }
  }

  return (
    <div className="homepage">

      {/* ── HERO NEWS + TOP STORIES ── */}
      <section className="hp-main-grid">

        {/* LEFT — hero + category tabs + news grid */}
        <div className="hp-left">

          {/* Hero card */}
          <div className="hero-card">
            <div className="hero-img">
              <div className="hero-img-placeholder">
                <i className="ti ti-photo" aria-hidden="true" />
                <p>News image</p>
              </div>
              {PLACEHOLDER_NEWS.hero.breaking && (
                <span className="breaking-badge">Breaking</span>
              )}
              <span className={`hero-sentiment-badge badge badge-${PLACEHOLDER_NEWS.hero.sentiment === "neutral" ? "neu" : PLACEHOLDER_NEWS.hero.sentiment}`}>
                {PLACEHOLDER_NEWS.hero.category}
              </span>
            </div>
            <div className="hero-body">
              <div className="hero-source">
                {PLACEHOLDER_NEWS.hero.source} · {PLACEHOLDER_NEWS.hero.age}
              </div>
              <div className="hero-headline">{PLACEHOLDER_NEWS.hero.headline}</div>
              <div className="hero-summary">{PLACEHOLDER_NEWS.hero.summary}</div>
              <div className="hero-tickers">
                {PLACEHOLDER_NEWS.hero.tickers.map((t) => (
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
            {PLACEHOLDER_NEWS.grid.map((item, i) => (
              <div className="news-grid-card" key={i}>
                <div className="ngc-cat">{item.category}</div>
                <div className="ngc-title">{item.title}</div>
                <div className="ngc-sum">{item.summary}</div>
                <div className="ngc-foot">
                  <span className="ngc-src">{item.source}</span>
                  <SentimentBadge type={item.sentiment} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — search + top stories */}
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
              <button className="stock-search-btn" type="submit">
                Analyze
              </button>
            </div>
          </form>

          {/* Top stories */}
          <div className="hp-panel">
            <div className="hp-panel-header">
              <span className="panel-section-title" style={{ margin: 0 }}>Top stories</span>
              <span className="hp-panel-link">View all</span>
            </div>
            {PLACEHOLDER_NEWS.topStories.map((item, i) => (
              <div className="news-item" key={i}>
                <div className={`news-dot ${item.hot ? "news-dot-hot" : "news-dot-neu"}`} />
                <div>
                  <div className="news-source">{item.source}</div>
                  <div className="news-title">{item.title}</div>
                  <div className="news-meta">
                    <span className="news-time">{item.age}</span>
                    <SentimentBadge type={item.sentiment} />
                    <span
                      className="ticker-tag"
                      style={{ fontSize: 10, cursor: "pointer" }}
                      onClick={() => navigate(`/stock/${item.ticker}`)}
                    >
                      {item.ticker}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTOR HEATMAP + EARNINGS CALENDAR ── */}
      <section className="hp-bottom-grid">

        {/* Sector heatmap */}
        <div className="hp-panel hp-panel-full-pad">
          <div className="hp-panel-header">
            <span className="panel-section-title" style={{ margin: 0 }}>
              <i className="ti ti-grid-dots" aria-hidden="true" style={{ fontSize: 14 }} />
              Sector sentiment
            </span>
            <span className="hp-panel-link">AI-powered</span>
          </div>
          <div className="sector-grid">
            {SECTORS.map((s) => {
              const col = sectorColor(s.score);
              return (
                <div
                  key={s.name}
                  className="sector-card"
                  style={{
                    background: col.bg,
                    border: `0.5px solid ${col.border}`,
                  }}
                >
                  <div className="sector-name">{s.name}</div>
                  <div className="sector-score" style={{ color: col.text }}>
                    {s.score}
                  </div>
                  <div className="sector-chg" style={{ color: col.text }}>
                    {s.up ? "▲" : "▼"} sentiment
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Earnings calendar */}
        <div className="hp-panel hp-panel-full-pad">
          <div className="hp-panel-header">
            <span className="panel-section-title" style={{ margin: 0 }}>
              <i className="ti ti-calendar" aria-hidden="true" style={{ fontSize: 14 }} />
              Earnings this week
            </span>
            <span className="hp-panel-link">Full calendar</span>
          </div>
          <div className="earnings-list">
            {EARNINGS.map((e) => (
              <div
                className="earnings-item"
                key={e.ticker}
                onClick={() => navigate(`/stock/${e.ticker}`)}
              >
                <div className="earnings-left">
                  <span className="earnings-ticker">{e.ticker}</span>
                  <span className="earnings-time">{e.time}</span>
                </div>
                <div className="earnings-right">
                  <span className="earnings-day">{e.day}</span>
                  <span
                    className={`earnings-expected ${
                      e.expected.startsWith("+") ? "text-up" : "text-down"
                    }`}
                  >
                    {e.expected} expected
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>
    </div>
  );
}

export default HomePage;