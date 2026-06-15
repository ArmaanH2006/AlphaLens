import { useEffect, useState } from "react";
import { getStrategies } from "../services/api";
import SignalBadge from "./SignalBadge";

function StrategyAnalyzer({ ticker }) {
  const [strategyData, setStrategyData] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    async function loadStrategies() {
      if (!ticker) return;
      try {
        setLoading(true);
        setError("");
        const data = await getStrategies(ticker);
        console.log("Strategies response:", data);
        setStrategyData(data);
      } catch (err) {
        console.error("Error loading strategies:", err);
        setError("Could not load strategy analysis.");
      } finally {
        setLoading(false);
      }
    }
    loadStrategies();
  }, [ticker]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="left-panel">
        <div className="panel-section-title">{ticker} Strategy Analyzer</div>
        <p className="loading-text">Loading strategies...</p>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="left-panel">
        <div className="panel-section-title">{ticker} Strategy Analyzer</div>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  /* ── Empty ── */
  if (!strategyData) {
    return (
      <div className="left-panel">
        <div className="panel-section-title">Strategy Analyzer</div>
        <p className="loading-text">Search a stock to see strategy results.</p>
      </div>
    );
  }

  const strategies   = Object.entries(strategyData.strategies);
  const bestStrategy = strategyData.best_strategy;

  return (
    <div className="strategy-panel">
      {/* Header */}
      <div className="strategy-header">
        <div className="panel-section-title">{ticker} Strategy Analyzer</div>
        <div className="strategy-best-label">
          Best:&nbsp;
          <span className="strategy-best-name">{bestStrategy}</span>
        </div>
      </div>

      {/* Table */}
      <div className="strategy-table-wrap">
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
            {strategies.map(([name, s]) => {
              const isBest = name === bestStrategy;
              return (
                <tr key={name} className={isBest ? "row-best" : ""}>
                  <td style={{ fontWeight: isBest ? 500 : 400 }}>{name}</td>
                  <td><SignalBadge label={s.signal} /></td>
                  <td className={parseFloat(s.total_return) >= 0 ? "text-up" : "text-down"}>
                    {s.total_return}%
                  </td>
                  <td>{s.sharpe_ratio}</td>
                  <td className="text-down">{s.max_drawdown}%</td>
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
