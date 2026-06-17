import { useEffect, useState } from "react";
import { getPortfolio } from "../services/api";
import SignalBadge from "./SignalBadge";

const STORAGE_KEY = "alphalens_portfolio_tickers";
const DEFAULT_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"];

function getTickers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TICKERS;
}

function saveTickers(tickers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {}
}

function PortfolioView() {
  const [tickers,   setTickers]   = useState(getTickers);
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [input,     setInput]     = useState("");
  const [addError,  setAddError]  = useState("");

  /* ── Fetch whenever tickers change ── */
  useEffect(() => {
    if (tickers.length === 0) {
      setPortfolio(null);
      setLoading(false);
      return;
    }

    async function loadPortfolio() {
      try {
        setLoading(true);
        setError("");
        const data = await getPortfolio(tickers.join(","));
        setPortfolio(data);
      } catch (err) {
        console.error("Error loading portfolio:", err);
        setError("Could not load portfolio.");
      } finally {
        setLoading(false);
      }
    }

    loadPortfolio();
  }, [tickers]);

  /* ── Add ticker ── */
  function handleAdd(e) {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (!t) return;
    if (t.length > 5) {
      setAddError("Ticker too long.");
      return;
    }
    if (tickers.includes(t)) {
      setAddError(`${t} already in portfolio.`);
      return;
    }
    const updated = [...tickers, t];
    setTickers(updated);
    saveTickers(updated);
    setInput("");
    setAddError("");
  }

  /* ── Remove ticker ── */
  function handleRemove(ticker) {
    const updated = tickers.filter((t) => t !== ticker);
    setTickers(updated);
    saveTickers(updated);
  }

  return (
    <div className="portfolio-panel">

      {/* ── Header ── */}
      <div className="panel-section-title" style={{ marginBottom: 12 }}>
        <span className="live-dot" style={{ marginRight: 6 }} />
        Portfolio View
      </div>

      {/* ── Add ticker form ── */}
      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: 8, marginBottom: 4 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setAddError(""); }}
          placeholder="Add ticker, e.g. GOOG"
          maxLength={6}
          style={{
            flex: 1,
            background: "#1a1a1e",
            border: "1px solid #2e2e36",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#fff",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            background: "#1D9E75",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Add
        </button>
      </form>
      {addError && (
        <p style={{ color: "#E24B4A", fontSize: 12, margin: "4px 0 8px" }}>
          {addError}
        </p>
      )}

      {/* ── States ── */}
      {tickers.length === 0 ? (
        <p className="loading-text" style={{ marginTop: 16 }}>
          No tickers yet — add one above.
        </p>
      ) : loading ? (
        <p className="loading-text" style={{ marginTop: 16 }}>
          Loading portfolio…
        </p>
      ) : error ? (
        <p className="error-text" style={{ marginTop: 16 }}>{error}</p>
      ) : portfolio ? (
        <div className="strategy-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Best Strategy</th>
                <th>Sharpe</th>
                <th>Return</th>
                <th>Signal</th>
                <th></th>
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
                  <td>
                    <button
                      onClick={() => handleRemove(stock.ticker)}
                      title={`Remove ${stock.ticker}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#555",
                        cursor: "pointer",
                        fontSize: 15,
                        padding: "0 4px",
                        lineHeight: 1,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.target.style.color = "#E24B4A")}
                      onMouseLeave={(e) => (e.target.style.color = "#555")}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default PortfolioView;