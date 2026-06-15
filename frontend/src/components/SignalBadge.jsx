function SignalBadge({ label }) {
  const pillClass =
    label === "BUY"  ? "signal-pill signal-buy"  :
    label === "SELL" ? "signal-pill signal-sell" :
    label === "HOLD" ? "signal-pill signal-hold" :
                       "signal-pill signal-hold";

  return <span className={pillClass}>{label}</span>;
}

export default SignalBadge;