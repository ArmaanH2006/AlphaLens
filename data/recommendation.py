import pandas as pd
from indicators import analyze_stock

# Recommendation engine uses output from indicators.analyze_stock.
# It converts Sharpe, RSI, and moving average trend into a 0-100 score,
# then chooses a BUY/HOLD/SELL label and a short reasoning string.

def _normalize_sharpe(sharpe):
    # Convert a raw Sharpe ratio into a 0-100 contribution.
    # Negative or missing Sharpe gives zero points.
    if sharpe is None or isinstance(sharpe, float) and pd.isna(sharpe):
        return 0.0
    if sharpe <= 0:
        return 0.0
    # 0.0 -> 0, 1.0 -> 35, 2.0 -> 70, 3.0+ -> 100
    return min(100.0, sharpe * 35.0)


def _normalize_rsi(rsi):
    # Convert a raw RSI into a score contribution.
    # RSI in the middle range is best. Too low or too high reduces score.
    if rsi is None or isinstance(rsi, float) and pd.isna(rsi):
        return 35.0
    if rsi < 30:
        return max(0.0, 35.0 - (30.0 - rsi) * 3.0)
    if 30 <= rsi < 40:
        return max(0.0, 25.0 - (40.0 - rsi) * 1.25)
    if 40 <= rsi <= 60:
        return 35.0
    if 60 < rsi <= 70:
        return max(0.0, 25.0 - (rsi - 60.0) * 1.25)
    return max(0.0, 35.0 - (rsi - 70.0) * 3.0)


def _signal_bonus(signal):
    # Add points based on the moving average trend signal.
    # BUY trend gets the biggest boost, SELL gives no bonus, and neutral is in the middle.
    if signal == "BUY":
        return 30.0
    if signal == "SELL":
        return 0.0
    return 15.0


def _score_from_metrics(metrics):
    # Build a total score from the three inputs.
    sharpe_score = _normalize_sharpe(metrics.get("sharpe"))
    rsi_score = _normalize_rsi(metrics.get("current_rsi"))
    signal_score = _signal_bonus(metrics.get("signal"))

    score = sharpe_score + rsi_score + signal_score
    # Keep the score inside the 0-100 range.
    return max(0.0, min(100.0, score))


def _label_from_score(score, signal, rsi):
    # Decide a simple label from score, trend, and overbought status.
    if score >= 70 and signal == "BUY":
        if rsi is not None and rsi > 70:
            # If RSI is overbought, be more cautious even when score is high.
            return "HOLD"
        return "BUY"
    if score >= 55 and signal == "BUY":
        return "HOLD"
    if score >= 65 and signal == "SELL":
        return "HOLD"
    return "SELL"


def recommend(ticker):
    # Generate a simple BUY/HOLD/SELL recommendation for a ticker.
    # The final decision is based on a normalized score and the current signal.
    try:
        metrics = analyze_stock(ticker)
        # Extract the core metrics once so we can safely reuse them.
        signal = metrics.get("signal")
        current_rsi = metrics.get("current_rsi")
        sharpe = metrics.get("sharpe")

        # Score calculation combines Sharpe, RSI, and moving average signal.
        score = _score_from_metrics(metrics)
        # Label logic uses the score plus trend and RSI context.
        label = _label_from_score(score, signal, current_rsi)

        reasoning = []
        # Start with the raw metric values so the output is easy to follow.
        reasoning.append(f"Sharpe ratio is {sharpe}.")
        reasoning.append(f"RSI is {current_rsi}.")
        reasoning.append(f"MA signal is {signal}.")

        # Add a short comment about RSI band placement.
        if current_rsi is not None:
            if current_rsi < 30:
                reasoning.append("RSI is oversold, which can support a stronger buy case.")
            elif current_rsi > 70:
                reasoning.append("RSI is overbought, which raises caution.")
            else:
                reasoning.append("RSI is in a neutral range.")

        # Add a comment about risk-adjusted performance based on Sharpe ratio.
        if sharpe is not None:
            if sharpe >= 1:
                reasoning.append("Risk-adjusted performance is healthy.")
            elif sharpe >= 0.5:
                reasoning.append("Risk-adjusted performance is modest.")
            else:
                reasoning.append("Risk-adjusted performance is weak.")

        # Add a comment describing the moving average trend signal.
        if signal == "BUY":
            reasoning.append("The short-term trend is above the long-term trend, supporting a bullish view.")
        elif signal == "SELL":
            reasoning.append("The short-term trend is below the long-term trend, which is bearish.")
        else:
            reasoning.append("Trend signal is not available.")

        return {
            "ticker": ticker,
            "score": round(score, 1),
            "label": label,
            "reasoning": " ".join(reasoning)
        }
    except Exception as e:
        # If anything goes wrong, return a safe error result instead of crashing.
        return {
            "ticker": ticker,
            "score": 0,
            "label": "ERROR",
            "reasoning": f"Could not analyze {ticker}: {str(e)}"
        }

#Test cases to validate the recommendation engine with various tickers, including edge cases and error handling.

if __name__ == "__main__":
    tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"]
    for t in tickers:
        rec = recommend(t)
        print(f"{t}: score={rec['score']} label={rec['label']} reason={rec['reasoning']}")


    # Test 1 - edge case tickers
    edge_cases = ["GME", "PLTR", "COIN", "SPY", "AMZN"]
    for t in edge_cases:
        rec = recommend(t)
        print(f"{t}: score={rec['score']} label={rec['label']}")

    # Test 2 - bad ticker
    rec = recommend("FAKESTOCKXYZ")
    print(rec)

    # Test 3 - scores always 0 to 100
    test_tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD", "GME", "SPY"]
    for t in test_tickers:
        rec = recommend(t)
        assert 0 <= rec['score'] <= 100, f"Score out of range for {t}"
        assert rec['label'] in ["BUY", "HOLD", "SELL", "ERROR"], f"Invalid label for {t}"
        print(f"{t} passed")
