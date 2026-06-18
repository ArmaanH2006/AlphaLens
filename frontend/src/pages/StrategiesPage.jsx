import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

const STRATEGY_INFO = {
  "Momentum": {
    icon: "📈",
    description: "Buy when MA-50 crosses above MA-200. Sell when it crosses below. Follows the trend.",
    color: "#4A9EE2",
  },
  "Mean Reversion": {
    icon: "🔄",
    description: "Buy when RSI drops below 30 (oversold). Sell when RSI rises above 70 (overbought).",
    color: "#E2A44A",
  },
  "Buy and Hold": {
    icon: "💎",
    description: "Hold the stock through all market conditions. Simple long-term baseline strategy.",
    color: "#1D9E75",
  },
};

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMD", "META", "AMZN"];

/* ── Signal badge ── */
function SignalBadge({ label }) {
  const colors = {
    BUY:  { bg: "rgba(29,158,117,0.15)",  color: "#1D9E75", border: "#0F6E56" },
    HOLD: { bg: "rgba(255,184,0,0.15)",    color: "#FFB800", border: "#A07800" },
    SELL: { bg: "rgba(226,75,74,0.15)",    color: "#E24B4A", border: "#A32D2D" },
  };
  const c = colors[label] ?? colors.HOLD;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 12px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {label}
    </span>
  );
}

/* ── Metric row ── */
function MetricRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e24" }}>
      <span style={{ fontSize: 12, color: "#666" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: color || "#e0e0e0" }}>{value}</span>
    </div>
  );
}

/* ── Sharpe bar ── */
function SharpeBar({ strategies, best }) {
  const maxSharpe = Math.max(...Object.values(strategies).map((s) => s.sharpe_ratio || 0));

  return (
    <div style={{
      background: "#141417",
      border: "1px solid #1e1e24",
      borderRadius: 10,
      padding: "20px",
      marginBottom: 24,
    }}>
      <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
        Sharpe Ratio Comparison
      </div>
      {Object.entries(strategies).map(([name, s]) => {
        const info  = STRATEGY_INFO[name] || {};
        const pct   = maxSharpe > 0 ? ((s.sharpe_ratio || 0) / maxSharpe) * 100 : 0;
        const isBest = name === best;
        return (
          <div key={name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: isBest ? "#fff" : "#aaa", fontWeight: isBest ? 600 : 400 }}>
                {isBest ? "★ " : ""}{name}
              </span>
              <span style={{ fontSize: 12, color: info.color || "#aaa", fontWeight: 600 }}>
                {s.sharpe_ratio ?? "N/A"}
              </span>
            </div>
            <div style={{ height: 6, background: "#1e1e24", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: info.color || "#555",
                borderRadius: 3,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StrategiesPage() {
  const navigate = useNavigate();

  const [input,      setInput]      = useState("");
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [searched,   setSearched]   = useState("");

  async function runAnalysis(ticker) {
    if (!ticker) return;
    const t = ticker.trim().toUpperCase();
    try {
      setLoading(true);
      setError("");
      setData(null);
      const res = await axios.get(`${API_BASE_URL}/strategies/${t}`);
      setData(res.data);
      setSearched(t);
    } catch (err) {
      console.error(err);
      setError(`Could not load strategies for ${t}. Check the ticker and try again.`);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) runAnalysis(input.trim());
  }

  const strategies = data?.strategies ?? {};
  const best       = data?.best_strategy ?? null;
  const bestData   = best ? strategies[best] : null;
  const bestInfo   = best ? STRATEGY_INFO[best] : null;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="panel-section-title" style={{ fontSize: 18, marginBottom: 4 }}>
          Strategy Analyzer
        </div>
        <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
          Compare Momentum, Mean Reversion, and Buy & Hold for any stock
        </p>
      </div>

      {/* ── Search ── */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(""); }}
          placeholder="Enter ticker, e.g. AAPL"
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
          }}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {/* ── Quick tickers ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {QUICK_TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => { setInput(t); runAnalysis(t); }}
            disabled={loading}
            style={{
              background: searched === t ? "rgba(29,158,117,0.15)" : "#1a1a1e",
              border: `1px solid ${searched === t ? "#0F6E56" : "#2e2e36"}`,
              borderRadius: 20,
              padding: "5px 14px",
              color: searched === t ? "#1D9E75" : "#aaa",
              fontSize: 12,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: searched === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <p style={{ fontSize: 14 }}>Running strategy analysis for {input.trim().toUpperCase()}…</p>
          <p style={{ fontSize: 12, color: "#444", marginTop: 4 }}>Fetching 5 years of data</p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && data && (
        <>
          {/* Best strategy highlight */}
          {best && bestData && bestInfo && (
            <div style={{
              background: `linear-gradient(135deg, ${bestInfo.color}18, #141417)`,
              border: `1px solid ${bestInfo.color}44`,
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Best Strategy for {searched}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: bestInfo.color, marginBottom: 4 }}>
                  {bestInfo.icon} {best}
                </div>
                <div style={{ fontSize: 13, color: "#888" }}>{bestInfo.description}</div>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Sharpe</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: bestInfo.color }}>{bestData.sharpe_ratio}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Return</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: parseFloat(bestData.total_return) >= 0 ? "#1D9E75" : "#E24B4A" }}>
                    {bestData.total_return}%
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Signal</div>
                  <SignalBadge label={bestData.signal} />
                </div>
              </div>
              <button
                onClick={() => navigate(`/stock/${searched}`)}
                style={{
                  background: bestInfo.color,
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Open {searched} →
              </button>
            </div>
          )}

          {/* Sharpe comparison bar */}
          <SharpeBar strategies={strategies} best={best} />

          {/* Strategy cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            {Object.entries(strategies).map(([name, s]) => {
              const info   = STRATEGY_INFO[name] || {};
              const isBest = name === best;
              return (
                <div
                  key={name}
                  style={{
                    background: "#141417",
                    border: `1px solid ${isBest ? info.color + "55" : "#1e1e24"}`,
                    borderRadius: 12,
                    padding: "20px",
                    position: "relative",
                  }}
                >
                  {isBest && (
                    <div style={{
                      position: "absolute", top: -10, left: 16,
                      background: info.color,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}>
                      Best
                    </div>
                  )}

                  {/* Card header */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{info.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: isBest ? info.color : "#fff", marginBottom: 6 }}>
                      {name}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                      {info.description}
                    </div>
                  </div>

                  {/* Metrics */}
                  <MetricRow label="Signal" value={<SignalBadge label={s.signal} />} />
                  <MetricRow
                    label="Total Return"
                    value={`${s.total_return}%`}
                    color={parseFloat(s.total_return) >= 0 ? "#1D9E75" : "#E24B4A"}
                  />
                  <MetricRow label="Sharpe Ratio" value={s.sharpe_ratio ?? "N/A"} color={info.color} />
                  <MetricRow
                    label="Max Drawdown"
                    value={`${s.max_drawdown}%`}
                    color="#E24B4A"
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Pre-search empty state ── */}
      {!loading && !data && !error && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
          <p style={{ fontSize: 15, marginBottom: 8, color: "#777" }}>Enter a ticker or pick one above</p>
          <p style={{ fontSize: 13 }}>Compares Momentum, Mean Reversion, and Buy & Hold over 5 years</p>
        </div>
      )}
    </div>
  );
}

export default StrategiesPage;