function MetricCard({ label, value }) {
  /* Color the signal value */
  const isSignal = label === "Signal";
  const isBuy    = value === "BUY";
  const isSell   = value === "SELL";
  const isHold   = value === "HOLD";

  let pillClass = "";
  if (isSignal) {
    if (isBuy)  pillClass = "signal-pill signal-buy";
    if (isSell) pillClass = "signal-pill signal-sell";
    if (isHold) pillClass = "signal-pill signal-hold";
  }

  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      {isSignal ? (
        <div style={{ marginTop: 6 }}>
          <span className={pillClass}>{value}</span>
        </div>
      ) : (
        <div className="metric-value">{value ?? "—"}</div>
      )}
    </div>
  );
}

export default MetricCard;