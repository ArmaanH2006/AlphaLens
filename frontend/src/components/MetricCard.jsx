function MetricCard({ label, value }) {
  return (
    <div>
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

export default MetricCard;