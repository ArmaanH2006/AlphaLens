import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;

const CATEGORIES = ["All", "General", "Crypto", "Forex", "Merger"];

const FINNHUB_CATEGORIES = {
  All: ["general", "crypto", "forex", "merger"],
  General: ["general"],
  Crypto: ["crypto"],
  Forex: ["forex", "general"],
  Merger: ["merger"],
};

const PAGE_SIZE = 12;
const MAX_ARTICLES_PER_TAB = 80;
const ONE_HOUR_SECONDS = 60 * 60;

const CATEGORY_STYLE = {
  general: {
    icon: "📰",
    label: "General",
  },
  crypto: {
    icon: "◈",
    label: "Crypto",
  },
  forex: {
    icon: "⇄",
    label: "Forex",
  },
  merger: {
    icon: "⬡",
    label: "Merger",
  },
};

const CURRENCY_CODES = new Set([
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "EUR",
  "GBP",
  "HKD",
  "JPY",
  "MXN",
  "NZD",
  "SEK",
  "SGD",
  "USD",
  "ZAR",
]);

const FOREX_KEYWORDS = [
  "forex",
  "fx",
  "currency",
  "currencies",
  "dollar",
  "greenback",
  "euro",
  "yen",
  "pound",
  "sterling",
  "franc",
  "aussie",
  "loonie",
  "kiwi",
  "ecb",
  "boj",
  "boe",
  "fed",
  "fomc",
  "rate",
  "rates",
  "yield",
  "inflation",
  "cpi",
  "pce",
  "payrolls",
  "nfp",
];

const JUNK_HEADLINE_PATTERNS = [
  /^\s*$/,
  /^market news$/i,
  /^latest news$/i,
  /^forex news$/i,
  /^economic calendar$/i,
  /^technical analysis$/i,
];

const POSITIVE_WORDS = [
  "surge",
  "soar",
  "rally",
  "jump",
  "gain",
  "gains",
  "climb",
  "rebound",
  "beat",
  "beats",
  "upgrade",
  "upgraded",
  "record high",
  "outperform",
  "bullish",
  "strong",
  "strength",
  "growth",
  "profit",
  "profits",
  "rise",
  "rises",
  "rising",
  "boost",
  "boosted",
  "recovery",
  "optimis",
  "upside",
  "breakthrough",
  "expand",
  "expansion",
  "exceed",
  "exceeds",
  "rebounded",
];

const NEGATIVE_WORDS = [
  "plunge",
  "plummet",
  "crash",
  "slump",
  "slide",
  "drop",
  "drops",
  "dropped",
  "fall",
  "falls",
  "falling",
  "tumble",
  "miss",
  "misses",
  "missed",
  "downgrade",
  "downgraded",
  "weak",
  "weakness",
  "decline",
  "declines",
  "loss",
  "losses",
  "bearish",
  "sell-off",
  "selloff",
  "recession",
  "layoff",
  "layoffs",
  "warn",
  "warns",
  "warning",
  "fraud",
  "lawsuit",
  "probe",
  "investigation",
  "concern",
  "concerns",
  "risk",
  "default",
  "bankruptcy",
  "volatil",
  "cut rates",
  "rate cut fears",
];

function normalizeCategory(category, fallback = "general") {
  const raw = String(category || fallback || "general").toLowerCase();

  if (raw.includes("crypto")) return "crypto";
  if (raw.includes("forex") || raw.includes("fx")) return "forex";
  if (raw.includes("merger") || raw.includes("acquisition") || raw.includes("m&a")) return "merger";

  return "general";
}

function categoryStyle(category) {
  return CATEGORY_STYLE[normalizeCategory(category)] || CATEGORY_STYLE.general;
}

function timeAgo(unixSeconds) {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "Recently";

  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(unixSeconds * 1000).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(unixSeconds * 1000));
}

function absoluteDate(unixSeconds) {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "Recently updated";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanText(value) {
  return decodeHtmlEntities(value)
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/p>\s*<p>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s*This article was written by .+?(?:\.|$)/i, "")
    .replace(/\s*The post .+? appeared first on .+?(?:\.|$)/i, "")
    .replace(/\s*Read more:? .+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value, maxLength = 160) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;

  const trimmed = text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return `${trimmed || text.slice(0, maxLength).trim()}…`;
}

function analyzeSentiment(text) {
  if (!text) return "neu";

  const clean = text.toLowerCase();
  let score = 0;

  for (const word of POSITIVE_WORDS) {
    if (clean.includes(word)) score += 1;
  }

  for (const word of NEGATIVE_WORDS) {
    if (clean.includes(word)) score -= 1;
  }

  if (score > 0) return "up";
  if (score < 0) return "dn";

  return "neu";
}

function normalizeForexPair(value) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/^.*:/, "")
    .replace(/[_\-\s]/g, "")
    .replace(/[^A-Z]/g, "");

  if (cleaned.length !== 6) return null;

  const base = cleaned.slice(0, 3);
  const quote = cleaned.slice(3, 6);

  if (!CURRENCY_CODES.has(base) || !CURRENCY_CODES.has(quote) || base === quote) {
    return null;
  }

  return `${base}/${quote}`;
}

function parseTickers(related, text = "") {
  const tags = new Set();

  if (related) {
    String(related)
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => {
        const pair = normalizeForexPair(token);

        if (pair) {
          tags.add(pair);
          return;
        }

        const symbol = token.replace(/^.*:/, "").trim().toUpperCase();

        if (/^[A-Z][A-Z0-9.]{0,5}$/.test(symbol)) {
          tags.add(symbol);
        }
      });
  }

  const textPairs = String(text || "").match(/\b[A-Z]{3}[\/\-_]?[A-Z]{3}\b/g) || [];

  for (const maybePair of textPairs) {
    const pair = normalizeForexPair(maybePair);
    if (pair) tags.add(pair);
  }

  return [...tags].slice(0, 4);
}

function isForexRelevant(article) {
  const rawText = `${article.headline || ""} ${article.summary || ""} ${article.rawRelated || ""}`;
  const lowerText = rawText.toLowerCase();

  const hasCurrencyPair = /\b[A-Z]{3}[\/\-_]?[A-Z]{3}\b/.test(rawText);
  const hasKeyword = FOREX_KEYWORDS.some((keyword) => lowerText.includes(keyword));

  return hasCurrencyPair || hasKeyword;
}

function mapArticle(article, fallbackCategory) {
  const headline = cleanText(article.headline);
  const summary = cleanText(article.summary);
  const category = normalizeCategory(article.category, fallbackCategory);
  const sentimentText = `${headline} ${summary}`;

  return {
    id: `${article.id || article.url || headline}-${article.datetime || 0}`,
    source: cleanText(article.source) || "News",
    age: timeAgo(Number(article.datetime)),
    absoluteTime: absoluteDate(Number(article.datetime)),
    datetime: Number(article.datetime) || 0,
    headline,
    summary,
    category,
    sentiment: analyzeSentiment(sentimentText),
    tickers: parseTickers(article.related, sentimentText),
    url: article.url || "",
    image: article.image || null,
    rawRelated: article.related || "",
  };
}

function cleanArticles(articles, requestedCategory) {
  const category = normalizeCategory(requestedCategory);
  const seen = new Set();

  return articles
    .filter((article) => article.headline && article.headline.length > 8)
    .filter((article) => article.datetime && article.datetime > 0)
    .filter((article) => !JUNK_HEADLINE_PATTERNS.some((pattern) => pattern.test(article.headline)))
    .filter((article) => (category === "forex" || article.category === "forex" ? isForexRelevant(article) : true))
    .filter((article) => {
      const key = article.headline
        .trim()
        .toLowerCase()
        .replace(/&amp;/g, "&")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 70);

      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, MAX_ARTICLES_PER_TAB);
}

async function fetchCategoryNews(category, signal) {
  const url = new URL("https://finnhub.io/api/v1/news");

  url.searchParams.set("category", category);
  url.searchParams.set("token", FINNHUB_KEY);

  const response = await fetch(url.toString(), { signal });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || data?.message || `Finnhub request failed (${response.status})`;
    throw new Error(message);
  }

  if (!Array.isArray(data)) {
    const message = data?.error || data?.message || "Finnhub returned an invalid news response.";
    throw new Error(message);
  }

  return data.map((article) => mapArticle(article, category));
}

function SentimentBadge({ type }) {
  const map = {
    up: { label: "Bullish", cls: "badge badge-up" },
    dn: { label: "Bearish", cls: "badge badge-dn" },
    neu: { label: "Neutral", cls: "badge badge-neu" },
  };

  const { label, cls } = map[type] ?? map.neu;

  return <span className={cls}>{label}</span>;
}

function CategoryPill({ category }) {
  const normalized = normalizeCategory(category);
  const style = categoryStyle(category);

  return <span className={`category-pill category-pill-${normalized}`}>{style.label}</span>;
}

function ArticleImage({ src, category, height }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const normalized = normalizeCategory(category);
  const style = categoryStyle(category);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`np-img-wrap np-img-wrap-${normalized}`}
      style={{
        position: "relative",
        height,
        overflow: "hidden",
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="np-img"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
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
            color: "inherit",
            opacity: 0.72,
          }}
        >
          {style.icon}
        </div>
      )}
    </div>
  );
}

function TickerTags({ tickers, navigate }) {
  if (!tickers.length) return null;

  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {tickers.map((ticker) => {
        const isForexPair = ticker.includes("/");

        return (
          <span
            key={ticker}
            className={`ticker-tag${isForexPair ? " forex-tag" : ""}`}
            title={isForexPair ? "Forex pair" : `Open ${ticker}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (!isForexPair) {
                navigate(`/stock/${ticker}`);
              }
            }}
            style={{ cursor: isForexPair ? "default" : "pointer" }}
          >
            {ticker}
          </span>
        );
      })}
    </div>
  );
}

function ArticleLink({ article, children, style }) {
  if (!article.url) {
    return <div style={style}>{children}</div>;
  }

  return (
    <a href={article.url} target="_blank" rel="noreferrer" style={style}>
      {children}
    </a>
  );
}

function HeroArticle({ article, navigate }) {
  const isBreaking = Date.now() / 1000 - article.datetime < ONE_HOUR_SECONDS;

  return (
    <ArticleLink article={article} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div
        className="np-card np-hero np-fade"
        style={{
          background: "#141417",
          border: "1px solid #1e1e24",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 24,
          cursor: article.url ? "pointer" : "default",
        }}
      >
        <div style={{ position: "relative" }}>
          <ArticleImage src={article.image} category={article.category} height={320} />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 28%, rgba(10,10,12,0.58) 66%, rgba(10,10,12,0.94) 100%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <CategoryPill category={article.category} />
            {isBreaking && <span className="breaking-pill">Breaking</span>}
          </div>

          <div style={{ position: "absolute", top: 14, right: 14 }}>
            <SentimentBadge type={article.sentiment} />
          </div>

          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "22px 26px 20px" }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
              {article.source} · {article.age}
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                lineHeight: 1.28,
                color: "#fff",
                textShadow: "0 2px 12px rgba(0,0,0,0.45)",
              }}
            >
              {article.headline}
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 24px 22px" }}>
          {article.summary && (
            <div
              style={{
                fontSize: 13.5,
                color: "#9a9aa3",
                lineHeight: 1.65,
                marginBottom: article.tickers.length ? 14 : 0,
              }}
            >
              {excerpt(article.summary, 420)}
            </div>
          )}

          <TickerTags tickers={article.tickers} navigate={navigate} />
        </div>
      </div>
    </ArticleLink>
  );
}

function ArticleCard({ article, navigate, delay }) {
  return (
    <ArticleLink
      article={article}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        height: "100%",
      }}
    >
      <div
        className="np-card np-fade"
        style={{
          background: "#141417",
          border: "1px solid #1e1e24",
          borderRadius: 14,
          overflow: "hidden",
          cursor: article.url ? "pointer" : "default",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          animationDelay: `${delay}ms`,
        }}
      >
        <ArticleImage src={article.image} category={article.category} height={145} />

        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <CategoryPill category={article.category} />
            <SentimentBadge type={article.sentiment} />
          </div>

          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, marginBottom: 8, color: "#ededf2" }}>
            {article.headline}
          </div>

          <div style={{ fontSize: 12.5, color: "#7b7b84", lineHeight: 1.55, marginBottom: 14 }}>
            {article.summary ? excerpt(article.summary, 132) : "Open the story for more details."}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginTop: "auto" }}>
            <span style={{ fontSize: 11, color: "#666", minWidth: 0 }} title={article.absoluteTime}>
              {article.source} · {article.age}
            </span>

            <TickerTags tickers={article.tickers} navigate={navigate} />
          </div>
        </div>
      </div>
    </ArticleLink>
  );
}

function SkeletonBlock({ style }) {
  return <div className="np-shimmer" style={{ background: "#1c1c22", borderRadius: 4, ...style }} />;
}

function SkeletonHero() {
  return (
    <div
      style={{
        background: "#141417",
        border: "1px solid #1e1e24",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <SkeletonBlock style={{ height: 320, borderRadius: 0 }} />

      <div style={{ padding: "18px 24px 22px" }}>
        <SkeletonBlock style={{ height: 12, width: "90%", marginBottom: 8 }} />
        <SkeletonBlock style={{ height: 12, width: "60%" }} />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#141417",
        border: "1px solid #1e1e24",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <SkeletonBlock style={{ height: 145, borderRadius: 0 }} />

      <div style={{ padding: "14px 16px 16px" }}>
        <SkeletonBlock style={{ height: 9, width: "35%", marginBottom: 10 }} />
        <SkeletonBlock style={{ height: 13, width: "95%", marginBottom: 8 }} />
        <SkeletonBlock style={{ height: 13, width: "75%", marginBottom: 12 }} />
        <SkeletonBlock style={{ height: 9, width: "45%" }} />
      </div>
    </div>
  );
}

function EmptyState({ activeTab, onRetry }) {
  const style = categoryStyle(activeTab);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 20px",
        color: "#777",
        border: "1px dashed #2e2e36",
        borderRadius: 18,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        className={`category-empty-icon category-empty-icon-${normalizeCategory(activeTab)}`}
        style={{ fontSize: 36, marginBottom: 12 }}
      >
        {style.icon}
      </div>

      <p style={{ fontSize: 14, color: "#a0a0aa", margin: "0 0 6px" }}>
        No clean {activeTab.toLowerCase()} stories found.
      </p>

      <p style={{ fontSize: 12, margin: "0 0 18px" }}>
        The feed may be empty or full of duplicate / low-quality entries right now.
      </p>

      <button className="np-primary-button" onClick={onRetry} type="button">
        Refresh
      </button>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>

      <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 6 }}>Could not load news.</p>

      <p style={{ color: "#777", fontSize: 12, marginBottom: 18 }}>{error}</p>

      <button className="np-primary-button" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  );
}

function NewsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("All");
  const [allArticles, setAllArticles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [activeTab]);

  useEffect(() => {
    const categoriesToFetch = FINNHUB_CATEGORIES[activeTab] || ["general"];
    const cacheKey = activeTab;

    if (!FINNHUB_KEY) {
      setLoading(false);
      setError("Missing VITE_FINNHUB_KEY in your environment variables.");
      return undefined;
    }

    if (allArticles[cacheKey]) {
      setLoading(false);
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    let isCurrent = true;

    async function fetchNews() {
      try {
        setLoading(true);
        setError("");

        const results = await Promise.allSettled(
          categoriesToFetch.map((category) => fetchCategoryNews(category, controller.signal)),
        );

        const fulfilledArticles = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

        const mapped = cleanArticles(fulfilledArticles, activeTab === "Forex" ? "forex" : "general");

        if (!isCurrent) return;

        if (!mapped.length && results.some((result) => result.status === "rejected")) {
          const firstError = results.find((result) => result.status === "rejected")?.reason;
          throw new Error(firstError?.message || "No news articles were returned.");
        }

        setAllArticles((prev) => ({
          ...prev,
          [cacheKey]: mapped,
        }));
      } catch (err) {
        if (err?.name === "AbortError" || !isCurrent) return;

        console.error("News fetch failed:", err);
        setError(err?.message || "Could not load news. Try again.");
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    fetchNews();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [activeTab, allArticles, retryToken]);

  function handleRetry() {
    setAllArticles((prev) => {
      const next = { ...prev };
      delete next[activeTab];
      return next;
    });

    setRetryToken((token) => token + 1);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const articles = allArticles[activeTab] || [];
  const hero = articles[0] || null;
  const rest = articles.slice(1);
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);

  const paged = useMemo(
    () => rest.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [rest, currentPage],
  );

  const lastUpdated = articles[0]?.absoluteTime || "Waiting for feed";

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1120, margin: "0 auto" }}>
      <style>{`
        .np-card {
          transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }

        .np-card:hover {
          border-color: #34344f;
          transform: translateY(-3px);
          box-shadow: 0 14px 34px rgba(0,0,0,0.38);
        }

        .np-img {
          transition: transform .5s ease, filter .3s ease;
        }

        .np-card:hover .np-img {
          transform: scale(1.06);
          filter: saturate(1.08);
        }

        .np-fade {
          animation: npFadeIn .38s ease both;
        }

        @keyframes npFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: none;
          }
        }

        .np-shimmer {
          background: linear-gradient(90deg, #1c1c22 0%, #26262e 50%, #1c1c22 100%);
          background-size: 600px 100%;
          animation: npShimmer 1.5s infinite linear;
        }

        @keyframes npShimmer {
          0% {
            background-position: -300px 0;
          }

          100% {
            background-position: 300px 0;
          }
        }

        .cat-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 5px;
          border: 1px solid #24242c;
          border-radius: 14px;
          background: rgba(255,255,255,0.025);
        }

        .cat-tab {
          border: none;
          background: transparent;
          user-select: none;
          color: #85858f;
          font-size: 13px;
          font-weight: 650;
          padding: 9px 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: background .15s ease, color .15s ease, transform .15s ease;
        }

        .cat-tab:hover {
          color: #f1f1f5;
          background: rgba(255,255,255,0.045);
        }

        .cat-tab.active {
          color: #fff;
          background: #1D9E75;
          box-shadow: 0 8px 22px rgba(29,158,117,0.18);
        }

        .badge,
        .category-pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 9px;
          border-radius: 20px;
          white-space: nowrap;
          font-family: inherit;
        }

        .category-pill {
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .badge-up {
          background: #0a1f12;
          color: #1D9E75;
          border: 0.5px solid #0F6E56;
        }

        .badge-dn {
          background: #1f0a0a;
          color: #E24B4A;
          border: 0.5px solid #A32D2D;
        }

        .badge-neu {
          background: #1a1209;
          color: #BA7517;
          border: 0.5px solid #854F0B;
        }

        .category-pill-general {
          background: #0d1726;
          color: #5B8DEF;
          border: 0.5px solid #27446f;
        }

        .category-pill-crypto {
          background: #1f1608;
          color: #F2B84B;
          border: 0.5px solid #8f6724;
        }

        .category-pill-forex {
          background: #071f1a;
          color: #3FC1A6;
          border: 0.5px solid #1f6f61;
        }

        .category-pill-merger {
          background: #180d22;
          color: #B37FEB;
          border: 0.5px solid #67438a;
        }

        .np-img-wrap-general {
          background: linear-gradient(135deg, #1a2332 0%, #0f1420 100%);
          color: #5B8DEF;
        }

        .np-img-wrap-crypto {
          background: linear-gradient(135deg, #2b2210 0%, #16130a 100%);
          color: #F2B84B;
        }

        .np-img-wrap-forex {
          background: linear-gradient(135deg, #0f2620 0%, #0a1512 100%);
          color: #3FC1A6;
        }

        .np-img-wrap-merger {
          background: linear-gradient(135deg, #251a2e 0%, #140e19 100%);
          color: #B37FEB;
        }

        .category-empty-icon-general { color: #5B8DEF; }
        .category-empty-icon-crypto { color: #F2B84B; }
        .category-empty-icon-forex { color: #3FC1A6; }
        .category-empty-icon-merger { color: #B37FEB; }

        .ticker-tag {
          color: #bfbfc8;
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
          transition: background .15s ease, color .15s ease;
        }

        .ticker-tag:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
        }

        .forex-tag {
          color: #68dcca;
        }

        .breaking-pill {
          background: #E24B4A;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 5px 9px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .np-primary-button {
          background: #1D9E75;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 9px 20px;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .15s ease, opacity .15s ease;
        }

        .np-primary-button:hover {
          transform: translateY(-1px);
        }

        .np-page-button {
          border: 1px solid #2e2e36;
          border-radius: 9px;
          min-width: 36px;
          height: 34px;
          padding: 0 12px;
          color: #777;
          background: #1a1a1e;
          font-size: 13px;
          cursor: pointer;
          font-weight: 650;
          transition: background .15s ease, color .15s ease, opacity .15s ease;
        }

        .np-page-button.active {
          background: #1D9E75;
          color: #fff;
        }

        .np-page-button:disabled {
          cursor: not-allowed;
          opacity: .45;
        }

        @media (max-width: 700px) {
          .np-hero .np-img-wrap {
            height: 240px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .np-card,
          .np-img,
          .np-fade,
          .np-shimmer {
            animation: none !important;
            transition: none !important;
          }

          .np-card:hover {
            transform: none;
          }
        }
      `}</style>

      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="panel-section-title"
            style={{
              fontSize: 22,
              marginBottom: 5,
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            News

            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#1D9E75",
                display: "inline-block",
                boxShadow: "0 0 0 4px rgba(29,158,117,0.18)",
              }}
            />
          </div>

          <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
            Live market news — cleaned, deduped, and sorted newest first.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            color: "#777",
            fontSize: 12,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid #24242c",
            borderRadius: 12,
            padding: "9px 12px",
          }}
        >
          <span>{articles.length} stories</span>
          <span style={{ width: 1, height: 14, background: "#2e2e36" }} />
          <span>Latest: {lastUpdated}</span>
        </div>
      </div>

      <div className="cat-tabs" style={{ marginBottom: 24 }}>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`cat-tab${activeTab === category ? " active" : ""}`}
            onClick={() => setActiveTab(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      {loading && (
        <>
          <SkeletonHero />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        </>
      )}

      {!loading && error && <ErrorState error={error} onRetry={handleRetry} />}

      {!loading && !error && articles.length > 0 && (
        <>
          {currentPage === 0 && hero && <HeroArticle article={hero} navigate={navigate} />}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {paged.map((article, index) => (
              <ArticleCard
                key={article.id || `${article.url}-${index}`}
                article={article}
                navigate={navigate}
                delay={index * 35}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                paddingBottom: 32,
                flexWrap: "wrap",
              }}
            >
              <button
                className="np-page-button"
                onClick={() => changePage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                type="button"
              >
                ← Prev
              </button>

              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  className={`np-page-button${currentPage === index ? " active" : ""}`}
                  onClick={() => changePage(index)}
                  type="button"
                  aria-current={currentPage === index ? "page" : undefined}
                >
                  {index + 1}
                </button>
              ))}

              <button
                className="np-page-button"
                onClick={() => changePage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
                type="button"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && articles.length === 0 && <EmptyState activeTab={activeTab} onRetry={handleRetry} />}
    </div>
  );
}

export default NewsPage;
