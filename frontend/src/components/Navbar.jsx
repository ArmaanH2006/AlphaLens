import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
 
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;
 
const NAV_LINKS = [
  { label: "Markets",    path: "/"            },
  { label: "News",       path: "/news"        },
  { label: "Screener",   path: "/screener"    },
  { label: "Portfolio",  path: "/portfolio"   },
  { label: "Strategies", path: "/strategies"  },
];
 
function Navbar({ onSearch }) {
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [showDrop,    setShowDrop]    = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [searching,   setSearching]   = useState(false);
 
  const location    = useLocation();
  const inputRef    = useRef(null);
  const dropRef     = useRef(null);
  const debounceRef = useRef(null);
 
  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    function handleClick(e) {
      if (
        dropRef.current  && !dropRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
 
  /* ── Debounced Finnhub symbol search ── */
  useEffect(() => {
    const q = query.trim();
 
    if (q.length < 1) {
      setResults([]);
      setShowDrop(false);
      return;
    }
 
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const res  = await fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`
        );
        const data = await res.json();
 
        // Filter to US stocks only, dedupe, limit to 7
        const filtered = (data.result || [])
          .filter((r) =>
            r.type === "Common Stock" &&
            r.symbol &&
            !r.symbol.includes(".") &&   // skip ADRs like AAPL.MX
            r.symbol.length <= 5
          )
          .slice(0, 7);
 
        setResults(filtered);
        setShowDrop(filtered.length > 0);
        setHighlighted(-1);
      } catch (err) {
        console.error("Symbol search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 250);
 
    return () => clearTimeout(debounceRef.current);
  }, [query]);
 
  /* ── Navigate to stock page ── */
  function selectResult(symbol) {
    onSearch?.(symbol.toUpperCase());
    setQuery("");
    setResults([]);
    setShowDrop(false);
    setHighlighted(-1);
    inputRef.current?.blur();
  }
 
  /* ── Keyboard navigation ── */
  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && results[highlighted]) {
        selectResult(results[highlighted].symbol);
      } else if (query.trim()) {
        selectResult(query.trim().toUpperCase());
      }
    } else if (e.key === "Escape") {
      setShowDrop(false);
      setHighlighted(-1);
    }
  }
 
  return (
    <nav>
      <Link to="/" className="logo-link">
        <h2>Alpha<span>Lens</span></h2>
      </Link>
 
      <div className="nav-links">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            to={link.path}
            className={`nav-link${location.pathname === link.path ? " active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
 
      {/* ── Search with dropdown ── */}
      <div className="nav-search" style={{ position: "relative" }}>
        <span className="nav-search-icon">
          {searching ? "⏳" : "🔍"}
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search ticker, e.g. AAPL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDrop(true)}
          autoComplete="off"
          spellCheck="false"
        />
 
        {/* ── Dropdown ── */}
        {showDrop && results.length > 0 && (
          <div
            ref={dropRef}
            style={{
              position:   "absolute",
              top:        "calc(100% + 6px)",
              right:      0,
              minWidth:   280,
              background: "#141417",
              border:     "1px solid #2e2e36",
              borderRadius: 10,
              boxShadow:  "0 8px 32px rgba(0,0,0,0.5)",
              zIndex:     1000,
              overflow:   "hidden",
            }}
          >
            {results.map((r, i) => (
              <div
                key={r.symbol}
                onMouseDown={() => selectResult(r.symbol)}
                onMouseEnter={() => setHighlighted(i)}
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        12,
                  padding:    "10px 14px",
                  cursor:     "pointer",
                  background: highlighted === i ? "#1e1e24" : "transparent",
                  borderBottom: i < results.length - 1 ? "1px solid #1e1e24" : "none",
                  transition: "background 0.1s",
                }}
              >
                {/* Symbol */}
                <span style={{
                  fontWeight:  600,
                  fontSize:    13,
                  color:       "#fff",
                  minWidth:    52,
                  fontFamily:  "monospace",
                }}>
                  {r.symbol}
                </span>
 
                {/* Company name */}
                <span style={{
                  fontSize:     12,
                  color:        "#777",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                  flex:         1,
                }}>
                  {r.description}
                </span>
 
                {/* Type pill */}
                <span style={{
                  fontSize:     10,
                  color:        "#1D9E75",
                  background:   "rgba(29,158,117,0.12)",
                  border:       "1px solid #0F6E56",
                  borderRadius: 20,
                  padding:      "1px 7px",
                  whiteSpace:   "nowrap",
                  flexShrink:   0,
                }}>
                  {r.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
 
export default Navbar;
 