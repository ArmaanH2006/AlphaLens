import Navbar from "./components/Navbar";
import MetricCard from "./components/MetricCard";

function App() {
  return (
    <div>
      <Navbar />

      <h1>AlphaLens Dashboard</h1>

      <div>
        <MetricCard label="Ticker" value="AAPL" />
        <MetricCard label="Sharpe Ratio" value="2.10" />
        <MetricCard label="RSI" value="65.80" />
        <MetricCard label="Signal" value="BUY" />
      </div>
    </div>
  );
}

export default App;
