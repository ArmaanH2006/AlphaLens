"""Backtest trading strategies and combine them into a portfolio.

The module keeps the original public entry points while improving the test
design:

* indicators receive history before the evaluation period for warm-up;
* a training segment selects a strategy and a later test segment reports it;
* signals describe actions, while ``position`` describes invested/cash state;
* transaction costs and cash returns are included;
* portfolio metrics come from combined daily returns rather than averages of
  unrelated stock-level metrics.

This is a research backtest, not an investment recommendation or an execution
simulator.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
import inspect
from typing import Any

import numpy as np
import pandas as pd

# Support both normal backend imports (``from data.strategy import ...``) and
# direct execution (``python data/strategy.py``). Finnhub-specific work stays
# inside stock_data.py so this module never handles or exposes the API key.
if __package__:
    from .indicators import (
        clean_float,
        drop_incomplete_current_day,
        get_indicators,
    )
    from .stock_data import get_stock_data
else:
    from indicators import clean_float, drop_incomplete_current_day, get_indicators
    from stock_data import get_stock_data


TRADING_DAYS_PER_YEAR = 252
DEFAULT_DOWNLOAD_PERIOD = "10y"
DEFAULT_EVALUATION_YEARS = 5
DEFAULT_TRAINING_FRACTION = 0.60
DEFAULT_TRANSACTION_COST = 0.001  # 0.10% for each entry or exit
MINIMUM_SEGMENT_OBSERVATIONS = 30
MINIMUM_ACTIVE_SHARPE_ADVANTAGE = 0.10

STRATEGY_NAMES = ("Momentum", "Mean Reversion", "Buy and Hold")


def _download_stock_data(ticker: str, period: str) -> pd.DataFrame:
    """Call the project's stock-data adapter without assuming its API shape.

    Some adapters expose ``get_stock_data(ticker, period=...)`` while Finnhub
    adapters commonly choose their own start/end dates internally. Inspecting
    the wrapper signature lets both designs work without catching and hiding a
    real TypeError raised inside the downloader.
    """
    try:
        parameters = inspect.signature(get_stock_data).parameters
    except (TypeError, ValueError):
        parameters = {}

    accepts_period = "period" in parameters or any(
        parameter.kind is inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )

    if accepts_period:
        data = get_stock_data(ticker, period=period)
    else:
        data = get_stock_data(ticker)

    if not isinstance(data, pd.DataFrame):
        raise TypeError("get_stock_data must return a pandas DataFrame")
    if data.empty:
        raise ValueError(f"No stock data returned for {ticker}")

    return data


def _as_return_series(returns: pd.Series) -> pd.Series:
    """Validate and return a numeric simple-return Series."""
    if not isinstance(returns, pd.Series):
        returns = pd.Series(returns, dtype=float)

    numeric_returns = pd.to_numeric(returns, errors="coerce").astype(float)
    invalid_values = returns.notna() & numeric_returns.isna()
    if invalid_values.any():
        raise ValueError("Returns must be numeric when present")
    present_returns = numeric_returns.dropna()

    if not np.isfinite(present_returns).all():
        raise ValueError("Returns must be finite when present")
    if (present_returns < -1).any():
        raise ValueError("A simple return cannot be less than -100%")

    return numeric_returns


def calculate_total_return(returns: pd.Series) -> float:
    """Compound simple period returns into one total return."""
    returns = _as_return_series(returns).dropna()
    if returns.empty:
        return np.nan

    # NumPy makes the scalar result explicit for VS Code/Pylance. Pandas'
    # ``Series.prod`` is typed broadly enough that Pylance may think it could
    # return another Series even though it returns a scalar here.
    return_values = returns.to_numpy(dtype=float)
    return float(np.prod(1.0 + return_values) - 1.0)


def calculate_annualized_return(
    returns: pd.Series,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
) -> float:
    """Calculate compound annual growth from period returns."""
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")

    returns = _as_return_series(returns).dropna()
    if returns.empty:
        return np.nan

    total_return = calculate_total_return(returns)
    years = len(returns) / periods_per_year
    if years <= 0 or total_return <= -1:
        return -1.0 if total_return == -1 else np.nan

    return float((1 + total_return) ** (1 / years) - 1)


def calculate_sharpe_ratio(
    returns: pd.Series,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
) -> float:
    """Calculate annualized Sharpe using an effective annual cash rate."""
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")
    if risk_free_rate <= -1:
        raise ValueError("risk_free_rate must be greater than -1")

    returns = _as_return_series(returns).dropna()
    if returns.empty:
        return np.nan

    period_risk_free_rate = (
        (1 + risk_free_rate) ** (1 / periods_per_year) - 1
    )
    excess_returns = returns - period_risk_free_rate
    excess_values = excess_returns.to_numpy(dtype=float)
    standard_deviation = (
        np.std(excess_values, ddof=1)
        if len(excess_values) > 1
        else np.nan
    )

    if (
        pd.isna(standard_deviation)
        or standard_deviation <= np.finfo(float).eps
    ):
        return np.nan

    return float(
        np.mean(excess_values)
        / standard_deviation
        * np.sqrt(periods_per_year)
    )


def calculate_max_drawdown(returns: pd.Series) -> float:
    """Calculate worst peak-to-trough loss, including initial capital."""
    returns = _as_return_series(returns).dropna()
    if returns.empty:
        return np.nan

    wealth = np.concatenate(
        ([1.0], (1 + returns).cumprod().to_numpy(dtype=float))
    )
    running_maximum = np.maximum.accumulate(wealth)
    drawdown = wealth / running_maximum - 1
    return float(drawdown.min())


def calculate_annualized_volatility(
    returns: pd.Series,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
) -> float:
    """Calculate annualized standard deviation of returns."""
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")

    returns = _as_return_series(returns).dropna()
    if len(returns) < 2:
        return np.nan

    return_values = returns.to_numpy(dtype=float)
    return float(
        np.std(return_values, ddof=1) * np.sqrt(periods_per_year)
    )


def _period_cash_rate(risk_free_rate: float, periods_per_year: int) -> float:
    return float((1 + risk_free_rate) ** (1 / periods_per_year) - 1)


def _strategy_returns(
    daily_returns: pd.Series,
    position: pd.Series,
    transaction_cost: float,
    period_cash_rate: float,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Create net returns, turnover, and held-position series.

    A position calculated at the end of one row is applied to the following
    row's close-to-close return. Costs are charged when the position changes.
    """
    position = position.astype(float).clip(lower=0, upper=1)
    held_position = position.shift(1).fillna(0.0)

    # A missing market return remains missing while invested. While in cash,
    # the market return is irrelevant and the configured cash return applies.
    market_component = daily_returns * held_position
    market_component = market_component.where(held_position != 0, 0.0)
    cash_component = (1 - held_position) * period_cash_rate

    turnover = position.diff().abs()
    if not turnover.empty:
        turnover.iloc[0] = abs(position.iloc[0])

    net_returns = market_component + cash_component - turnover * transaction_cost
    return net_returns, turnover, held_position


def _metric_bundle(
    returns: pd.Series,
    risk_free_rate: float,
    periods_per_year: int,
) -> dict[str, float]:
    return {
        "total_return": calculate_total_return(returns),
        "annual_return": calculate_annualized_return(
            returns,
            periods_per_year=periods_per_year,
        ),
        "sharpe_ratio": calculate_sharpe_ratio(
            returns,
            risk_free_rate=risk_free_rate,
            periods_per_year=periods_per_year,
        ),
        "max_drawdown": calculate_max_drawdown(returns),
        "annualized_volatility": calculate_annualized_volatility(
            returns,
            periods_per_year=periods_per_year,
        ),
    }


def _normalize_ticker(ticker: Any) -> str:
    normalized = str(ticker).strip().upper()
    if not normalized:
        raise ValueError("Ticker cannot be empty")
    return normalized


def _format_index_value(value: Any) -> str:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return str(value)


def _select_strategy(
    training_metrics: Mapping[str, Mapping[str, float]],
) -> str | None:
    """Select an active strategy only when it clears the benchmark hurdle."""
    candidates = []

    for name in ("Momentum", "Mean Reversion"):
        metrics = training_metrics[name]
        sharpe = metrics["sharpe_ratio"]
        drawdown = metrics["max_drawdown"]

        if not np.isfinite(sharpe):
            continue

        drawdown_tiebreaker = drawdown if np.isfinite(drawdown) else -np.inf
        candidates.append((sharpe, drawdown_tiebreaker, name))

    benchmark_sharpe = training_metrics["Buy and Hold"]["sharpe_ratio"]
    benchmark_is_valid = np.isfinite(benchmark_sharpe)

    if not candidates:
        return "Buy and Hold" if benchmark_is_valid else None

    best_active_sharpe, _, best_active_name = max(candidates)

    if (
        benchmark_is_valid
        and best_active_sharpe
        < benchmark_sharpe + MINIMUM_ACTIVE_SHARPE_ADVANTAGE
    ):
        return "Buy and Hold"

    return best_active_name


def _latest_action(
    df: pd.DataFrame,
    position: pd.Series,
    required_columns: tuple[str, ...],
) -> str:
    latest = df.iloc[-1]
    if latest[list(required_columns)].isna().any():
        return "N/A"

    change = position.diff().iloc[-1]
    if pd.isna(change):
        return "N/A"
    if change > 0:
        return "BUY"
    if change < 0:
        return "SELL"
    return "HOLD"


def _public_strategy_metrics(
    test_metrics: Mapping[str, float],
    training_metrics: Mapping[str, float],
    action: str,
    position: str,
    num_trades: float,
    exposure: float,
) -> dict[str, str | float | int | None]:
    """Round metrics only at the public presentation boundary."""
    return {
        "signal": action,
        "position": position,
        "total_return": clean_float(test_metrics["total_return"] * 100),
        "annual_return": clean_float(test_metrics["annual_return"] * 100),
        "sharpe_ratio": clean_float(test_metrics["sharpe_ratio"]),
        "max_drawdown": clean_float(test_metrics["max_drawdown"] * 100),
        "annualized_volatility": clean_float(
            test_metrics["annualized_volatility"] * 100
        ),
        "training_sharpe_ratio": clean_float(
            training_metrics["sharpe_ratio"]
        ),
        "num_trades": int(round(num_trades)),
        "exposure": clean_float(exposure * 100),
    }


def _run_backtest(
    ticker: str,
    *,
    download_period: str,
    evaluation_years: int,
    training_fraction: float,
    transaction_cost: float,
    risk_free_rate: float,
    periods_per_year: int,
) -> dict[str, Any]:
    """Run one ticker and retain raw returns for portfolio construction."""
    ticker = _normalize_ticker(ticker)

    if evaluation_years <= 0:
        raise ValueError("evaluation_years must be positive")
    if not 0 < training_fraction < 1:
        raise ValueError("training_fraction must be between 0 and 1")
    if not 0 <= transaction_cost < 1:
        raise ValueError("transaction_cost must be between 0 and 1")
    if risk_free_rate <= -1:
        raise ValueError("risk_free_rate must be greater than -1")
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")

    raw_df = _download_stock_data(ticker, download_period)
    raw_df = drop_incomplete_current_day(raw_df)
    df = get_indicators(raw_df).copy().sort_index()

    required_columns = ["Daily_Return", "MA_50", "MA_200", "RSI"]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(
            f"Missing required columns for {ticker}: {', '.join(missing_columns)}"
        )
    if df.empty:
        raise ValueError(f"No stock data returned for {ticker}")

    momentum_valid = df[["MA_50", "MA_200"]].notna().all(axis=1)
    momentum_position = pd.Series(np.nan, index=df.index, dtype=float)
    momentum_position.loc[momentum_valid] = (
        df.loc[momentum_valid, "MA_50"]
        > df.loc[momentum_valid, "MA_200"]
    ).astype(float)
    momentum_position = momentum_position.ffill().fillna(0.0)

    mean_reversion_position = pd.Series(np.nan, index=df.index, dtype=float)
    mean_reversion_position.loc[df["RSI"] < 30] = 1.0
    mean_reversion_position.loc[df["RSI"] > 70] = 0.0
    mean_reversion_position = mean_reversion_position.ffill().fillna(0.0)

    buy_hold_position = pd.Series(1.0, index=df.index, dtype=float)

    positions = {
        "Momentum": momentum_position,
        "Mean Reversion": mean_reversion_position,
        "Buy and Hold": buy_hold_position,
    }

    period_cash_rate = _period_cash_rate(risk_free_rate, periods_per_year)
    full_returns: dict[str, pd.Series] = {}
    full_turnover: dict[str, pd.Series] = {}
    full_held_positions: dict[str, pd.Series] = {}

    for name, position in positions.items():
        net_returns, turnover, held_position = _strategy_returns(
            df["Daily_Return"],
            position,
            transaction_cost,
            period_cash_rate,
        )
        full_returns[name] = net_returns
        full_turnover[name] = turnover
        full_held_positions[name] = held_position

    usable_rows = df[required_columns].notna().all(axis=1)
    usable_index = df.index[usable_rows]
    if usable_index.empty:
        raise ValueError(f"Not enough indicator history to analyze {ticker}")

    if isinstance(df.index, pd.DatetimeIndex):
        evaluation_cutoff = df.index[-1] - pd.DateOffset(years=evaluation_years)
        evaluation_index = usable_index[usable_index >= evaluation_cutoff]
    else:
        evaluation_observations = evaluation_years * periods_per_year
        evaluation_index = usable_index[-evaluation_observations:]

    minimum_total = 2 * MINIMUM_SEGMENT_OBSERVATIONS
    if len(evaluation_index) < minimum_total:
        raise ValueError(
            f"Not enough evaluation data for {ticker}; "
            f"need at least {minimum_total} valid observations"
        )

    split_point = int(len(evaluation_index) * training_fraction)
    split_point = max(MINIMUM_SEGMENT_OBSERVATIONS, split_point)
    split_point = min(
        len(evaluation_index) - MINIMUM_SEGMENT_OBSERVATIONS,
        split_point,
    )

    training_index = evaluation_index[:split_point]
    test_index = evaluation_index[split_point:]

    training_returns = {
        name: returns.loc[training_index]
        for name, returns in full_returns.items()
    }
    test_returns = {
        name: returns.loc[test_index]
        for name, returns in full_returns.items()
    }

    training_metrics = {
        name: _metric_bundle(returns, risk_free_rate, periods_per_year)
        for name, returns in training_returns.items()
    }
    test_metrics = {
        name: _metric_bundle(returns, risk_free_rate, periods_per_year)
        for name, returns in test_returns.items()
    }

    selected_strategy = _select_strategy(training_metrics)

    actions = {
        "Momentum": _latest_action(
            df,
            momentum_position,
            ("MA_50", "MA_200"),
        ),
        "Mean Reversion": _latest_action(
            df,
            mean_reversion_position,
            ("RSI",),
        ),
        "Buy and Hold": "HOLD",
    }

    public_strategies = {}
    for name in STRATEGY_NAMES:
        latest_position = (
            "INVESTED" if positions[name].iloc[-1] >= 0.5 else "CASH"
        )
        num_trades = full_turnover[name].loc[test_index].sum()
        exposure = full_held_positions[name].loc[test_index].mean()

        public_strategies[name] = _public_strategy_metrics(
            test_metrics[name],
            training_metrics[name],
            actions[name],
            latest_position,
            num_trades,
            exposure,
        )

    summary = {
        "ticker": ticker,
        "strategies": public_strategies,
        # Kept as an alias for callers of the original version. The strategy is
        # selected on training data; all main metrics above use later test data.
        "best_strategy": selected_strategy,
        "selected_strategy": selected_strategy,
        "selection_method": (
            "active strategy must exceed buy-and-hold training Sharpe "
            f"by {MINIMUM_ACTIVE_SHARPE_ADVANTAGE:.2f}"
        ),
        "training_period": {
            "start": _format_index_value(training_index[0]),
            "end": _format_index_value(training_index[-1]),
            "observations": len(training_index),
        },
        "test_period": {
            "start": _format_index_value(test_index[0]),
            "end": _format_index_value(test_index[-1]),
            "observations": len(test_index),
        },
        "assumptions": {
            "download_period": download_period,
            "evaluation_years": evaluation_years,
            "training_fraction": training_fraction,
            "transaction_cost_percent": clean_float(transaction_cost * 100),
            "annual_risk_free_rate_percent": clean_float(
                risk_free_rate * 100
            ),
            "execution": "signal at one close, position applied next period",
            "incomplete_current_day_excluded": True,
        },
    }

    return {
        "summary": summary,
        "training_returns": training_returns,
        "test_returns": test_returns,
        "training_metrics": training_metrics,
        "test_metrics": test_metrics,
    }


def compare_strategies(
    ticker: str,
    *,
    download_period: str = DEFAULT_DOWNLOAD_PERIOD,
    evaluation_years: int = DEFAULT_EVALUATION_YEARS,
    training_fraction: float = DEFAULT_TRAINING_FRACTION,
    transaction_cost: float = DEFAULT_TRANSACTION_COST,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
) -> dict[str, Any]:
    """Compare three strategies with training/test separation.

    The training segment selects ``best_strategy``. Metrics returned under each
    strategy are measured on the later test segment and are therefore not used
    to make that selection.
    """
    result = _run_backtest(
        ticker,
        download_period=download_period,
        evaluation_years=evaluation_years,
        training_fraction=training_fraction,
        transaction_cost=transaction_cost,
        risk_free_rate=risk_free_rate,
        periods_per_year=periods_per_year,
    )
    return result["summary"]


def _resolve_portfolio_strategy(
    requested_strategy: str,
    selected_strategy: str | None,
) -> str:
    if str(requested_strategy).strip().casefold() == "selected":
        if selected_strategy is None:
            raise ValueError("No strategy had a valid training Sharpe ratio")
        return selected_strategy

    strategy_lookup = {name.casefold(): name for name in STRATEGY_NAMES}
    normalized_request = str(requested_strategy).strip().casefold()
    if normalized_request not in strategy_lookup:
        valid = ", ".join(("selected", *STRATEGY_NAMES))
        raise ValueError(f"Unknown portfolio strategy. Choose one of: {valid}")
    return strategy_lookup[normalized_request]


def _normalize_weights(
    weights: Mapping[str, float] | None,
) -> dict[str, float] | None:
    if weights is None:
        return None

    normalized: dict[str, float] = {}
    for ticker, weight in weights.items():
        normalized_ticker = _normalize_ticker(ticker)
        if normalized_ticker in normalized:
            raise ValueError(f"Duplicate weight supplied for {normalized_ticker}")

        numeric_weight = float(weight)
        if not np.isfinite(numeric_weight) or numeric_weight < 0:
            raise ValueError("Portfolio weights must be finite and non-negative")
        normalized[normalized_ticker] = numeric_weight

    return normalized


def _empty_portfolio_metrics(
    portfolio_strategy: str,
    num_errors: int,
) -> dict[str, Any]:
    return {
        "num_stocks": 0,
        "num_errors": num_errors,
        "portfolio_strategy": portfolio_strategy,
        "weights": {},
        "total_return": None,
        "annual_return": None,
        "sharpe_ratio": None,
        "max_drawdown": None,
        "annualized_volatility": None,
        "test_period": {"start": None, "end": None, "observations": 0},
        "rebalancing_assumption": "daily fixed weights with transaction costs",
        "portfolio_rebalancing_turnover": None,
        "estimated_rebalancing_cost": None,
        # Original response fields retained for the existing frontend.
        "best_overall_ticker": None,
        "best_overall_strategy": None,
        "best_overall_sharpe": None,
        "average_best_sharpe": None,
        "average_best_return": None,
        "average_best_drawdown": None,
        "strategy_counts": {},
    }


def _safe_mean(series: pd.Series) -> float | None:
    """Average numeric display values without leaking NaN into JSON."""
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return None
    return clean_float(numeric.mean())


def _combine_daily_rebalanced_returns(
    return_frame: pd.DataFrame,
    weights: Mapping[str, float],
    transaction_cost: float,
) -> tuple[pd.Series, float, float]:
    """Combine asset returns and charge for restoring fixed daily weights."""
    target_weights = pd.Series(weights, dtype=float).reindex(return_frame.columns)
    if target_weights.isna().any():
        raise ValueError("Portfolio weights do not match return columns")

    target = target_weights.to_numpy(dtype=float)
    portfolio_values = []
    total_turnover = 0.0
    total_rebalancing_cost = 0.0

    for _, row in return_frame.iterrows():
        asset_returns = row.to_numpy(dtype=float)
        gross_return = float(np.dot(target, asset_returns))

        ending_value = 1.0 + gross_return
        if ending_value <= 0:
            raise ValueError("Portfolio value became non-positive")

        drifted_weights = target * (1.0 + asset_returns) / ending_value
        turnover = float(np.abs(target - drifted_weights).sum() / 2.0)
        rebalancing_cost = turnover * transaction_cost

        portfolio_values.append(gross_return - rebalancing_cost)
        total_turnover += turnover
        total_rebalancing_cost += rebalancing_cost

    portfolio_returns = pd.Series(
        portfolio_values,
        index=return_frame.index,
        dtype=float,
        name="Portfolio_Return",
    )
    return portfolio_returns, total_turnover, total_rebalancing_cost


def portfolio_summary(
    tickers: Iterable[str],
    *,
    weights: Mapping[str, float] | None = None,
    portfolio_strategy: str = "selected",
    download_period: str = DEFAULT_DOWNLOAD_PERIOD,
    evaluation_years: int = DEFAULT_EVALUATION_YEARS,
    training_fraction: float = DEFAULT_TRAINING_FRACTION,
    transaction_cost: float = DEFAULT_TRANSACTION_COST,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
    strict: bool = False,
) -> dict[str, Any]:
    """Build a portfolio from aligned out-of-sample strategy returns.

    ``portfolio_strategy='selected'`` uses each ticker's training-selected
    strategy and evaluates the combination on later test returns. Supplying a
    named strategy applies that same strategy to every ticker.

    Constant weights imply daily rebalancing. If a ticker fails and ``strict``
    is false, its weight is removed and the remaining weights are normalized.
    """
    if isinstance(tickers, (str, bytes)):
        raise TypeError("tickers must be an iterable of ticker strings")

    normalized_tickers = []
    seen_tickers = set()
    for ticker in tickers:
        normalized = _normalize_ticker(ticker)
        if normalized not in seen_tickers:
            normalized_tickers.append(normalized)
            seen_tickers.add(normalized)

    normalized_weights = _normalize_weights(weights)
    if normalized_weights is not None:
        missing_weights = [
            ticker
            for ticker in normalized_tickers
            if ticker not in normalized_weights
        ]
        if missing_weights:
            raise ValueError(
                "Missing weights for: " + ", ".join(missing_weights)
            )

    stock_rows = []
    errors = []
    portfolio_return_series: dict[str, pd.Series] = {}

    for ticker in normalized_tickers:
        try:
            result = _run_backtest(
                ticker,
                download_period=download_period,
                evaluation_years=evaluation_years,
                training_fraction=training_fraction,
                transaction_cost=transaction_cost,
                risk_free_rate=risk_free_rate,
                periods_per_year=periods_per_year,
            )
            summary = result["summary"]
            selected_strategy = summary["selected_strategy"]
            strategy_for_portfolio = _resolve_portfolio_strategy(
                portfolio_strategy,
                selected_strategy,
            )

            portfolio_return_series[ticker] = result["test_returns"][
                strategy_for_portfolio
            ]

            selected_metrics = (
                summary["strategies"].get(selected_strategy, {})
                if selected_strategy is not None
                else {}
            )
            portfolio_metrics = summary["strategies"][strategy_for_portfolio]

            stock_rows.append(
                {
                    "ticker": ticker,
                    "selected_strategy": selected_strategy,
                    "portfolio_strategy": strategy_for_portfolio,
                    "signal": portfolio_metrics["signal"],
                    "position": portfolio_metrics["position"],
                    "total_return": portfolio_metrics["total_return"],
                    "annual_return": portfolio_metrics["annual_return"],
                    "sharpe_ratio": portfolio_metrics["sharpe_ratio"],
                    "max_drawdown": portfolio_metrics["max_drawdown"],
                    "annualized_volatility": portfolio_metrics[
                        "annualized_volatility"
                    ],
                    "num_trades": portfolio_metrics["num_trades"],
                    "exposure": portfolio_metrics["exposure"],
                    # Compatibility aliases from the original output.
                    "best_strategy": selected_strategy,
                    "best_signal": selected_metrics.get("signal"),
                    "best_total_return": selected_metrics.get("total_return"),
                    "best_sharpe_ratio": selected_metrics.get("sharpe_ratio"),
                    "best_max_drawdown": selected_metrics.get("max_drawdown"),
                    "momentum_sharpe": summary["strategies"]["Momentum"][
                        "sharpe_ratio"
                    ],
                    "mean_reversion_sharpe": summary["strategies"][
                        "Mean Reversion"
                    ]["sharpe_ratio"],
                    "buy_hold_sharpe": summary["strategies"]["Buy and Hold"][
                        "sharpe_ratio"
                    ],
                    "momentum_return": summary["strategies"]["Momentum"][
                        "total_return"
                    ],
                    "mean_reversion_return": summary["strategies"][
                        "Mean Reversion"
                    ]["total_return"],
                    "buy_hold_return": summary["strategies"]["Buy and Hold"][
                        "total_return"
                    ],
                }
            )

        except Exception as exc:
            if strict:
                raise
            errors.append(
                {
                    "ticker": ticker,
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                }
            )

    stocks_df = pd.DataFrame(stock_rows)
    if stocks_df.empty:
        return {
            "stocks": stocks_df,
            "portfolio_metrics": _empty_portfolio_metrics(
                portfolio_strategy,
                len(errors),
            ),
            "stock_summary": {
                "best_overall_ticker": None,
                "best_overall_strategy": None,
                "best_overall_sharpe": None,
                "strategy_counts": {},
            },
            "errors": errors,
        }

    successful_tickers = list(portfolio_return_series)
    if normalized_weights is None:
        portfolio_weights = {
            ticker: 1 / len(successful_tickers)
            for ticker in successful_tickers
        }
    else:
        successful_weight_total = sum(
            normalized_weights[ticker] for ticker in successful_tickers
        )
        if successful_weight_total <= 0:
            raise ValueError("Successful ticker weights must sum to more than zero")
        portfolio_weights = {
            ticker: normalized_weights[ticker] / successful_weight_total
            for ticker in successful_tickers
        }

    return_frame = pd.concat(
        portfolio_return_series,
        axis=1,
        join="inner",
    ).dropna(how="any")

    if len(return_frame) < MINIMUM_SEGMENT_OBSERVATIONS:
        message = (
            "Not enough aligned test returns to calculate portfolio metrics"
        )
        if strict:
            raise ValueError(message)
        errors.append(
            {
                "ticker": "PORTFOLIO",
                "error_type": "ValueError",
                "error": message,
            }
        )
        portfolio_metrics = _empty_portfolio_metrics(
            portfolio_strategy,
            len(errors),
        )
        portfolio_metrics["num_stocks"] = len(successful_tickers)
        portfolio_metrics["weights"] = portfolio_weights
    else:
        (
            portfolio_returns,
            portfolio_rebalancing_turnover,
            portfolio_rebalancing_cost,
        ) = _combine_daily_rebalanced_returns(
            return_frame,
            portfolio_weights,
            transaction_cost,
        )
        raw_portfolio_metrics = _metric_bundle(
            portfolio_returns,
            risk_free_rate,
            periods_per_year,
        )

        portfolio_metrics = {
            "num_stocks": len(successful_tickers),
            "num_errors": len(errors),
            "portfolio_strategy": portfolio_strategy,
            "weights": {
                ticker: round(weight, 4)
                for ticker, weight in portfolio_weights.items()
            },
            "total_return": clean_float(
                raw_portfolio_metrics["total_return"] * 100
            ),
            "annual_return": clean_float(
                raw_portfolio_metrics["annual_return"] * 100
            ),
            "sharpe_ratio": clean_float(
                raw_portfolio_metrics["sharpe_ratio"]
            ),
            "max_drawdown": clean_float(
                raw_portfolio_metrics["max_drawdown"] * 100
            ),
            "annualized_volatility": clean_float(
                raw_portfolio_metrics["annualized_volatility"] * 100
            ),
            "test_period": {
                "start": _format_index_value(return_frame.index[0]),
                "end": _format_index_value(return_frame.index[-1]),
                "observations": len(return_frame),
            },
            "rebalancing_assumption": (
                "daily fixed weights with transaction costs"
            ),
            "portfolio_rebalancing_turnover": clean_float(
                portfolio_rebalancing_turnover
            ),
            "estimated_rebalancing_cost": clean_float(
                portfolio_rebalancing_cost * 100
            ),
        }

    valid_rankings = stocks_df.dropna(subset=["best_sharpe_ratio"])
    if valid_rankings.empty:
        best_overall_ticker = None
        best_overall_strategy = None
        best_overall_sharpe = None
    else:
        top_stock = valid_rankings.sort_values(
            "best_sharpe_ratio",
            ascending=False,
        ).iloc[0]
        best_overall_ticker = str(top_stock["ticker"])
        best_overall_strategy = str(top_stock["best_strategy"])
        best_overall_sharpe = clean_float(top_stock["best_sharpe_ratio"])

    stocks_df = stocks_df.sort_values(
        by="best_sharpe_ratio",
        ascending=False,
        na_position="last",
    ).reset_index(drop=True)

    strategy_counts = (
        stocks_df["selected_strategy"].value_counts().to_dict()
    )

    # Keep the original frontend-facing summary names. These averages are
    # descriptive stock summaries; the true combined results remain in the
    # total_return, Sharpe, volatility, and drawdown fields above.
    compatibility_summary = {
        "best_overall_ticker": best_overall_ticker,
        "best_overall_strategy": best_overall_strategy,
        "best_overall_sharpe": best_overall_sharpe,
        "average_best_sharpe": _safe_mean(
            stocks_df["best_sharpe_ratio"]
        ),
        "average_best_return": _safe_mean(
            stocks_df["best_total_return"]
        ),
        "average_best_drawdown": _safe_mean(
            stocks_df["best_max_drawdown"]
        ),
        "strategy_counts": strategy_counts,
    }
    portfolio_metrics.update(compatibility_summary)

    return {
        "stocks": stocks_df,
        "portfolio_metrics": portfolio_metrics,
        "stock_summary": compatibility_summary,
        "errors": errors,
    }


if __name__ == "__main__":
    example = portfolio_summary(["AAPL", "NVDA", "TSLA", "MSFT", "AMD"])
    print("\nSTOCK RESULTS")
    print(example["stocks"])
    print("\nPORTFOLIO METRICS")
    print(example["portfolio_metrics"])
    print("\nERRORS")
    print(example["errors"])