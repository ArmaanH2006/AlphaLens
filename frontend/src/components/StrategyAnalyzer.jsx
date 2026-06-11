import { useEffect, useState } from "react";
import { getStrategies } from "../services/api";
import SignalBadge from "./SignalBadge";

function StrategyAnalyzer({ ticker }) {
  const [strategyData, setStrategyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStrategies() {
      if (!ticker) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getStrategies(ticker);
        console.log("Strategies response:", data);

        setStrategyData(data);
      } catch (error) {
        console.error("Error loading strategies:", error);
        setError("Could not load strategy analysis.");
      } finally {
        setLoading(false);
      }
    }

    loadStrategies();
  }, [ticker]);

  if (loading) {
    return (
      <div>
        <h2>{ticker} Strategy Analyzer</h2>
        <p>Loading strategies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2>{ticker} Strategy Analyzer</h2>
        <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>
      </div>
    );
  }

  if (!strategyData) {
    return (
      <div>
        <h2>Strategy Analyzer</h2>
        <p>Search a stock to see strategy results.</p>
      </div>
    );
  }

  const strategies = Object.entries(strategyData.strategies);
  const bestStrategy = strategyData.best_strategy;

  return (
    <div>
      <h2>{ticker} Strategy Analyzer</h2>

      <p>
        <strong>Best Strategy:</strong>{" "}
        <span style={{ color: "green", fontWeight: "bold" }}>
          {bestStrategy}
        </span>
      </p>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <table>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Signal</th>
              <th>Return</th>
              <th>Sharpe</th>
              <th>Max Drawdown</th>
            </tr>
          </thead>

          <tbody>
            {strategies.map(([strategyName, strategy]) => {
              const isBest = strategyName === bestStrategy;

              return (
                <tr
                  key={strategyName}
                  style={{
                    backgroundColor: isBest ? "#143d2a" : "transparent",
                    fontWeight: isBest ? "bold" : "normal",
                  }}
                >
                  <td>{strategyName}</td>
                  <td>
                    <SignalBadge label={strategy.signal} />
                  </td>
                  <td>{strategy.total_return}%</td>
                  <td>{strategy.sharpe_ratio}</td>
                  <td>{strategy.max_drawdown}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StrategyAnalyzer;