"""Create transparent technical-research labels from indicator metrics.

The recommendation is a heuristic summary of price-based metrics. It is not a
forecast, valuation model, or personalized investment recommendation.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

# Support both ``from data.recommendation import recommend`` and direct
# execution with ``python data/recommendation.py``.
if __package__:
    from .indicators import analyze_stock
else:
    from indicators import analyze_stock


VALID_SIGNALS = {"BUY", "HOLD", "SELL", "N/A"}
VALID_LABELS = {"BUY", "HOLD", "SELL", "ERROR"}


def _to_float(value: Any, default: float | None = None) -> float | None:
    """Return a finite Python float or ``default``."""
    if value is None:
        return default

    try:
        number = float(value)
    except (TypeError, ValueError):
        return default

    if not math.isfinite(number):
        return default
    return number


def _fmt(value: float | None, suffix: str = "") -> str:
    if value is None:
        return "not available"
    formatted = f"{value:.2f}".rstrip("0").rstrip(".")
    return f"{formatted}{suffix}"


def _normalize_signal(signal: Any) -> str | None:
    if signal is None:
        return None

    normalized = str(signal).strip().upper()
    return normalized if normalized in VALID_SIGNALS else None


def _normalize_sharpe(sharpe: Any) -> float:
    """Convert positive Sharpe into a contribution from 0 to 20."""
    sharpe = _to_float(sharpe)
    if sharpe is None or sharpe <= 0:
        return 0.0
    return min(20.0, sharpe / 3.0 * 20.0)


def _normalize_rsi(rsi: Any) -> float:
    """Convert RSI into a contribution from 0 to 15.

    The 40–60 range receives the strongest score. Extreme readings receive a
    lower score because either severe weakness or overbought conditions add
    uncertainty. Missing RSI receives no points.
    """
    rsi = _to_float(rsi)
    if rsi is None:
        return 0.0

    rsi = max(0.0, min(100.0, rsi))

    if rsi < 30:
        return rsi / 30.0 * 10.5
    if rsi < 40:
        return 10.5 + (rsi - 30.0) / 10.0 * 4.5
    if rsi <= 60:
        return 15.0
    if rsi <= 70:
        return 15.0 - (rsi - 60.0) / 10.0 * 4.5
    return max(0.0, 10.5 - (rsi - 70.0) / 30.0 * 10.5)


def _signal_score(signal: Any) -> float:
    """Convert moving-average state into a contribution from 0 to 20."""
    signal = _normalize_signal(signal)
    if signal == "BUY":
        return 20.0
    if signal == "HOLD":
        return 10.0
    return 0.0


def _annual_return_score(annual_return: Any) -> float:
    """Convert annual return percentage points into 0 to 15 points."""
    annual_return = _to_float(annual_return)
    if annual_return is None or annual_return <= 0:
        return 0.0
    return min(15.0, annual_return / 30.0 * 15.0)


def _drawdown_score(max_drawdown: Any) -> float:
    """Reward smaller drawdown with 0 to 15 points."""
    max_drawdown = _to_float(max_drawdown)
    if max_drawdown is None:
        return 0.0

    severity = abs(min(0.0, max_drawdown))
    if severity <= 10:
        return 15.0
    if severity >= 50:
        return 0.0
    return (50.0 - severity) / 40.0 * 15.0


def _volatility_score(volatility: Any) -> float:
    """Reward lower annualized volatility with 0 to 15 points."""
    volatility = _to_float(volatility)
    if volatility is None:
        return 0.0

    volatility = max(0.0, volatility)
    if volatility <= 20:
        return 15.0
    if volatility >= 80:
        return 0.0
    return (80.0 - volatility) / 60.0 * 15.0


def _score_breakdown(metrics: Mapping[str, Any]) -> dict[str, float]:
    """Return transparent component scores whose maximum total is 100."""
    breakdown = {
        "sharpe": _normalize_sharpe(metrics.get("sharpe")),
        "rsi": _normalize_rsi(metrics.get("current_rsi")),
        "trend": _signal_score(metrics.get("signal")),
        "annual_return": _annual_return_score(metrics.get("annual_return")),
        "drawdown": _drawdown_score(metrics.get("max_drawdown")),
        "volatility": _volatility_score(metrics.get("volatility")),
    }
    breakdown["total"] = max(0.0, min(100.0, sum(breakdown.values())))
    return breakdown


def _score_from_metrics(metrics: Mapping[str, Any]) -> float:
    """Build a bounded 0–100 technical score."""
    return _score_breakdown(metrics)["total"]


def _data_quality_from_metrics(metrics: Mapping[str, Any]) -> str:
    available = 0

    for name in (
        "sharpe",
        "current_rsi",
        "annual_return",
        "max_drawdown",
        "volatility",
    ):
        if _to_float(metrics.get(name)) is not None:
            available += 1

    if _normalize_signal(metrics.get("signal")) not in {None, "N/A"}:
        available += 1

    if available >= 5:
        return "COMPLETE"
    if available >= 3:
        return "PARTIAL"
    return "LIMITED"


def _label_from_score(
    score: float,
    signal: Any,
    rsi: Any,
    sharpe: Any,
) -> str:
    """Choose a conservative label from score and current technical state."""
    signal = _normalize_signal(signal)
    rsi = _to_float(rsi)
    sharpe = _to_float(sharpe)

    if signal in {None, "N/A", "HOLD"}:
        return "HOLD"

    if signal == "BUY":
        if rsi is not None and rsi >= 70:
            return "HOLD"
        if score >= 70 and sharpe is not None and sharpe >= 1:
            return "BUY"
        return "HOLD"

    # A bearish trend that is already deeply oversold calls for caution rather
    # than an automatic new sell label.
    if signal == "SELL" and rsi is not None and rsi < 30:
        return "HOLD"
    if signal == "SELL" and score >= 60:
        return "HOLD"
    return "SELL"


def _build_reasoning(
    metrics: Mapping[str, Any],
    score: float,
    label: str,
    data_quality: str,
    analysis_period: Mapping[str, Any],
) -> str:
    sharpe = _to_float(metrics.get("sharpe"))
    rsi = _to_float(metrics.get("current_rsi"))
    annual_return = _to_float(metrics.get("annual_return"))
    drawdown = _to_float(metrics.get("max_drawdown"))
    volatility = _to_float(metrics.get("volatility"))
    signal = _normalize_signal(metrics.get("signal"))

    reasoning = [
        (
            f"Technical score is {_fmt(score)} out of 100 with "
            f"{data_quality.lower()} metric coverage."
        ),
        f"Sharpe ratio is {_fmt(sharpe)}.",
        f"RSI is {_fmt(rsi)}.",
        f"Moving-average state is {signal or 'not available'}.",
        f"Annual return is {_fmt(annual_return, '%')}.",
        (
            f"Maximum drawdown is {_fmt(drawdown, '%')} and annualized "
            f"volatility is {_fmt(volatility, '%')}."
        ),
    ]

    period_start = analysis_period.get("start")
    period_end = analysis_period.get("end")
    observations = analysis_period.get("observations")
    if period_start is not None and period_end is not None:
        reasoning.append(
            f"Metrics cover {period_start} through {period_end} "
            f"using {observations} observations."
        )

    if rsi is None:
        reasoning.append("RSI is unavailable, so it contributed no points.")
    elif rsi < 30:
        reasoning.append("RSI is oversold, which can precede a rebound but also reflects weakness.")
    elif rsi >= 70:
        reasoning.append("RSI is overbought, so a new BUY label is withheld.")
    elif 40 <= rsi <= 60:
        reasoning.append("RSI is in the strongest neutral scoring range.")
    else:
        reasoning.append("RSI is outside the central neutral range.")

    if signal == "BUY":
        reasoning.append("MA-50 is above MA-200, indicating a bullish trend state.")
    elif signal == "SELL":
        reasoning.append("MA-50 is below MA-200, indicating a bearish trend state.")
    elif signal == "HOLD":
        reasoning.append("The moving averages are equal, so the trend state is neutral.")
    else:
        reasoning.append("A reliable moving-average state is unavailable.")

    reasoning.append(f"The resulting research label is {label}.")
    return " ".join(reasoning)


def recommend(ticker: str, *, raise_errors: bool = False) -> dict[str, Any]:
    """Return a technical score, conservative label, and explanation.

    Set ``raise_errors=True`` during development or tests to expose unexpected
    exceptions instead of converting them into an ``ERROR`` response.
    """
    normalized_ticker = str(ticker).strip().upper()

    try:
        if not normalized_ticker:
            raise ValueError("Ticker cannot be empty")

        metrics = analyze_stock(normalized_ticker)
        if not isinstance(metrics, dict):
            raise TypeError("analyze_stock must return a metrics dictionary")

        clean_metrics = {
            "sharpe": _to_float(metrics.get("sharpe")),
            "current_rsi": _to_float(metrics.get("current_rsi")),
            "signal": _normalize_signal(metrics.get("signal")),
            "annual_return": _to_float(metrics.get("annual_return")),
            "max_drawdown": _to_float(metrics.get("max_drawdown")),
            "volatility": _to_float(metrics.get("volatility")),
        }

        score_breakdown = _score_breakdown(clean_metrics)
        score = score_breakdown["total"]
        data_quality = _data_quality_from_metrics(clean_metrics)
        analysis_period = {
            "start": metrics.get("analysis_start"),
            "end": metrics.get("analysis_end"),
            "observations": metrics.get("observations"),
        }
        label = _label_from_score(
            score,
            clean_metrics["signal"],
            clean_metrics["current_rsi"],
            clean_metrics["sharpe"],
        )

        return {
            "ticker": normalized_ticker,
            "score": round(score, 1),
            "label": label,
            "reasoning": _build_reasoning(
                clean_metrics,
                score,
                label,
                data_quality,
                analysis_period,
            ),
            # Kept for frontend compatibility, but no predictive confidence is
            # claimed until the scoring model has walk-forward validation.
            "confidence": "UNVALIDATED",
            "model_confidence": "UNVALIDATED",
            "data_quality": data_quality,
            "metrics": clean_metrics,
            "score_breakdown": {
                name: round(value, 1)
                for name, value in score_breakdown.items()
            },
            "analysis_period": analysis_period,
        }

    except Exception as exc:
        if raise_errors:
            raise
        return {
            "ticker": normalized_ticker,
            "score": 0.0,
            "label": "ERROR",
            "reasoning": f"Could not analyze {normalized_ticker or 'ticker'}: {exc}",
            "confidence": "UNVALIDATED",
            "model_confidence": "UNVALIDATED",
            "data_quality": "LIMITED",
            "metrics": {},
            "score_breakdown": {},
            "analysis_period": {
                "start": None,
                "end": None,
                "observations": 0,
            },
            "error_type": type(exc).__name__,
        }


if __name__ == "__main__":
    for example_ticker in ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"]:
        result = recommend(example_ticker)
        print(
            f"{result['ticker']}: score={result['score']} "
            f"label={result['label']} data_quality={result['data_quality']} "
            f"model_confidence={result['model_confidence']}"
        )