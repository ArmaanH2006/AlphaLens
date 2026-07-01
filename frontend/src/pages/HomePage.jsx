import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

/* ── Sector ETF map ── */
const SECTOR_ETFS = [
  { name: "Technology", symbol: "XLK" },
  { name: "Healthcare", symbol: "XLV" },
  { name: "Finance", symbol: "XLF" },
  { name: "Energy", symbol: "XLE" },
  { name: "Consumer", symbol: "XLY" },
  { name: "Industrials", symbol: "XLI" },
  { name: "Real Estate", symbol: "XLRE" },
  { name: "Utilities", symbol: "XLU" },
];

/* ── Category tabs ── */
const CATEGORIES = ["All", "Markets", "Tech", "Earnings", "Economy", "Crypto", "Energy"];
const NEWS_FEEDS = ["general", "crypto"];
const TOP_STORY_COUNT = 5;
const GRID_STORY_COUNT = 3;

/* ── Category → related-keyword map, used for client-side filtering.
   Finnhub has only a few server-side news feeds, so custom tabs like
   Markets/Earnings/Economy are filtered locally against article metadata. ── */
const TAB_KEYWORDS = {
  Markets: ["market", "markets", "stocks", "dow", "s&p", "nasdaq", "index", "shares", "wall street", "trading"],
  Tech: ["tech", "technology", "ai", "software", "chip", "chips", "semiconductor", "cloud", "startup"],
  Earnings: ["earnings", "eps", "quarterly", "revenue", "profit", "results", "guidance", "beat", "miss"],
  Economy: ["economy", "economic", "inflation", "fed", "interest rate", "gdp", "jobs report", "unemployment", "cpi"],
  Crypto: ["crypto", "bitcoin", "ethereum", "blockchain", "btc", "eth", "coin"],
  Energy: ["energy", "oil", "gas", "opec", "crude", "renewable", "solar", "barrel"],
};

/* ── How recent an article must be to earn the "Breaking" badge ── */
const BREAKING_WINDOW_SECONDS = 15 * 60;

function buildFinnhubUrl(path, params = {}) {
  if (!FINNHUB_KEY) {
    throw new Error("Missing VITE_FINNHUB_KEY");
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`);
  Object.entries({ ...params, token: FINNHUB_KEY }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ── Match a standalone keyword/phrase without false positives like
   "ai" inside "said" or "gas" inside "Vegas". ── */
function matchesTerm(text, term) {
  const cleanTerm = String(term || "").trim();
  if (!cleanTerm) return false;

  const escaped = escapeRegExp(cleanTerm);
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return re.test(text);
}

/* ── Convert unix timestamp to "2h ago" ── */
function timeAgo(unixSeconds) {
  const timestamp = Number(unixSeconds);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Time N/A";

  const diff = Math.floor(Date.now() / 1000 - timestamp);
  if (diff < 0) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Map sentiment score → up/dn/neu ── */
function mapSentiment(score) {
  if (score > 0) return "up";
  if (score < 0) return "dn";
  return "neu";
}

/* ── Lightweight keyword-based sentiment heuristic.
   Finnhub's /news endpoint does not return a sentiment score per article,
   so this is a rough local estimate from headline + summary text. ── */
const BULLISH_WORDS = [
  "surge", "surges", "surged", "soar", "soars", "soared", "jump", "jumps", "jumped",
  "rally", "rallies", "rallied", "gain", "gains", "beat", "beats", "record high",
  "upgrade", "upgrades", "climb", "climbs", "rebound", "rebounds", "outperform",
  "rise", "rises", "boost", "boosts", "rocket", "rockets",
];

const BEARISH_WORDS = [
  "plunge", "plunges", "plunged", "crash", "crashes", "slump", "slumps", "tumble",
  "tumbles", "sink", "sinks", "miss", "misses", "downgrade", "downgrades", "sell-off",
  "selloff", "fall", "falls", "warn", "warns", "cut", "cuts", "lawsuit", "layoff", "layoffs", "drop", "drops",
];

function estimateSentiment(headline, summary) {
  const text = `${headline || ""} ${summary || ""}`;
  let score = 0;

  for (const word of BULLISH_WORDS) if (matchesTerm(text, word)) score += 1;
  for (const word of BEARISH_WORDS) if (matchesTerm(text, word)) score -= 1;

  return mapSentiment(score);
}

/* ── Parse tickers from related field ── */
function parseTickers(related) {
  if (!related) return [];

  return related
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z.]{1,5}$/.test(t))
    .slice(0, 4);
}

function articleKey(article) {
  return article.id || article.url || `${article.source}-${article.headline}`;
}

function dedupeArticles(articles) {
  const seen = new Set();

  return articles.filter((article) => {
    const key = articleKey(article);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ── Map article to clean shape ── */
function mapArticle(a, feedCategory = "general") {
  const timestamp = Number(a.datetime);
  const ageSeconds = Number.isFinite(timestamp) ? Date.now() / 1000 - timestamp : Infinity;
  const category = a.category || feedCategory;

  return {
    id: String(a.id || a.url || `${a.source || "News"}-${a.headline || "Untitled"}`),
    source: a.source || "News",
    age: timeAgo(timestamp),
    headline: a.headline || "Untitled story",
    summary: a.summary || "",
    category,
    feedCategory,
    sentiment: estimateSentiment(a.headline, a.summary),
    tickers: parseTickers(a.related),
    url: a.url || "#",
    image: typeof a.image === "string" ? a.image.trim() : "",
    breaking: ageSeconds >= 0 && ageSeconds < BREAKING_WINDOW_SECONDS,
  };
}

function articleMatchesTab(article, tab) {
  if (tab === "All") return true;

  const keywords = TAB_KEYWORDS[tab] || [tab.toLowerCase()];
  const haystack = `${article.category} ${article.feedCategory} ${article.headline} ${article.summary}`;
  return keywords.some((kw) => matchesTerm(haystack, kw));
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/* ── Sentiment badge ── */
function SentimentBadge({ type }) {
  const map = {
    up: { label: "Bullish", cls: "badge badge-up" },
    dn: { label: "Bearish", cls: "badge badge-dn" },
    neu: { label: "Neutral", cls: "badge badge-neu" },
  };
  const { label, cls } = map[type] ?? map.neu;
  return <span className={cls}>{label}</span>;
}

function hasArticleUrl(article) {
  return Boolean(article?.url && article.url !== "#");
}

function ArticleLink({ article, children, className = "", style = {}, ariaLabel }) {
  if (!hasArticleUrl(article)) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <a
      className={className}
      href={article.url}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel || `Open article: ${article.headline}`}
      style={{ textDecoration: "none", color: "inherit", ...style }}
    >
      {children}
    </a>
  );
}

function NewsImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  const shouldShowImage = src && !failed;

  if (shouldShowImage) {
    return (
      <img
        className={`news-image ${className}`.trim()}
        src={src}
        alt={alt || "News image"}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }

  return (
    <div className="hero-img-placeholder">
      <i className="ti ti-photo" aria-hidden="true" />
      <p>News image</p>
    </div>
  );
}

/* ── Sector color ── */
function sectorColor(score) {
  if (score >= 70) return { bg: "rgba(29,158,117,0.15)", border: "#0F6E56", text: "#1D9E75" };
  if (score >= 50) return { bg: "rgba(29,158,117,0.07)", border: "#1e1e22", text: "#aaa" };
  if (score >= 35) return { bg: "rgba(226,75,74,0.07)", border: "#1e1e22", text: "#aaa" };
  return { bg: "rgba(226,75,74,0.15)", border: "#A32D2D", text: "#E24B4A" };
}

/* ── Format earnings date as a weekday label without timezone drift ── */
function formatEarningsDay(dateStr) {
  if (!dateStr) return "N/A";

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));

  if (!Number.isFinite(d.getTime())) return "N/A";
  return days[d.getUTCDay()];
}

/* ── Format earnings timing label (Finnhub: bmo / amc / dmh) ── */
function formatEarningsTime(hour) {
  if (hour === "bmo") return "Before open";
  if (hour === "amc") return "After close";
  if (hour === "dmh") return "During hours";
  return "Time N/A";
}

function HomePage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("All");
  const [query, setQuery] = useState("");

  // News state
  const [restArticles, setRestArticles] = useState([]); // fetched articles minus the hero
  const [hero, setHero] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);

  // Sector state
  const [sectors, setSectors] = useState([]);
  const [sectorsLoading, setSectorsLoading] = useState(true);

  // Earnings state
  const [earnings, setEarnings] = useState([]);
  const [earningsLoad, setEarningsLoad] = useState(true);

  const topStories = useMemo(
    () => restArticles.slice(0, TOP_STORY_COUNT),
    [restArticles]
  );

  const gridNews = useMemo(() => {
    const pool = restArticles.slice(TOP_STORY_COUNT);
    const visibleArticles = activeTab === "All"
      ? pool
      : pool.filter((article) => articleMatchesTab(article, activeTab));

    return visibleArticles.slice(0, GRID_STORY_COUNT);
  }, [activeTab, restArticles]);

  /* ── Fetch live news ── */
  useEffect(() => {
    let isMounted = true;

    async function fetchNews() {
      try {
        const responses = await Promise.allSettled(
          NEWS_FEEDS.map(async (category) => {
            const data = await fetchJson(buildFinnhubUrl("/news", { category }));
            return Array.isArray(data)
              ? data.map((article) => mapArticle(article, category))
              : [];
          })
        );

        if (!isMounted) return;

        const mapped = dedupeArticles(
          responses.flatMap((result) => result.status === "fulfilled" ? result.value : [])
        );
        if (mapped.length === 0) return;

        // Hero — first article that has tickers attached, with a safe fallback.
        const heroArticle = mapped.find((a) => a.tickers.length > 0) || mapped[0];
        const rest = mapped.filter((a) => articleKey(a) !== articleKey(heroArticle));

        setHero(heroArticle);
        setRestArticles(rest);
      } catch (err) {
        console.error("News fetch failed:", err);
      } finally {
        if (isMounted) setNewsLoading(false);
      }
    }

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, []);

  /* ── Fetch live sector ETF quotes ── */
  useEffect(() => {
    let isMounted = true;

    async function fetchSectors() {
      try {
        const results = await Promise.allSettled(
          SECTOR_ETFS.map(async ({ name, symbol }) => {
            const q = await fetchJson(buildFinnhubUrl("/quote", { symbol }));
            const dp = Number.isFinite(Number(q.dp)) ? Number(q.dp) : 0;
            const score = Math.round(Math.min(100, Math.max(0, 50 + dp * 10)));

            return { name, score, up: dp >= 0, dp };
          })
        );

        const fulfilledResults = results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value);

        if (isMounted) setSectors(fulfilledResults);
      } catch (err) {
        console.error("Sector fetch failed:", err);
      } finally {
        if (isMounted) setSectorsLoading(false);
      }
    }

    fetchSectors();

    return () => {
      isMounted = false;
    };
  }, []);

  /* ── Fetch live earnings calendar ── */
  useEffect(() => {
    let isMounted = true;

    async function fetchEarnings() {
      try {
        const today = new Date();
        const from = formatLocalDate(today);
        const to = formatLocalDate(addDays(today, 7));

        const data = await fetchJson(buildFinnhubUrl("/calendar/earnings", { from, to }));

        const items = (data.earningsCalendar || [])
          .filter((e) => e.symbol && e.date)
          .slice(0, 8)
          .map((e) => ({
            ticker: e.symbol,
            day: formatEarningsDay(e.date),
            date: e.date,
            time: formatEarningsTime(e.hour),
            estimate: e.epsEstimate != null
              ? `EPS est. $${Number(e.epsEstimate).toFixed(2)}`
              : "Est. N/A",
            revenue: e.revenueEstimate != null
              ? `$${(Number(e.revenueEstimate) / 1e9).toFixed(1)}B rev`
              : null,
          }));

        if (isMounted) setEarnings(items);
      } catch (err) {
        console.error("Earnings fetch failed:", err);
      } finally {
        if (isMounted) setEarningsLoad(false);
      }
    }

    fetchEarnings();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (symbol) navigate(`/stock/${symbol}`);
  }

  return (
    <div className="homepage">
      {/* ── HERO + TOP STORIES ── */}
      <section className="hp-main-grid">
        {/* LEFT */}
        <div className="hp-left">
          {/* Hero card */}
          <div className="hero-card">
            <ArticleLink
              article={hero}
              className="hero-img hero-img-link"
              ariaLabel={hero ? `Open article: ${hero.headline}` : "News image"}
              style={{ display: "block", cursor: hasArticleUrl(hero) ? "pointer" : "default" }}
            >
              <NewsImage
                src={hero?.image}
                alt={hero?.headline ? `${hero.headline} image` : "News image"}
                className="hero-news-image"
              />
              {hero?.breaking && <span className="breaking-badge">Breaking</span>}
              {hero && (
                <span className={`hero-sentiment-badge badge badge-${hero.sentiment}`}>
                  {hero.category}
                </span>
              )}
            </ArticleLink>

            <div className="hero-body">
              {newsLoading ? (
                <div className="loading-text">Loading news…</div>
              ) : hero ? (
                <>
                  <ArticleLink
                    article={hero}
                    className="hero-article-link"
                    ariaLabel={`Open article: ${hero.headline}`}
                    style={{ display: "block", cursor: hasArticleUrl(hero) ? "pointer" : "default" }}
                  >
                    <div className="hero-source">{hero.source} · {hero.age}</div>
                    <div className="hero-headline">{hero.headline}</div>
                    <div className="hero-summary">{hero.summary}</div>
                  </ArticleLink>

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
              gridNews.map((item) => (
                <a
                  key={articleKey(item)}
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
            ) : topStories.length > 0 ? (
              topStories.map((item) => (
                <a
                  key={articleKey(item)}
                  className="news-item"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className={`news-dot news-dot-${item.sentiment}`} />
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
            ) : (
              <div className="loading-text">No top stories available</div>
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
          {sectorsLoading ? (
            <div className="loading-text">Loading…</div>
          ) : sectors.length > 0 ? (
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
          ) : (
            <div className="loading-text">Sector data unavailable</div>
          )}
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
                      {e.estimate}{e.revenue ? ` · ${e.revenue}` : ""}
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