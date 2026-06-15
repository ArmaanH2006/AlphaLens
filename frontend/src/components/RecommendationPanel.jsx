function RecommendationPanel({ recommendation }) {
  if (!recommendation) {
    return (
      <div className="recommendation-panel">
        <div className="panel-section-title">Recommendation</div>
        <p className="rec-empty">Search a stock to see a recommendation.</p>
      </div>
    );
  }

  const isHold = recommendation.label === "HOLD";
  const isSell = recommendation.label === "SELL";
  const pillClass = isSell
    ? "signal-pill signal-sell"
    : isHold
    ? "signal-pill signal-hold"
    : "signal-pill signal-buy";

  return (
    <div className="recommendation-panel">
      <div className="panel-section-title">Recommendation</div>

      <div className="rec-header">
        <span className={pillClass}>{recommendation.label}</span>
        <span className="rec-score">Score: {recommendation.score}</span>
      </div>

      <p className="rec-reasoning">{recommendation.reasoning}</p>
    </div>
  );
}

export default RecommendationPanel;
