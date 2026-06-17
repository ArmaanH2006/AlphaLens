import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

/* ── Preset watchlists ── */
const PRESETS = [
  { label: "Mag 7",      tickers: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"] },
  { label: "Semiconductors", tickers: ["NVDA", "AMD", "AVGO", "INTC", "QCOM", "MU", "TSM"] },
  { label: "Financials", tickers: ["JPM", "BAC", "GS", "MS", "V", "MA", "BRK-B"] },
  { label: "Healthcare", tickers: ["UNH", "LLY", "JNJ", "PFE", "ABBV", "MRK", "TMO"] },
  { label: "ETFs",       tickers: ["SPY", "QQQ", "IWM", "DIA", "XLK", "XLE", "XLF"] },
];

/* ── Sort helper ── */
function sortResults(results, key, dir) {
  return [...results].sort((a, b) => {
    const av = parseFloat(a[key]) ?? 0;
    const bv = parseFloat(b[key]) ?? 0;
    return dir === "asc" ? av - bv : bv - av;
  });
}

/* ── Signal badge ── */
function SignalBadge({ label }) {
  const up  = label === "BUY";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: up ? "rgba(29,158,117,0.15)" : "rgba(226,75,74,0.15)",
      color:      up ? "#1D9E75"               : "#E24B4A",
      border:     `1px solid ${up ? "#0F6E56" : "#A32D2D"}`,
    }}>
      {label}
    </span>
  );
}

/* ── Sort indicator ── */
function SortIcon({ active, dir }) {
  if (!active) return <span style={{ color: "#444", marginLeft: 4 }}>↕</span>;
  return <span style={{ color: "#1D9E75", marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

function ScreenerPage() {
  const navigate = useNavigate();

  const [input,    setInput]    = useState("");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [sortKey,  setSortKey]  = useState("sharpe");
  const [sortDir,  setSortDir]  = useState("desc");
  const [ran,      setRan]      = useState(false);

  /* ── Run screener ── */
  async function runScreener(tickerList) {
    if (!tickerList || tickerList.length === 0) return;
    try {
      setLoading(true);
      setError("");
      setResults([]);
      const joined = tickerList.join(",");
      const res = await axios.get(`${API_BASE_URL}/compare?tickers=${joined}`);
      setResults(res.data.results);
      setRan(true);
    } catch (err) {
      console.error(err);
      setError("Could not run screener. Check your tickers and try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Form submit ── */
  function handleSubmit(e) {
    e.preventDefault();
    const tickers = input
      .toUpperCase()
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 6);

    if (tickers.length === 0) {
      setError("Enter at least one valid ticker.");
      return;
    }
    if (tickers.length > 20) {
      setError("Max 20 tickers at a time.");
      return;
    }
    runScreener(tickers);
  }

  /* ── Preset click ── */
  function handlePreset(tickers) {
    setInput(tickers.join(", "));
    runScreener(tickers);
  }

  /* ── Column sort ── */
  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = sortResults(results, sortKey, sortDir);

  /* ── Column config ── */
  const COLS = [
    { key: "ticker",        label: "Ticker",       sortable: false },
    { key: "sharpe",        label: "Sharpe",       sortable: true  },
    { key: "annual_return", label: "Ann. Return",  sortable: true  },
    { key: "max_drawdown",  label: "Max Drawdown", sortable: true  },
    { key: "current_rsi",   label: "RSI",          sortable: true  },
    { key: "volatility",    label: "Volatility",   sortable: true  },
    { key: "signal",        label: "Signal",       sortable: false },
  ];

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Page title ── */}
      <div style={{ marginBottom: 20 }}>
        <div className="panel-section-title" style={{ fontSize: 18, marginBottom: 4 }}>
          Stock Screener
        </div>
        <p style={{ color: "#777", fontSize: 13, margin: 0 }}>
          Enter up to 20 tickers to compare Sharpe ratio, RSI, signal, and more.
        </p>
      </div>

      {/* ── Input form ── */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            placeholder="e.g. AAPL, NVDA, TSLA, MSFT"
            style={{
              flex: 1,
              background: "#1a1a1e",
              border: "1px solid #2e2e36",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#333" : "#1D9E75",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Analyzing…" : "Run Screener"}
          </button>
        </div>
      </form>

      {/* ── Preset buttons ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.tickers)}
            disabled={loading}
            style={{
              background: "#1a1a1e",
              border: "1px solid #2e2e36",
              borderRadius: 20,
              padding: "5px 14px",
              color: "#aaa",
              fontSize: 12,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#1D9E75";
              e.target.style.color = "#1D9E75";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "#2e2e36";
              e.target.style.color = "#aaa";
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 16 }}>{error}</p>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#777" }}>
          <p style={{ fontSize: 14 }}>Analyzing {input.split(/[\s,]+/).filter(Boolean).length} stocks…</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>This may take a few seconds</p>
        </div>
      )}

      {/* ── Results table ── */}
      {!loading && ran && results.length > 0 && (
        <div>
          <div style={{ color: "#555", fontSize: 12, marginBottom: 8 }}>
            {results.length} stocks analyzed — click a row to open stock page — click column header to sort
          </div>
          <div className="strategy-table-wrap">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  {COLS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      style={{
                        cursor: col.sortable ? "pointer" : "default",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.label}
                      {col.sortable && (
                        <SortIcon
                          active={sortKey === col.key}
                          dir={sortDir}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((stock, i) => (
                  <tr
                    key={stock.ticker}
                    onClick={() => navigate(`/stock/${stock.ticker}`)}
                    style={{ cursor: "pointer" }}
                    className={i === 0 && sortKey === "sharpe" ? "row-best" : ""}
                  >
                    <td>
                      <span className="port-sym">{stock.ticker}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{stock.sharpe}</td>
                    <td className={parseFloat(stock.annual_return) >= 0 ? "text-up" : "text-down"}>
                      {stock.annual_return}%
                    </td>
                    <td className="text-down">{stock.max_drawdown}%</td>
                    <td>{stock.current_rsi}</td>
                    <td>{stock.volatility}%</td>
                    <td><SignalBadge label={stock.signal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && ran && results.length === 0 && !error && (
        <p style={{ color: "#777", fontSize: 14, textAlign: "center", padding: "40px 0" }}>
          No results returned. Check your tickers and try again.
        </p>
      )}

      {/* ── Pre-run state ── */}
      {!loading && !ran && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 14 }}>Enter tickers above or pick a preset to start screening</p>
        </div>
      )}

    </div>
  );
}

export default ScreenerPage;