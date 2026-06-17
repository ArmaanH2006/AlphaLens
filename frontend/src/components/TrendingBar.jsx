import { useEffect, useState } from "react";

const TICKERS = [
  "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL",
  "META", "TSLA", "AMD", "AVGO", "JPM",
  "SPY", "QQQ", "UNH", "LLY", "COST", "WMT"
];

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;

function TrendingBar() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      try {
        const results = await Promise.all(
          TICKERS.map(async (ticker) => {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`
            );
            const data = await res.json();
            return {
              ticker,
              change: data.d ?? 0,
              pct: data.dp ?? 0,
            };
          })
        );
        setQuotes(results);
      } catch (err) {
        console.error("Error loading quotes:", err);
      } finally {
        setLoading(false);
      }
    }

    loadQuotes();
    const interval = setInterval(loadQuotes, 60000);
    return () => clearInterval(interval);
  }, []);

  const items = quotes.length > 0 ? [...quotes, ...quotes] : [];

  return (
    <div className="ticker-tape">
      {loading && (
        <span className="ticker-item">
          <span className="ticker-symbol">Loading market data...</span>
        </span>
      )}

      {!loading && quotes.length > 0 && (
        <div className="ticker-scroll">
          {items.map((stock, i) => {
            const isUp = stock.change >= 0;
            const sign = isUp ? "+" : "";
            return (
              <span className="ticker-item" key={`${stock.ticker}-${i}`}>
                <span className="ticker-symbol">{stock.ticker}</span>
                <span className={isUp ? "ticker-up" : "ticker-down"}>
                  {sign}{stock.change.toFixed(2)} ({sign}{stock.pct.toFixed(2)}%)
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TrendingBar;