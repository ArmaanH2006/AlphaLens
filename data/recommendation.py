import pandas as pd
from indicators import analyze_stock


# Recommendation engine uses output from indicators.analyze_stock.
# It converts Sharpe, RSI, and moving average trend into a 0-100 score,
# then chooses a BUY/HOLD/SELL label and a short reasoning string.


def _to_float(value, default=None):
    """Safely convert a value to float, handling None, NaN, pd.NA, and bad strings."""
    if value is None:
        return default

    try:
        if pd.isna(value):
            return default
    except (TypeError, ValueError):
        pass

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fmt(value):
    """Format numbers nicely for reasoning text."""
    if value is None:
        return "not available"
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _normalize_signal(signal):
    """Normalize signal values like buy, BUY, Sell, etc."""
    if signal is None:
        return None
    return str(signal).strip().upper()


def _normalize_sharpe(sharpe):
    """
    Convert a raw Sharpe ratio into a 0-35 contribution.

    Negative or missing Sharpe gives zero points.
    0.0 -> 0
    1.0 -> about 11.7
    2.0 -> about 23.3
    3.0+ -> 35
    """
    sharpe = _to_float(sharpe)

    if sharpe is None or sharpe <= 0:
        return 0.0

    return min(35.0, sharpe / 3.0 * 35.0)


def _normalize_rsi(rsi):
    """
    Convert RSI into a 0-35 contribution.

    Middle RSI is best:
    - Below 30: increasingly oversold, lower score
    - 30-40: improving score
    - 40-60: strongest neutral zone
    - 60-70: gradually reduced score
    - Above 70: increasingly overbought, lower score
    """
    rsi = _to_float(rsi)

    if rsi is None:
        return 25.0

    # RSI should normally be between 0 and 100.
    rsi = max(0.0, min(100.0, rsi))

    if rsi < 30:
        # 0 -> 0, 30 -> 25
        return max(0.0, rsi / 30.0 * 25.0)

    if rsi < 40:
        # 30 -> 25, 40 -> 35
        return 25.0 + ((rsi - 30.0) / 10.0 * 10.0)

    if rsi <= 60:
        return 35.0

    if rsi <= 70:
        # 60 -> 35, 70 -> 25
        return 35.0 - ((rsi - 60.0) / 10.0 * 10.0)

    # 70 -> 25, 100 -> 0
    return max(0.0, 25.0 - ((rsi - 70.0) / 30.0 * 25.0))


def _signal_bonus(signal):
    """
    Add points based on the moving average trend signal.

    BUY trend gets the biggest boost, SELL gives no bonus,
    and neutral or missing signals get a middle score.
    """
    signal = _normalize_signal(signal)

    if signal == "BUY":
        return 30.0

    if signal == "SELL":
        return 0.0

    return 15.0


def _score_from_metrics(metrics):
    """Build a total 0-100 score from Sharpe, RSI, and moving average signal."""
    sharpe_score = _normalize_sharpe(metrics.get("sharpe"))
    rsi_score = _normalize_rsi(metrics.get("current_rsi"))
    signal_score = _signal_bonus(metrics.get("signal"))

    score = sharpe_score + rsi_score + signal_score

    return max(0.0, min(100.0, score))


def _label_from_score(score, signal, rsi):
    """Decide a simple label from score, trend, and overbought status."""
    signal = _normalize_signal(signal)
    rsi = _to_float(rsi)

    if score >= 70 and signal == "BUY":
        if rsi is not None and rsi > 70:
            return "HOLD"
        return "BUY"

    if score >= 55 and signal == "BUY":
        return "HOLD"

    if score >= 65 and signal == "SELL":
        return "HOLD"

    return "SELL"


def recommend(ticker):
    """
    Generate a simple BUY/HOLD/SELL recommendation for a ticker.

    The final decision is based on a normalized score, current trend signal,
    RSI context, and Sharpe ratio.
    """
    ticker = str(ticker).strip().upper()

    try:
        metrics = analyze_stock(ticker)

        if not isinstance(metrics, dict):
            raise ValueError("analyze_stock did not return a metrics dictionary")

        signal = _normalize_signal(metrics.get("signal"))
        current_rsi = _to_float(metrics.get("current_rsi"))
        sharpe = _to_float(metrics.get("sharpe"))

        clean_metrics = {
            "signal": signal,
            "current_rsi": current_rsi,
            "sharpe": sharpe,
        }

        score = _score_from_metrics(clean_metrics)
        label = _label_from_score(score, signal, current_rsi)

        reasoning = []

        reasoning.append(f"Sharpe ratio is {_fmt(sharpe)}.")
        reasoning.append(f"RSI is {_fmt(current_rsi)}.")
        reasoning.append(f"MA signal is {signal or 'not available'}.")

        if current_rsi is not None:
            if current_rsi < 30:
                reasoning.append("RSI is oversold, which may indicate a possible rebound but also higher risk.")
            elif current_rsi > 70:
                reasoning.append("RSI is overbought, which raises caution.")
            else:
                reasoning.append("RSI is in a neutral range.")
        else:
            reasoning.append("RSI is not available, so the RSI contribution was treated cautiously.")

        if sharpe is not None:
            if sharpe >= 1:
                reasoning.append("Risk-adjusted performance is healthy.")
            elif sharpe >= 0.5:
                reasoning.append("Risk-adjusted performance is modest.")
            else:
                reasoning.append("Risk-adjusted performance is weak.")
        else:
            reasoning.append("Sharpe ratio is not available, so risk-adjusted performance could not be fully evaluated.")

        if signal == "BUY":
            reasoning.append("The short-term trend is above the long-term trend, supporting a bullish view.")
        elif signal == "SELL":
            reasoning.append("The short-term trend is below the long-term trend, which is bearish.")
        else:
            reasoning.append("Trend signal is not available or neutral.")

        return {
            "ticker": ticker,
            "score": round(score, 1),
            "label": label,
            "reasoning": " ".join(reasoning),
        }

    except Exception as e:
        return {
            "ticker": ticker,
            "score": 0,
            "label": "ERROR",
            "reasoning": f"Could not analyze {ticker}: {str(e)}",
        }


# Test cases to validate the recommendation engine with various tickers,
# including edge cases and error handling.

if __name__ == "__main__":
    tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"]

    for t in tickers:
        rec = recommend(t)
        print(
            f"{t}: score={rec['score']} "
            f"label={rec['label']} "
            f"reason={rec['reasoning']}"
        )

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

        assert 0 <= rec["score"] <= 100, f"Score out of range for {t}"
        assert rec["label"] in ["BUY", "HOLD", "SELL", "ERROR"], f"Invalid label for {t}"

        print(f"{t} passed")