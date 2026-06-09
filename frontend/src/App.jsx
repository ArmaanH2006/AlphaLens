import StockChart from "./components/StockChart";
import PortfolioView from "./components/PortfolioView";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import MetricCard from "./components/MetricCard";
import StockSearch from "./components/StockSearch";
import { analyzeStock, getTrending } from "./services/api";

function App() {
  const [stockData, setStockData] = useState({
    ticker: "AAPL",
    sharpe: "2.10",
    current_rsi: "65.80",
    signal: "BUY",
  });

  async function handleSearch(ticker) {
    try {
      const data = await analyzeStock(ticker);
      console.log("Analyze response:", data);
      setStockData(data);
    } catch (error) {
      console.error("Error analyzing stock:", error);
    }
  }

  useEffect(() => {
    async function loadTrending() {
      try {
        const data = await getTrending();
        console.log("Trending response:", data);
      } catch (error) {
        console.error("Error loading trending:", error);
      }
    }

    loadTrending();
  }, []);

  return (
    <div>
      <Navbar />

      <h1>AlphaLens Dashboard</h1>

      <StockSearch onSearch={handleSearch} />

      <div>
        <MetricCard label="Ticker" value={stockData.ticker} />
        <MetricCard label="Sharpe Ratio" value={stockData.sharpe} />
        <MetricCard label="RSI" value={stockData.current_rsi} />
        <MetricCard label="Signal" value={stockData.signal} />
      </div>

      <StockChart />

      <PortfolioView />
    </div>
  );
}

export default App;