import { useState } from "react";

function StockSearch({ onSearch }) {
  const [ticker, setTicker] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!ticker.trim()) return;
    onSearch(ticker.trim().toUpperCase());
    setTicker("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      handleSubmit(event);
    }
  }

  return (
    <div className="stock-search-wrap">
      <div className="stock-search-inner">
        <span className="stock-search-icon">🔍</span>
        <input
          className="stock-search-input"
          type="text"
          placeholder="Search a ticker to analyze, e.g. AAPL, NVDA, TSLA..."
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        <button className="stock-search-btn" onClick={handleSubmit}>
          Analyze
        </button>
      </div>
    </div>
  );
}

export default StockSearch;
