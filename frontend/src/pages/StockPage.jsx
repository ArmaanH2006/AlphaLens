import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import MetricCard from "../components/MetricCard";
import StockChart from "../components/StockChart";
import RecommendationPanel from "../components/RecommendationPanel";
import StrategyAnalyzer from "../components/StrategyAnalyzer";
import StockSearch from "../components/StockSearch";
import PortfolioView from "../components/PortfolioView";
import { analyzeStock, recommendStock } from "../services/api";

function StockPage() {
  const { ticker } = useParams();

  const [stockData, setStockData] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!ticker) return;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await analyzeStock(ticker);
        setStockData(data);
        const rec = await recommendStock(ticker);
        setRecommendation(rec);
      } catch (err) {
        console.error(err);
        setError("Could not find that ticker. Please try another symbol.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticker]);

  if (loading) return <p className="loading-text">Loading {ticker}...</p>;
  if (error)   return <p className="error-text">{error}</p>;
  if (!stockData) return null;

  return (
    <div>
      <section className="dashboard-grid">
        <div className="left-panel">
          <div className="metric-grid">
            <MetricCard label="Ticker"       value={stockData.ticker} />
            <MetricCard label="Sharpe Ratio" value={stockData.sharpe} />
            <MetricCard label="RSI"          value={stockData.current_rsi} />
            <MetricCard label="Signal"       value={stockData.signal} />
          </div>
          <RecommendationPanel recommendation={recommendation} />
        </div>
        <div className="right-panel">
          <StockChart ticker={stockData.ticker} />
        </div>
      </section>

      <section className="bottom-grid">
        <StrategyAnalyzer ticker={stockData.ticker} />
        <PortfolioView />
      </section>
    </div>
  );
}

export default StockPage;
