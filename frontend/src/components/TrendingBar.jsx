import { useEffect, useState } from "react";
import { getTrending } from "../services/api";

function TrendingBar() {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTrending() {
      try {
        setLoading(true);
        setError("");

        const data = await getTrending();
        console.log("Trending bar response:", data);

        setTrending(data.buy_signals || []);
      } catch (error) {
        console.error("Error loading trending bar:", error);
        setError("Could not load trending stocks.");
      } finally {
        setLoading(false);
      }
    }

    loadTrending();
  }, []);

  if (loading) {
    return <p>Loading trending stocks...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div>
      <h2>Trending BUY Signals</h2>

      <div
        style={{
          display: "flex",
          gap: "12px",
          overflowX: "auto",
          padding: "10px",
          border: "1px solid #ddd",
        }}
      >
        {trending.length === 0 ? (
          <p>No BUY signals found right now.</p>
        ) : (
          trending.map((stock) => (
            <div
              key={stock.ticker}
              style={{
                minWidth: "140px",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "8px",
              }}
            >
              <strong>{stock.ticker}</strong>
              <p>Score: {stock.score}</p>
              <p>{stock.label}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TrendingBar;