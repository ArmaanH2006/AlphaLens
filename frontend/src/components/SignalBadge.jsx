function SignalBadge({ label }) {
  let color = "gray";

  if (label === "BUY") {
    color = "green";
  } else if (label === "HOLD") {
    color = "blue";
  } else if (label === "SELL") {
    color = "red";
  }

  return (
    <span style={{ color: color, fontWeight: "bold" }}>
      {label}
    </span>
  );
}

export default SignalBadge;