import { useEffect, useState } from "react";
import { getPortfolio } from "../services/api";
import SignalBadge from "./SignalBadge";

function PortfolioView() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    async function loadPortfolio() {
      try {
        setLoading(true);
        const data = await getPortfolio("AAPL,NVDA,TSLA,MSFT,AMD");
        console.log("Portfolio response:", data);
        setPortfolio(data);
      } catch (err) {
        console.error("Error loading portfolio:", err);
        setError("Could not load portfolio.");
      } finally {
        setLoading(false);
      }
    }
    loadPortfolio();
  }, []);

  if (loading) {
    return (
      <div className="portfolio-panel">
        <div className="panel-section-title">Portfolio View</div>
        <p className="loading-text">Loading portfolio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-panel">
        <div className="panel-section-title">Portfolio View</div>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!portfolio) return null;

  return (
    <div className="portfolio-panel">
      {/* Header */}
      <div className="panel-section-title">
        <span className="live-dot" style={{ marginRight: 6 }} />
        Portfolio View
      </div>

      {/* Table */}
      <div className="strategy-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Best Strategy</th>
              <th>Sharpe</th>
              <th>Return</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.stocks.map((stock) => (
              <tr key={stock.ticker}>
                <td>
                  <span className="port-sym">{stock.ticker}</span>
                </td>
                <td className="text-muted">{stock.best_strategy}</td>
                <td>{stock.best_sharpe}</td>
                <td
                  className={
                    parseFloat(stock.best_total_return) >= 0
                      ? "text-up"
                      : "text-down"
                  }
                >
                  {stock.best_total_return}%
                </td>
                <td>
                  <SignalBadge label={stock.best_signal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PortfolioView;