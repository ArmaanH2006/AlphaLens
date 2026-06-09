import { useState } from "react";

function StockSearch({ onSearch }) {
  const [ticker, setTicker] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!ticker.trim()) {
      return;
    }

    onSearch(ticker.trim().toUpperCase());
    setTicker("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter ticker..."
        value={ticker}
        onChange={(event) => setTicker(event.target.value)}
      />
      <button type="submit">Search</button>
    </form>
  );
}

export default StockSearch;