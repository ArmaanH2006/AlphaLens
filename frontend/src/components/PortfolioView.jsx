import { useEffect, useState } from "react";
import { getPortfolio } from "../services/api";
import SignalBadge from "./SignalBadge";

function PortfolioView() {
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    async function loadPortfolio() {
      try {
        const data = await getPortfolio("AAPL,NVDA,TSLA,MSFT,AMD");
        console.log("Portfolio response:", data);
        setPortfolio(data);
      } catch (error) {
        console.error("Error loading portfolio:", error);
      }
    }

    loadPortfolio();
  }, []);

  if (!portfolio) {
    return <p>Loading portfolio...</p>;
  }

  return (
    <div>
      <h2>Portfolio View</h2>

      <div style={{ display: "flex", justifyContent: "center" }}>
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
                <td>{stock.ticker}</td>
                <td>{stock.best_strategy}</td>
                <td>{stock.best_sharpe}</td>
                <td>{stock.best_total_return}</td>
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