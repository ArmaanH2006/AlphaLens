import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { getPrices } from "../services/api";

function StockChart({ ticker }) {
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState("1y");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const periods = [
    { label: "30d", value: "1mo" },
    { label: "3m", value: "3mo" },
    { label: "6m", value: "6mo" },
    { label: "All", value: "5y" },
  ];

  useEffect(() => {
    async function loadPrices() {
      if (!ticker) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getPrices(ticker, timeframe);
        console.log("Price response:", data);

        setChartData(data.prices || []);
      } catch (error) {
        console.error("Error loading prices:", error);
        setError("Could not load chart data.");
      } finally {
        setLoading(false);
      }
    }

    loadPrices();
  }, [ticker, timeframe]);

  return (
    <div>
      <h2>{ticker} Price Chart</h2>

      <div>
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => setTimeframe(period.value)}
            style={{
              fontWeight: timeframe === period.value ? "bold" : "normal",
            }}
          >
            {period.label}
          </button>
        ))}
      </div>

      <p>Selected timeframe: {timeframe}</p>

      {loading && <p>Loading chart...</p>}

      {error && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <div style={{ width: "100%", height: "300px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="close"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default StockChart;