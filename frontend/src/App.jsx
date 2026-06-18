import "./App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
 
import Navbar        from "./components/Navbar";
import TrendingBar   from "./components/TrendingBar";
import HomePage      from "./pages/HomePage";
import StockPage     from "./pages/StockPage";
import ScreenerPage   from "./pages/ScreenerPage";
import PortfolioPage  from "./pages/PortfolioPage";
import NewsPage       from "./pages/NewsPage";
import StrategiesPage from "./pages/StrategiesPage";
 
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;
 
const INDEX_MAP = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "NASDAQ"  },
  { symbol: "DIA", label: "DOW"     },
  { symbol: "VXX", label: "VIX"     },
];
 
/* ── Generate digest text from live indices ── */
function buildDigest(indices) {
  if (!indices || indices.every((i) => i.price === null)) return null;
 
  const spy = indices.find((i) => i.label === "S&P 500");
  const qqq = indices.find((i) => i.label === "NASDAQ");
  const vix = indices.find((i) => i.label === "VIX");
 
  const lines = [];
 
  const upCount = indices.filter((i) => i.up).length;
  if (upCount >= 3) lines.push("Markets broadly higher across major indices.");
  else if (upCount <= 1) lines.push("Markets under pressure — broad-based selling across indices.");
  else lines.push("Mixed session — indices diverging with no clear directional bias.");
 
  if (spy) {
    const sign = spy.pct >= 0 ? "+" : "";
    lines.push(
      `S&P 500 ${spy.up ? "gaining" : "down"} ${sign}${spy.pct.toFixed(2)}% at ${spy.price?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
    );
  }
 
  if (qqq) {
    const sign = qqq.pct >= 0 ? "+" : "";
    lines.push(
      `NASDAQ ${qqq.up ? "leading" : "lagging"} at ${sign}${qqq.pct.toFixed(2)}% — tech ${qqq.up ? "outperforming" : "under pressure"}.`
    );
  }
 
  if (vix) {
    if (vix.price < 15)      lines.push(`VIX at ${vix.price?.toFixed(2)} — volatility suppressed, risk-on tone.`);
    else if (vix.price < 20) lines.push(`VIX at ${vix.price?.toFixed(2)} — moderate volatility, market cautious.`);
    else if (vix.price < 30) lines.push(`VIX elevated at ${vix.price?.toFixed(2)} — hedging activity picking up.`);
    else                      lines.push(`VIX spiking at ${vix.price?.toFixed(2)} — fear gauge elevated, expect volatility.`);
  }
 
  return lines.join(" ");
}
 
/* ── Generate dynamic AI chips from indices ── */
function buildChips(indices) {
  if (!indices || indices.every((i) => i.price === null)) return [];
 
  const chips = [];
 
  const best = [...indices]
    .filter((i) => i.price !== null)
    .sort((a, b) => b.pct - a.pct)[0];
 
  const symbolMap = { "S&P 500": "SPY", NASDAQ: "QQQ", DOW: "DIA", VIX: "VXX" };
 
  if (best && best.pct > 0) {
    chips.push({
      label:  `Analyze ${symbolMap[best.label] || best.label} ↗`,
      ticker: symbolMap[best.label] || null,
    });
  }
 
  const vix = indices.find((i) => i.label === "VIX");
  if (vix?.price < 15) {
    chips.push({ label: "Low VIX impact ↗", ticker: null });
  } else if (vix?.price >= 20) {
    chips.push({ label: "High volatility play ↗", ticker: null });
  }
 
  chips.push({ label: "AAPL strategy ↗", ticker: "AAPL" });
 
  return chips.slice(0, 3);
}
 
/* ── Sparkline ── */
function Sparkline({ data, up }) {
  if (!data || data.length < 2) return <div style={{ width: 80, height: 28 }} />;
 
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || max * 0.01 || 1;
  const W = 80, H = 28, PAD = 3;
 
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: PAD + (H - PAD * 2) - ((v - min) / range) * (H - PAD * 2),
  }));
 
  const linePts = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPts = [
    `0,${H}`,
    ...coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${W},${H}`,
  ].join(" ");
 
  const stroke = up ? "#1D9E75" : "#E24B4A";
  const fill   = up ? "rgba(29,158,117,0.15)" : "rgba(226,75,74,0.15)";
 
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
         style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
      <polygon points={areaPts} fill={fill} />
      <polyline points={linePts} fill="none"
                stroke={stroke} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
 
function AppInner() {
  const navigate = useNavigate();
 
  const [indices,     setIndices]     = useState(
    INDEX_MAP.map(({ label }) => ({
      label, price: null, change: 0, pct: 0, up: true, sparkline: [],
    }))
  );
  const [digestText,  setDigestText]  = useState("Loading market summary…");
  const [digestChips, setDigestChips] = useState([]);
 
  useEffect(() => {
    async function loadIndices() {
      const now  = Math.floor(Date.now() / 1000);
      const from = now - 14 * 24 * 60 * 60;
 
      const results = await Promise.all(
        INDEX_MAP.map(async ({ symbol, label }) => {
          try {
            const [qRes, cRes] = await Promise.all([
              fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`),
              fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_KEY}`),
            ]);
            const q = await qRes.json();
            const c = await cRes.json();
 
            const close  = q.c ?? 0;
            const change = q.d ?? 0;
            const open   = close - change;
 
            return {
              label,
              price:  close,
              change,
              pct:    q.dp ?? 0,
              up:    (q.dp ?? 0) >= 0,
              sparkline: c.s === "ok" && c.c?.length >= 2
                ? c.c
                : close !== 0 ? [open, close] : [],
            };
          } catch {
            return { label, price: 0, change: 0, pct: 0, up: true, sparkline: [] };
          }
        })
      );
 
      setIndices(results);
      const text = buildDigest(results);
      if (text) setDigestText(text);
      setDigestChips(buildChips(results));
    }
 
    loadIndices();
    const id = setInterval(loadIndices, 60_000);
    return () => clearInterval(id);
  }, []);
 
  function handleSearch(ticker) {
    if (ticker) navigate(`/stock/${ticker.toUpperCase()}`);
  }
 
  return (
    <div className="app">
      <div className="sticky-market-header">
        <Navbar onSearch={handleSearch} />
        <TrendingBar />
 
        <div className="indices-bar">
          {indices.map((idx) => {
            const sign    = idx.change >= 0 ? "+" : "";
            const loading = idx.price === null;
            return (
              <div className="idx-card" key={idx.label}>
                <div className="idx-name">{idx.label}</div>
                <div className="idx-val">
                  {loading
                    ? "—"
                    : idx.price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                </div>
                <div className="idx-row">
                  <span className={`idx-chg ${idx.up ? "text-up" : "text-down"}`}>
                    {loading
                      ? "Loading…"
                      : `${sign}${idx.change.toFixed(2)} (${sign}${idx.pct.toFixed(2)}%)`}
                  </span>
                  <Sparkline data={idx.sparkline} up={idx.up} />
                </div>
              </div>
            );
          })}
        </div>
 
        <div className="ai-digest">
          <div className="ai-digest-dot">
            <span style={{ fontSize: 13 }}>🤖</span>
          </div>
          <div>
            <div className="ai-digest-label">AlphaLens AI digest</div>
            <div className="ai-digest-text">{digestText}</div>
            <div className="ai-chips">
              {digestChips.map((chip) => (
                <button
                  key={chip.label}
                  className="ai-chip"
                  onClick={() => chip.ticker && handleSearch(chip.ticker)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
 
      <main className="dashboard-shell">
        <Routes>
          <Route path="/"              element={<HomePage />} />
          <Route path="/stock/:ticker" element={<StockPage />} />
          <Route path="/screener"      element={<ScreenerPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/news" element={<NewsPage />} />
        </Routes>
      </main>
    </div>
  );
}
 
function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
 
export default App;
