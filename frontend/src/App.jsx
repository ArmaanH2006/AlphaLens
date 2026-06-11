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

function App() {
  const [stockData, setStockData] = useState({
    ticker: "AAPL",
    sharpe: "2.10",
    current_rsi: "65.80",
    signal: "BUY",
  });

  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (error) {
      console.error("Error searching stock:", error);
      setError("Could not find that ticker. Please try another symbol.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Navbar />

      <TrendingBar />

      <h1>AlphaLens Dashboard</h1>

      <StockSearch onSearch={handleSearch} />

      {loading && <p>Loading stock data...</p>}

      {error && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          {error}
        </p>
      )}

      <div>
        <MetricCard label="Ticker" value={stockData.ticker} />
        <MetricCard label="Sharpe Ratio" value={stockData.sharpe} />
        <MetricCard label="RSI" value={stockData.current_rsi} />
        <MetricCard label="Signal" value={stockData.signal} />
      </div>

      <RecommendationPanel recommendation={recommendation} />

      <StockChart ticker={stockData.ticker} />

      <StrategyAnalyzer ticker={stockData.ticker} />

      <PortfolioView />
    </div>
  );
}

export default App;