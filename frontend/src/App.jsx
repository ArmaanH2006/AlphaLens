import "./App.css";
import StockChart from "./components/StockChart";
import PortfolioView from "./components/PortfolioView";
import TrendingBar from "./components/TrendingBar";
import RecommendationPanel from "./components/RecommendationPanel";
import StrategyAnalyzer from "./components/StrategyAnalyzer";
import { useState } from "react";
import Navbar from "./components/Navbar";
import MetricCard from "./components/MetricCard";
import StockSearch from "./components/StockSearch";
import { analyzeStock, recommendStock } from "./services/api";

/* ── Market index data (replace with live API later) ── */
const INDICES = [
  { name: "S&P 500",  value: "5,847.32", change: "+0.72%", up: true,  width: "70%" },
  { name: "NASDAQ",   value: "18,943.10", change: "+1.14%", up: true,  width: "82%" },
  { name: "DOW",      value: "42,156.87", change: "-0.23%", up: false, width: "30%" },
  { name: "VIX",      value: "14.82",     change: "-3.10%", up: false, width: "20%" },
];

/* ── AI digest chips ── */
const AI_CHIPS = [
  { label: "Analyze NVDA ↗", prompt: "Analyze NVDA based on recent news and technicals" },
  { label: "Low VIX impact ↗", prompt: "What does low VIX mean for my portfolio?" },
  { label: "AAPL strategy ↗", prompt: "What is the best strategy for AAPL right now?" },
];

function App() {
  const [stockData, setStockData] = useState({
    ticker: "AAPL",
    sharpe: "2.10",
    current_rsi: "65.80",
    signal: "BUY",
  });

  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  async function handleSearch(ticker) {
    try {
      setLoading(true);
      setError("");

      const data = await analyzeStock(ticker);
      console.log("Analyze response:", data);
      setStockData(data);

      const recommendationData = await recommendStock(ticker);
      console.log("Recommendation response:", recommendationData);
      setRecommendation(recommendationData);
    } catch (err) {
      console.error("Error searching stock:", err);
      setError("Could not find that ticker. Please try another symbol.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">

      {/* ── STICKY HEADER: Navbar + ticker tape + indices + AI digest ── */}
      <div className="sticky-market-header">
        <Navbar onSearch={handleSearch} />
        <TrendingBar />

        {/* Market indices row */}
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

        {/* AI digest strip */}
        <div className="ai-digest">
          <div className="ai-digest-dot">
            <span style={{ fontSize: 13 }}>🤖</span>
          </div>
          <div>
            <div className="ai-digest-label">AlphaLens AI digest</div>
            <div className="ai-digest-text">
              Markets edging higher as rate-cut expectations firm. NVDA surging on
              strong datacenter demand — momentum score 98. Watch AAPL near resistance
              at $215. VIX at multi-month lows.
            </div>
            <div className="ai-chips">
              {AI_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  className="ai-chip"
                  onClick={() => handleSearch(chip.prompt)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="dashboard-shell">

        {/* Search + status */}
        <section className="hero-section">
          <StockSearch onSearch={handleSearch} />
          {loading && <p className="loading-text">Loading stock data...</p>}
          {error   && <p className="error-text">{error}</p>}
        </section>

        {/* Main 2-col grid */}
        <section className="dashboard-grid">

          {/* LEFT — metrics + recommendation */}
          <div className="left-panel">
            <div className="metric-grid">
              <MetricCard label="Ticker"       value={stockData.ticker} />
              <MetricCard label="Sharpe Ratio" value={stockData.sharpe} />
              <MetricCard label="RSI"          value={stockData.current_rsi} />
              <MetricCard label="Signal"       value={stockData.signal} />
            </div>
            <RecommendationPanel recommendation={recommendation} />
          </div>

          {/* RIGHT — chart */}
          <div className="right-panel">
            <StockChart ticker={stockData.ticker} />
          </div>

        </section>

        {/* Bottom 2-col grid */}
        <section className="bottom-grid">
          <StrategyAnalyzer ticker={stockData.ticker} />
          <PortfolioView />
        </section>

      </main>
    </div>
  );
}

export default App;
