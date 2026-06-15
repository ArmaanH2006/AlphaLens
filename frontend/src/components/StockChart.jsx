import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getPrices } from "../services/api";

const PERIODS = [
  { label: "30d", value: "1mo"  },
  { label: "3m",  value: "3mo"  },
  { label: "6m",  value: "6mo"  },
  { label: "All", value: "5y"   },
];

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{label}</div>
      <div className="chart-tooltip-price">
        ${Number(payload[0].value).toFixed(2)}
      </div>
    </div>
  );
}

function StockChart({ ticker }) {
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState("1y");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    async function loadPrices() {
      if (!ticker) return;
      try {
        setLoading(true);
        setError("");
        const data = await getPrices(ticker, timeframe);
        console.log("Price response:", data);
        setChartData(data.prices || []);
      } catch (err) {
        console.error("Error loading prices:", err);
        setError("Could not load chart data.");
      } finally {
        setLoading(false);
      }
    }
    loadPrices();
  }, [ticker, timeframe]);

  /* Work out price change for header */
  const firstPrice = chartData[0]?.close ?? null;
  const lastPrice  = chartData[chartData.length - 1]?.close ?? null;
  const priceChange = firstPrice && lastPrice
    ? (((lastPrice - firstPrice) / firstPrice) * 100).toFixed(2)
    : null;
  const isUp = priceChange !== null && parseFloat(priceChange) >= 0;

  return (
    <div className="chart-panel">

      {/* ── Header ── */}
      <div className="chart-header">
        <div>
          <div className="chart-title">{ticker} Price Chart</div>
          {lastPrice && (
            <div className="chart-price">
              <span className="chart-price-val">
                ${Number(lastPrice).toFixed(2)}
              </span>
              {priceChange && (
                <span className={`chart-price-chg ${isUp ? "text-up" : "text-down"}`}>
                  {isUp ? "▲" : "▼"} {Math.abs(priceChange)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className="chart-timeframes">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`tf-btn${timeframe === p.value ? " active" : ""}`}
              onClick={() => setTimeframe(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── States ── */}
      {loading && <p className="loading-text">Loading chart...</p>}
      {error   && <p className="error-text">{error}</p>}

      {/* ── Chart ── */}
      {!loading && !error && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e1e22"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#555" }}
                axisLine={false}
                tickLine={false}
                tickCount={6}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "#555" }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<ChartTooltip />} />
              {firstPrice && (
                <ReferenceLine
                  y={firstPrice}
                  stroke="#2a2a2e"
                  strokeDasharray="4 4"
                />
              )}
              <Line
                type="monotone"
                dataKey="close"
                stroke={isUp ? "#1D9E75" : "#E24B4A"}
                dot={false}
                strokeWidth={2}
                activeDot={{ r: 4, fill: isUp ? "#1D9E75" : "#E24B4A" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default StockChart;