import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPortfolio } from "../services/api";

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

/* ── Signal badge ── */
function SignalBadge({ label }) {
  const colors = {
    BUY:  { bg: "rgba(29,158,117,0.15)",  color: "#1D9E75", border: "#0F6E56"  },
    HOLD: { bg: "rgba(255,190,50,0.15)",   color: "#FFB800", border: "#A07800"  },
    SELL: { bg: "rgba(226,75,74,0.15)",    color: "#E24B4A", border: "#A32D2D"  },
  };
  const c = colors[label] ?? colors.HOLD;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {label}
    </span>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#141417",
      border: "1px solid #1e1e24",
      borderRadius: 10,
      padding: "16px 20px",
      minWidth: 160,
      flex: 1,
    }}>
      <div style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || "#fff" }}>
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

/* ── Strategy distribution bar ── */
function StrategyBar({ counts, total }) {
  const COLORS = {
    "Buy and Hold":   "#1D9E75",
    "Momentum":       "#4A9EE2",
    "Mean Reversion": "#E2A44A",
  };

  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 8 }}>
        {Object.entries(counts).map(([name, count]) => (
          <div
            key={name}
            style={{
              width: `${(count / total) * 100}%`,
              background: COLORS[name] || "#555",
              borderRadius: 4,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries(counts).map(([name, count]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#aaa" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[name] || "#555" }} />
            {name} ({count})
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioPage() {
  const navigate = useNavigate();

  const [tickers,   setTickers]   = useState(getTickers);
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [input,     setInput]     = useState("");
  const [addError,  setAddError]  = useState("");
  const [sortKey,   setSortKey]   = useState("best_sharpe");
  const [sortDir,   setSortDir]   = useState("desc");

  /* ── Fetch portfolio ── */
  useEffect(() => {
    if (tickers.length === 0) {
      setPortfolio(null);
      setLoading(false);
      return;
    }
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await getPortfolio(tickers.join(","));
        setPortfolio(data);
      } catch (err) {
        console.error(err);
        setError("Could not load portfolio.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tickers]);

  /* ── Add ticker ── */
  function handleAdd(e) {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (!t) return;
    if (t.length > 6) { setAddError("Ticker too long."); return; }
    if (tickers.includes(t)) { setAddError(`${t} already in portfolio.`); return; }
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

  /* ── Sort ── */
  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span style={{ color: "#333", marginLeft: 4 }}>↕</span>;
    return <span style={{ color: "#1D9E75", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const stocks = portfolio?.stocks ?? [];
  const metrics = portfolio?.portfolio_metrics ?? {};

  const sorted = [...stocks].sort((a, b) => {
    const av = parseFloat(a[sortKey === "best_sharpe" ? "best_sharpe_ratio" : sortKey]) || 0;
    const bv = parseFloat(b[sortKey === "best_sharpe" ? "best_sharpe_ratio" : sortKey]) || 0;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="panel-section-title" style={{ fontSize: 18, marginBottom: 4 }}>
            Portfolio
          </div>
          <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
            {tickers.length} stocks tracked — sorted by best strategy Sharpe
          </p>
        </div>

        {/* Add ticker */}
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setAddError(""); }}
            placeholder="Add ticker…"
            maxLength={6}
            style={{
              background: "#1a1a1e",
              border: "1px solid #2e2e36",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              width: 130,
            }}
          />
          <button
            type="submit"
            style={{
              background: "#1D9E75",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </form>
      </div>
      {addError && <p style={{ color: "#E24B4A", fontSize: 12, marginTop: -16, marginBottom: 12 }}>{addError}</p>}

      {/* ── Loading / Error ── */}
      {loading && <p className="loading-text">Loading portfolio…</p>}
      {error   && <p className="error-text">{error}</p>}

      {!loading && !error && portfolio && (
        <>
          {/* ── Portfolio metrics summary ── */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard
              label="Best Stock"
              value={metrics.best_overall_ticker}
              sub={metrics.best_overall_strategy}
              color="#1D9E75"
            />
            <StatCard
              label="Avg Sharpe"
              value={metrics.average_best_sharpe}
              sub="across all holdings"
            />
            <StatCard
              label="Avg Return"
              value={metrics.average_best_return != null ? `${metrics.average_best_return}%` : null}
              sub="best strategy per stock"
              color={metrics.average_best_return >= 0 ? "#1D9E75" : "#E24B4A"}
            />
            <StatCard
              label="Avg Drawdown"
              value={metrics.average_best_drawdown != null ? `${metrics.average_best_drawdown}%` : null}
              sub="max drawdown average"
              color="#E24B4A"
            />
            <StatCard
              label="Stocks"
              value={metrics.num_stocks}
              sub={metrics.num_errors > 0 ? `${metrics.num_errors} failed` : "all loaded"}
            />
          </div>

          {/* ── Strategy distribution ── */}
          {metrics.strategy_counts && metrics.num_stocks > 0 && (
            <div style={{
              background: "#141417",
              border: "1px solid #1e1e24",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 24,
            }}>
              <div style={{ color: "#777", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                Best Strategy Distribution
              </div>
              <StrategyBar counts={metrics.strategy_counts} total={metrics.num_stocks} />
            </div>
          )}

          {/* ── Stock table ── */}
          <div className="strategy-table-wrap">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th onClick={() => handleSort("best_strategy")} style={{ cursor: "pointer" }}>
                    Best Strategy <SortIcon col="best_strategy" />
                  </th>
                  <th onClick={() => handleSort("best_sharpe")} style={{ cursor: "pointer" }}>
                    Sharpe <SortIcon col="best_sharpe" />
                  </th>
                  <th onClick={() => handleSort("best_total_return")} style={{ cursor: "pointer" }}>
                    Return <SortIcon col="best_total_return" />
                  </th>
                  <th onClick={() => handleSort("best_max_drawdown")} style={{ cursor: "pointer" }}>
                    Max DD <SortIcon col="best_max_drawdown" />
                  </th>
                  <th>Signal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((stock, i) => (
                  <tr
                    key={stock.ticker}
                    onClick={() => navigate(`/stock/${stock.ticker}`)}
                    style={{ cursor: "pointer" }}
                    className={i === 0 ? "row-best" : ""}
                  >
                    <td><span className="port-sym">{stock.ticker}</span></td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{stock.best_strategy}</td>
                    <td style={{ fontWeight: 500 }}>{stock.best_sharpe_ratio ?? stock.best_sharpe}</td>
                    <td className={parseFloat(stock.best_total_return) >= 0 ? "text-up" : "text-down"}>
                      {stock.best_total_return}%
                    </td>
                    <td className="text-down">{stock.best_max_drawdown}%</td>
                    <td><SignalBadge label={stock.best_signal} /></td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(stock.ticker); }}
                        title={`Remove ${stock.ticker}`}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#444",
                          cursor: "pointer",
                          fontSize: 16,
                          padding: "0 4px",
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => (e.target.style.color = "#E24B4A")}
                        onMouseLeave={(e) => (e.target.style.color = "#444")}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Errors ── */}
          {portfolio.errors?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {portfolio.errors.map((e) => (
                <p key={e.ticker} style={{ color: "#E24B4A", fontSize: 12, margin: "4px 0" }}>
                  ⚠ {e.ticker}: {e.error}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!loading && tickers.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
          <p style={{ fontSize: 14 }}>No stocks in portfolio — add one above</p>
        </div>
      )}
    </div>
  );
}

export default PortfolioPage;