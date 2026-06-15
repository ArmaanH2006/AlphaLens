import { useEffect, useState } from "react";
import { getTrending } from "../services/api";

function TrendingBar() {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    async function loadTrending() {
      try {
        setLoading(true);
        setError("");
        const data = await getTrending();
        console.log("Trending bar response:", data);
        setTrending(data.buy_signals || []);
      } catch (err) {
        console.error("Error loading trending bar:", err);
        setError("Could not load trending stocks.");
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  /* ── Duplicate items so the scroll loops seamlessly ── */
  const items = trending.length > 0 ? [...trending, ...trending] : [];

  return (
    <div className="ticker-tape">
      {loading && (
        <span className="ticker-item">
          <span className="ticker-symbol">Loading signals...</span>
        </span>
      )}

      {error && (
        <span className="ticker-item">
          <span className="ticker-symbol" style={{ color: "#E24B4A" }}>
            {error}
          </span>
        </span>
      )}

      {!loading && !error && trending.length === 0 && (
        <span className="ticker-item">
          <span className="ticker-symbol">No BUY signals right now</span>
        </span>
      )}

      {!loading && !error && trending.length > 0 && (
        <div className="ticker-scroll">
          {items.map((stock, i) => (
            <span className="ticker-item" key={`${stock.ticker}-${i}`}>
              <span className="ticker-symbol">{stock.ticker}</span>
              <span className="ticker-up">
                {stock.label ?? "BUY"} · {stock.score}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrendingBar;