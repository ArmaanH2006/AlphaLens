function RecommendationPanel({ recommendation }) {
  if (!recommendation) {
    return (
      <div>
        <h2>Recommendation</h2>
        <p>Search a stock to see a recommendation.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Recommendation</h2>

      <p>
        <strong>Score:</strong> {recommendation.score}
      </p>

      <p>
        <strong>Label:</strong> {recommendation.label}
      </p>

      <p>
        <strong>Reasoning:</strong> {recommendation.reasoning}
      </p>
    </div>
  );
}

export default RecommendationPanel;