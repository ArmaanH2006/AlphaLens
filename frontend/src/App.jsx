import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useState } from "react";
import Navbar from "./components/Navbar";
import TrendingBar from "./components/TrendingBar";
import HomePage from "./pages/HomePage";
import StockPage from "./pages/StockPage";

/* ── Static indices (replace with live API) ── */
const INDICES = [
  { name: "S&P 500",  value: "5,847.32",  change: "+0.72%", up: true,  width: "70%" },
  { name: "NASDAQ",   value: "18,943.10", change: "+1.14%", up: true,  width: "82%" },
  { name: "DOW",      value: "42,156.87", change: "-0.23%", up: false, width: "30%" },
  { name: "VIX",      value: "14.82",     change: "-3.10%", up: false, width: "20%" },
];

const AI_CHIPS = [
  { label: "Analyze NVDA ↗", ticker: "NVDA" },
  { label: "Low VIX impact ↗", ticker: null },
  { label: "AAPL strategy ↗",  ticker: "AAPL" },
];

/* ── Inner app — has access to router hooks ── */
function AppInner() {
  const navigate = useNavigate();

  function handleSearch(ticker) {
    if (ticker) navigate(`/stock/${ticker.toUpperCase()}`);
  }

  return (
    <div className="app">

      {/* ── STICKY HEADER ── */}
      <div className="sticky-market-header">
        <Navbar onSearch={handleSearch} />
        <TrendingBar />

        {/* Indices */}
        <div className="indices-bar">
          {INDICES.map((idx) => (
            <div className="idx-card" key={idx.name}>
              <div className="idx-name">{idx.name}</div>
              <div className="idx-val">{idx.value}</div>
              <div className="idx-row">
                <span className={`idx-chg ${idx.up ? "text-up" : "text-down"}`}>
                  {idx.change}
                </span>
                <div
                  className={`idx-bar ${idx.up ? "bar-up" : "bar-down"}`}
                  style={{ width: idx.width }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* AI digest */}
        <div className="ai-digest">
          <div className="ai-digest-dot">
            <span style={{ fontSize: 13 }}>🤖</span>
          </div>
          <div>
            <div className="ai-digest-label">AlphaLens AI digest</div>
            <div className="ai-digest-text">
              Markets edging higher as rate-cut expectations firm. NVDA surging on
              strong datacenter demand — momentum score 98. Watch AAPL near
              resistance at $215. VIX at multi-month lows.
            </div>
            <div className="ai-chips">
              {AI_CHIPS.map((chip) => (
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

      {/* ── ROUTES ── */}
      <main className="dashboard-shell">
        <Routes>
          <Route path="/"              element={<HomePage />} />
          <Route path="/stock/:ticker" element={<StockPage />} />
        </Routes>
      </main>

    </div>
  );
}

/* ── Root export wraps everything in BrowserRouter ── */
function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;

