import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const chartData = {
  "30d": [
    { date: "Day 1", price: 180 },
    { date: "Day 5", price: 184 },
    { date: "Day 10", price: 181 },
    { date: "Day 15", price: 188 },
    { date: "Day 20", price: 191 },
    { date: "Day 25", price: 187 },
    { date: "Day 30", price: 194 },
  ],
  "3m": [
    { date: "Month 1", price: 165 },
    { date: "Month 1.5", price: 172 },
    { date: "Month 2", price: 180 },
    { date: "Month 2.5", price: 176 },
    { date: "Month 3", price: 194 },
  ],
  "6m": [
    { date: "Jan", price: 150 },
    { date: "Feb", price: 158 },
    { date: "Mar", price: 170 },
    { date: "Apr", price: 165 },
    { date: "May", price: 185 },
    { date: "Jun", price: 194 },
  ],
  all: [
    { date: "2021", price: 120 },
    { date: "2022", price: 145 },
    { date: "2023", price: 160 },
    { date: "2024", price: 175 },
    { date: "2025", price: 194 },
  ],
};

function StockChart() {
  const [timeframe, setTimeframe] = useState("30d");

  return (
    <div>
      <h2>Stock Chart</h2>

      <div>
        <button onClick={() => setTimeframe("30d")}>30d</button>
        <button onClick={() => setTimeframe("3m")}>3m</button>
        <button onClick={() => setTimeframe("6m")}>6m</button>
        <button onClick={() => setTimeframe("all")}>All</button>
      </div>

      <p>Selected timeframe: {timeframe}</p>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <LineChart width={600} height={300} data={chartData[timeframe]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="price" />
        </LineChart>
      </div>
    </div>
  );
}

export default StockChart;