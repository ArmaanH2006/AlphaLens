// import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";

// const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;

// const CATEGORIES = ["All", "General", "Crypto", "Forex", "Merger"];

// const FINNHUB_CATEGORIES = {
//   All:     "general",
//   General: "general",
//   Crypto:  "crypto",
//   Forex:   "forex",
//   Merger:  "merger",
// };

// const PAGE_SIZE = 12;

// // Visual identity per category — drives the placeholder art + accent
// // whenever an article has no usable image.
// const CATEGORY_STYLE = {
//   general: { accent: "#5B8DEF", gradient: "linear-gradient(135deg, #1a2332 0%, #0f1420 100%)", icon: "📰" },
//   crypto:  { accent: "#F2B84B", gradient: "linear-gradient(135deg, #2b2210 0%, #16130a 100%)", icon: "◈"  },
//   forex:   { accent: "#3FC1A6", gradient: "linear-gradient(135deg, #0f2620 0%, #0a1512 100%)", icon: "⇄"  },
//   merger:  { accent: "#B37FEB", gradient: "linear-gradient(135deg, #251a2e 0%, #140e19 100%)", icon: "⬡"  },
// };
// function categoryStyle(cat) {
//   return CATEGORY_STYLE[cat] || CATEGORY_STYLE.general;
// }

// /* ── Helpers ── */
// function timeAgo(unixSeconds) {
//   const diff = Math.floor(Date.now() / 1000 - unixSeconds);
//   if (diff < 60)    return `${diff}s ago`;
//   if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
//   if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
//   return `${Math.floor(diff / 86400)}d ago`;
// }

// // Finnhub's /news endpoint doesn't return a real sentiment score per article
// // (that only exists on their separate per-symbol sentiment endpoint), so we
// // derive sentiment ourselves from the headline + summary text.
// const POSITIVE_WORDS = [
//   "surge", "soar", "rally", "jump", "gain", "gains", "climb", "rebound",
//   "beat", "beats", "upgrade", "upgraded", "record high", "outperform",
//   "bullish", "strong", "strength", "growth", "profit", "profits", "rise",
//   "rises", "rising", "boost", "boosted", "recovery", "optimis", "upside",
//   "breakthrough", "expand", "expansion", "exceed", "exceeds", "rebounded",
// ];
// const NEGATIVE_WORDS = [
//   "plunge", "plummet", "crash", "slump", "slide", "drop", "drops", "dropped",
//   "fall", "falls", "falling", "tumble", "miss", "misses", "missed",
//   "downgrade", "downgraded", "weak", "weakness", "decline", "declines",
//   "loss", "losses", "bearish", "sell-off", "selloff", "recession", "layoff",
//   "layoffs", "warn", "warns", "warning", "fraud", "lawsuit", "probe",
//   "investigation", "concern", "concerns", "risk", "default", "bankruptcy",
//   "volatil", "cut rates", "rate cut fears",
// ];

// function analyzeSentiment(text) {
//   if (!text) return "neu";
//   const t = text.toLowerCase();

//   let score = 0;
//   for (const w of POSITIVE_WORDS) if (t.includes(w)) score++;
//   for (const w of NEGATIVE_WORDS) if (t.includes(w)) score--;

//   if (score > 0) return "up";
//   if (score < 0) return "dn";
//   return "neu";
// }

// function parseTickers(related) {
//   if (!related) return [];
//   return related
//     .split(",")
//     .map((t) => t.trim())
//     .filter((t) => t.length > 0 && t.length <= 5)
//     .slice(0, 3);
// }

// function mapArticle(a) {
//   return {
//     source:    a.source   || "News",
//     age:       timeAgo(a.datetime),
//     datetime:  a.datetime,
//     headline:  a.headline || "",
//     summary:   a.summary  || "",
//     category:  a.category || "general",
//     sentiment: analyzeSentiment(`${a.headline || ""} ${a.summary || ""}`),
//     tickers:   parseTickers(a.related),
//     url:       a.url || "#",
//     image:     a.image || null,
//   };
// }

// // Finnhub's news feed (forex especially) tends to include junk entries —
// // missing headlines, bad/zero timestamps, and the same story reposted
// // near-verbatim by multiple wire sources. Clean + dedupe + force a
// // consistent newest-first order.
// function cleanArticles(mapped) {
//   const seen = new Set();
//   return mapped
//     .filter((a) => a.headline && a.headline.trim().length > 8)
//     .filter((a) => a.datetime && a.datetime > 0)
//     .filter((a) => {
//       const key = a.headline
//         .trim()
//         .toLowerCase()
//         .replace(/[^a-z0-9]/g, "")
//         .slice(0, 50);
//       if (seen.has(key)) return false;
//       seen.add(key);
//       return true;
//     })
//     .sort((a, b) => b.datetime - a.datetime);
// }

// /* ── Sentiment badge ── */
// function SentimentBadge({ type }) {
//   const map = {
//     up:  { label: "Bullish", cls: "badge badge-up"  },
//     dn:  { label: "Bearish", cls: "badge badge-dn"  },
//     neu: { label: "Neutral", cls: "badge badge-neu" },
//   };
//   const { label, cls } = map[type] ?? map.neu;
//   return <span className={cls}>{label}</span>;
// }

// /* ── Image with graceful fallback to category art ── */
// function ArticleImage({ src, category, height }) {
//   const [failed, setFailed] = useState(false);
//   useEffect(() => { setFailed(false); }, [src]);

//   const style = categoryStyle(category);
//   const showImage = Boolean(src) && !failed;

//   return (
//     <div
//       className="np-img-wrap"
//       style={{
//         position: "relative",
//         height,
//         overflow: "hidden",
//         background: style.gradient,
//       }}
//     >
//       {showImage ? (
//         <img
//           src={src}
//           alt=""
//           loading="lazy"
//           onError={() => setFailed(true)}
//           className="np-img"
//           style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
//         />
//       ) : (
//         <div
//           style={{
//             width: "100%",
//             height: "100%",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             fontSize: height > 150 ? 42 : 24,
//             color: style.accent,
//             opacity: 0.6,
//           }}
//         >
//           {style.icon}
//         </div>
//       )}
//     </div>
//   );
// }

// /* ── Large hero article ── */
// function HeroArticle({ article, navigate }) {
//   const isBreaking = Date.now() / 1000 - article.datetime < 3600;

//   return (
//     <a
//       href={article.url}
//       target="_blank"
//       rel="noreferrer"
//       style={{ textDecoration: "none", color: "inherit", display: "block" }}
//     >
//       <div
//         className="np-card np-hero np-fade"
//         style={{
//           background: "#141417",
//           border: "1px solid #1e1e24",
//           borderRadius: 14,
//           overflow: "hidden",
//           marginBottom: 24,
//           cursor: "pointer",
//         }}
//       >
//         <div style={{ position: "relative" }}>
//           <ArticleImage src={article.image} category={article.category} height={300} />

//           {/* Bottom gradient so overlaid text stays legible over any photo */}
//           <div
//             style={{
//               position: "absolute",
//               inset: 0,
//               background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(10,10,12,0.55) 70%, rgba(10,10,12,0.92) 100%)",
//               pointerEvents: "none",
//             }}
//           />

//           <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8 }}>
//             {isBreaking && (
//               <span
//                 style={{
//                   background: "#E24B4A",
//                   color: "#fff",
//                   fontSize: 10,
//                   fontWeight: 700,
//                   padding: "4px 9px",
//                   borderRadius: 5,
//                   textTransform: "uppercase",
//                   letterSpacing: 1,
//                 }}
//               >
//                 Breaking
//               </span>
//             )}
//           </div>
//           <div style={{ position: "absolute", top: 14, right: 14 }}>
//             <SentimentBadge type={article.sentiment} />
//           </div>

//           {/* Headline overlaid on the image, editorial-style */}
//           <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 24px 18px" }}>
//             <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginBottom: 8, fontWeight: 500 }}>
//               {article.source} · {article.age}
//             </div>
//             <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
//               {article.headline}
//             </div>
//           </div>
//         </div>

//         {/* Body */}
//         <div style={{ padding: "18px 24px 22px" }}>
//           <div style={{ fontSize: 13.5, color: "#8a8a92", lineHeight: 1.65, marginBottom: article.tickers.length ? 14 : 0 }}>
//             {article.summary}
//           </div>
//           {article.tickers.length > 0 && (
//             <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
//               {article.tickers.map((t) => (
//                 <span
//                   key={t}
//                   className="ticker-tag"
//                   onClick={(e) => { e.preventDefault(); navigate(`/stock/${t}`); }}
//                   style={{ cursor: "pointer" }}
//                 >
//                   {t}
//                 </span>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </a>
//   );
// }

// /* ── Regular article card ── */
// function ArticleCard({ article, navigate, delay }) {
//   return (
//     <a
//       href={article.url}
//       target="_blank"
//       rel="noreferrer"
//       style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
//     >
//       <div
//         className="np-card np-fade"
//         style={{
//           background: "#141417",
//           border: "1px solid #1e1e24",
//           borderRadius: 10,
//           overflow: "hidden",
//           cursor: "pointer",
//           height: "100%",
//           boxSizing: "border-box",
//           display: "flex",
//           flexDirection: "column",
//           animationDelay: `${delay}ms`,
//         }}
//       >
//         <ArticleImage src={article.image} category={article.category} height={140} />

//         <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
//           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
//             <span style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5 }}>
//               {article.category}
//             </span>
//             <SentimentBadge type={article.sentiment} />
//           </div>
//           <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, marginBottom: 8, color: "#e0e0e0" }}>
//             {article.headline}
//           </div>
//           <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginBottom: 12 }}>
//             {article.summary?.slice(0, 120)}{article.summary?.length > 120 ? "…" : ""}
//           </div>
//           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
//             <span style={{ fontSize: 11, color: "#555" }}>{article.source} · {article.age}</span>
//             <div style={{ display: "flex", gap: 4 }}>
//               {article.tickers.map((t) => (
//                 <span
//                   key={t}
//                   className="ticker-tag"
//                   style={{ fontSize: 10, cursor: "pointer" }}
//                   onClick={(e) => { e.preventDefault(); navigate(`/stock/${t}`); }}
//                 >
//                   {t}
//                 </span>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </a>
//   );
// }

// /* ── Skeleton placeholders shown while a category is loading ── */
// function SkeletonBlock({ style }) {
//   return (
//     <div
//       className="np-shimmer"
//       style={{ background: "#1c1c22", borderRadius: 4, ...style }}
//     />
//   );
// }

// function SkeletonHero() {
//   return (
//     <div style={{ background: "#141417", border: "1px solid #1e1e24", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
//       <SkeletonBlock style={{ height: 300, borderRadius: 0 }} />
//       <div style={{ padding: "18px 24px 22px" }}>
//         <SkeletonBlock style={{ height: 12, width: "90%", marginBottom: 8 }} />
//         <SkeletonBlock style={{ height: 12, width: "60%" }} />
//       </div>
//     </div>
//   );
// }

// function SkeletonCard() {
//   return (
//     <div style={{ background: "#141417", border: "1px solid #1e1e24", borderRadius: 10, overflow: "hidden" }}>
//       <SkeletonBlock style={{ height: 140, borderRadius: 0 }} />
//       <div style={{ padding: "14px 16px 16px" }}>
//         <SkeletonBlock style={{ height: 9, width: "35%", marginBottom: 10 }} />
//         <SkeletonBlock style={{ height: 13, width: "95%", marginBottom: 8 }} />
//         <SkeletonBlock style={{ height: 13, width: "75%", marginBottom: 12 }} />
//         <SkeletonBlock style={{ height: 9, width: "45%" }} />
//       </div>
//     </div>
//   );
// }

// function NewsPage() {
//   const navigate = useNavigate();

//   const [activeTab,     setActiveTab]     = useState("All");
//   const [allArticles,   setAllArticles]   = useState({});  // keyed by category
//   const [loading,       setLoading]       = useState(true);
//   const [error,         setError]         = useState("");
//   const [page,          setPage]          = useState(0);
//   const [retryToken,    setRetryToken]    = useState(0);

//   /* ── Fetch news for active category ── */
//   useEffect(() => {
//     const cat = FINNHUB_CATEGORIES[activeTab];

//     // Use cache if already fetched
//     if (allArticles[activeTab]) {
//       setLoading(false);
//       return;
//     }

//     async function fetchNews() {
//       try {
//         setLoading(true);
//         setError("");
//         const res  = await fetch(
//           `https://finnhub.io/api/v1/news?category=${cat}&token=${FINNHUB_KEY}`
//         );
//         const data = await res.json();
//         if (!Array.isArray(data)) throw new Error("Invalid response");

//         const mapped = cleanArticles(data.map(mapArticle));
//         setAllArticles((prev) => ({ ...prev, [activeTab]: mapped }));
//       } catch (err) {
//         console.error("News fetch failed:", err);
//         setError("Could not load news. Try again.");
//       } finally {
//         setLoading(false);
//       }
//     }

//     fetchNews();
//     setPage(0);
//   }, [activeTab, retryToken]);

//   function handleRetry() {
//     setAllArticles((prev) => {
//       const next = { ...prev };
//       delete next[activeTab];
//       return next;
//     });
//     setRetryToken((t) => t + 1);
//   }

//   const articles   = allArticles[activeTab] || [];
//   const hero       = articles[0] || null;
//   const rest       = articles.slice(1);
//   const totalPages = Math.ceil(rest.length / PAGE_SIZE);
//   const paged      = rest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

//   return (
//     <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
//       {/* Local styles for hover / motion — scoped by class name, doesn't touch global CSS */}
//       <style>{`
//         .np-card { transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
//         .np-card:hover { border-color: #2e2e44; transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
//         .np-img { transition: transform .5s ease; }
//         .np-card:hover .np-img { transform: scale(1.06); }
//         .np-fade { animation: npFadeIn .4s ease both; }
//         @keyframes npFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
//         .np-shimmer {
//           background: linear-gradient(90deg, #1c1c22 0%, #26262e 50%, #1c1c22 100%);
//           background-size: 600px 100%;
//           animation: npShimmer 1.5s infinite linear;
//         }
//         @keyframes npShimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
//       `}</style>

//       {/* ── Header ── */}
//       <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
//         <div>
//           <div className="panel-section-title" style={{ fontSize: 18, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
//             News
//             <span
//               style={{
//                 width: 6, height: 6, borderRadius: "50%",
//                 background: "#1D9E75", display: "inline-block",
//                 boxShadow: "0 0 0 3px rgba(29,158,117,0.2)",
//               }}
//             />
//           </div>
//           <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
//             Live market news — powered by Finnhub
//           </p>
//         </div>
//       </div>

//       {/* ── Category tabs ── */}
//       <div className="cat-tabs" style={{ marginBottom: 24 }}>
//         {CATEGORIES.map((cat) => (
//           <div
//             key={cat}
//             className={`cat-tab${activeTab === cat ? " active" : ""}`}
//             onClick={() => { setActiveTab(cat); setPage(0); }}
//           >
//             {cat}
//           </div>
//         ))}
//       </div>

//       {/* ── Loading (skeletons) ── */}
//       {loading && (
//         <>
//           <SkeletonHero />
//           <div style={{
//             display: "grid",
//             gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
//             gap: 16,
//           }}>
//             {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
//           </div>
//         </>
//       )}

//       {/* ── Error ── */}
//       {!loading && error && (
//         <div style={{ textAlign: "center", padding: "60px 0" }}>
//           <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
//           <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 16 }}>{error}</p>
//           <button
//             onClick={handleRetry}
//             style={{
//               background: "#1D9E75",
//               border: "none",
//               borderRadius: 8,
//               padding: "8px 20px",
//               color: "#fff",
//               fontSize: 13,
//               fontWeight: 500,
//               cursor: "pointer",
//             }}
//           >
//             Retry
//           </button>
//         </div>
//       )}

//       {/* ── Content ── */}
//       {!loading && !error && articles.length > 0 && (
//         <>
//           {/* Hero — only on page 0 */}
//           {page === 0 && hero && (
//             <HeroArticle article={hero} navigate={navigate} />
//           )}

//           {/* Article grid */}
//           <div style={{
//             display: "grid",
//             gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
//             gap: 16,
//             marginBottom: 24,
//           }}>
//             {paged.map((article, i) => (
//               <ArticleCard key={article.url + i} article={article} navigate={navigate} delay={i * 35} />
//             ))}
//           </div>

//           {/* ── Pagination ── */}
//           {totalPages > 1 && (
//             <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 32 }}>
//               <button
//                 onClick={() => { setPage((p) => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
//                 disabled={page === 0}
//                 style={{
//                   background: page === 0 ? "#1a1a1e" : "#1D9E75",
//                   border: "1px solid #2e2e36",
//                   borderRadius: 8,
//                   padding: "8px 18px",
//                   color: page === 0 ? "#444" : "#fff",
//                   fontSize: 13,
//                   cursor: page === 0 ? "not-allowed" : "pointer",
//                   fontWeight: 500,
//                   transition: "opacity .15s ease",
//                 }}
//               >
//                 ← Prev
//               </button>

//               <div style={{ display: "flex", gap: 4 }}>
//                 {Array.from({ length: totalPages }).map((_, i) => (
//                   <button
//                     key={i}
//                     onClick={() => { setPage(i); window.scrollTo(0, 0); }}
//                     style={{
//                       width: 32, height: 32,
//                       borderRadius: 6,
//                       border: "1px solid #2e2e36",
//                       background: page === i ? "#1D9E75" : "#1a1a1e",
//                       color: page === i ? "#fff" : "#666",
//                       fontSize: 13,
//                       cursor: "pointer",
//                       fontWeight: page === i ? 600 : 400,
//                       transition: "background .15s ease, color .15s ease",
//                     }}
//                   >
//                     {i + 1}
//                   </button>
//                 ))}
//               </div>

//               <button
//                 onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0); }}
//                 disabled={page === totalPages - 1}
//                 style={{
//                   background: page === totalPages - 1 ? "#1a1a1e" : "#1D9E75",
//                   border: "1px solid #2e2e36",
//                   borderRadius: 8,
//                   padding: "8px 18px",
//                   color: page === totalPages - 1 ? "#444" : "#fff",
//                   fontSize: 13,
//                   cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
//                   fontWeight: 500,
//                   transition: "opacity .15s ease",
//                 }}
//               >
//                 Next →
//               </button>
//             </div>
//           )}
//         </>
//       )}

//       {/* ── Empty ── */}
//       {!loading && !error && articles.length === 0 && (
//         <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
//           <div style={{ fontSize: 32, marginBottom: 12 }}>📰</div>
//           <p style={{ fontSize: 14 }}>No articles found for this category</p>
//         </div>
//       )}
//     </div>
//   );
// }

// export default NewsPage;


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
    accent: "#5B8DEF",
    gradient: "linear-gradient(135deg, #1a2332 0%, #0f1420 100%)",
    icon: "📰",
    label: "General",
  },
  crypto: {
    accent: "#F2B84B",
    gradient: "linear-gradient(135deg, #2b2210 0%, #16130a 100%)",
    icon: "◈",
    label: "Crypto",
  },
  forex: {
    accent: "#3FC1A6",
    gradient: "linear-gradient(135deg, #0f2620 0%, #0a1512 100%)",
    icon: "⇄",
    label: "Forex",
  },
  merger: {
    accent: "#B37FEB",
    gradient: "linear-gradient(135deg, #251a2e 0%, #140e19 100%)",
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
  const style = categoryStyle(category);

  return (
    <span
      style={{
        color: style.accent,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.7,
        textTransform: "uppercase",
      }}
    >
      {style.label}
    </span>
  );
}

function ArticleImage({ src, category, height }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

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
            color: style.accent,
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
      <div style={{ fontSize: 36, marginBottom: 12, color: style.accent }}>{style.icon}</div>

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

        .badge {
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          padding: 4px 8px;
          white-space: nowrap;
        }

        .badge-up {
          color: #61d394;
          background: rgba(97,211,148,.12);
          border: 1px solid rgba(97,211,148,.22);
        }

        .badge-dn {
          color: #ff7474;
          background: rgba(255,116,116,.12);
          border: 1px solid rgba(255,116,116,.22);
        }

        .badge-neu {
          color: #a7a7b2;
          background: rgba(167,167,178,.1);
          border: 1px solid rgba(167,167,178,.16);
        }

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