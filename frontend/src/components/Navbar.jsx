import { useState } from "react";

/* ── Nav links ── */
const NAV_LINKS = ["Markets", "News", "Screener", "Portfolio", "Strategies"];

function Navbar({ onSearch }) {
  const [active, setActive]   = useState("Markets");
  const [query,  setQuery]    = useState("");

  function handleKeyDown(e) {
    if (e.key === "Enter" && query.trim()) {
      onSearch?.(query.trim().toUpperCase());
    }
  }

  return (
    <nav>
      {/* Logo */}
      <h2>
        Alpha<span>Lens</span>
      </h2>

      {/* Nav links */}
      <div className="nav-links">
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            className={`nav-link${active === link ? " active" : ""}`}
            onClick={() => setActive(link)}
            href="#"
          >
            {link}
          </a>
        ))}
      </div>

      {/* Search */}
      <div className="nav-search">
        <span className="nav-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search ticker, e.g. AAPL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </nav>
  );
}

export default Navbar;

