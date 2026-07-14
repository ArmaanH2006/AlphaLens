"""Technical indicators and stock-level performance metrics.

The public functions in this module intentionally keep the names used by the
recommendation and strategy modules: ``clean_float``, ``flatten_columns``,
``get_price_column``, ``get_indicators``, ``analyze_stock``, and
``compare_stocks``.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import time
from typing import Any

import numpy as np
import pandas as pd

if __package__:
    from .stock_data import get_stock_data
else:
    from stock_data import get_stock_data


TRADING_DAYS_PER_YEAR = 252
RSI_WINDOW = 14
SHORT_MA_WINDOW = 50
LONG_MA_WINDOW = 200
BOLLINGER_WINDOW = 20
VOLATILITY_WINDOW = 30

RESULT_COLUMNS = [
    "ticker",
    "sharpe",
    "annual_return",
    "max_drawdown",
    "current_rsi",
    "volatility",
    "signal",
    "analysis_start",
    "analysis_end",
    "observations",
]


def clean_float(value: Any) -> float | None:
    """Return a finite, two-decimal Python float or ``None``."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if not np.isfinite(number):
        return None

    return round(number, 2)


def flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Flatten a single-ticker yfinance-style MultiIndex.

    A multi-ticker download would create duplicate names such as several
    ``Close`` columns. This module analyzes one ticker at a time, so that input
    is rejected with a clear error instead of producing ambiguous calculations.
    """
    if not isinstance(df, pd.DataFrame):
        raise TypeError("Stock data must be a pandas DataFrame")

    if not isinstance(df.columns, pd.MultiIndex):
        return df

    price_level = None
    for level in range(df.columns.nlevels):
        labels = set(df.columns.get_level_values(level))
        if "Adj Close" in labels or "Close" in labels:
            price_level = level
            break

    if price_level is None:
        raise ValueError("Could not identify the price level in MultiIndex columns")

    flattened = df.copy()
    flattened.columns = flattened.columns.get_level_values(price_level)

    if flattened.columns.duplicated().any():
        raise ValueError(
            "Multiple columns share the same price name. "
            "Download and analyze one ticker at a time."
        )

    return flattened


def get_price_column(df: pd.DataFrame) -> str:
    """Select adjusted close when supplied, otherwise ordinary close."""
    if "Adj Close" in df.columns:
        return "Adj Close"
    if "Close" in df.columns:
        return "Close"
    raise ValueError("No Close or Adj Close column found in the stock data")


def drop_incomplete_current_day(
    df: pd.DataFrame,
    *,
    market_timezone: str = "America/New_York",
    settlement_delay_minutes: int = 15,
    now: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Drop today's daily row while the regular US session may be unfinished.

    This lightweight guard is intended for the US-listed symbols used by the
    project. A full multi-exchange application should use an exchange calendar.
    """
    if not isinstance(df, pd.DataFrame):
        raise TypeError("Stock data must be a pandas DataFrame")
    if df.empty or not isinstance(df.index, pd.DatetimeIndex):
        return df
    if settlement_delay_minutes < 0:
        raise ValueError("settlement_delay_minutes cannot be negative")

    if now is None:
        current_time = pd.Timestamp.now(tz=market_timezone)
    else:
        current_time = pd.Timestamp(now)
        if current_time.tzinfo is None:
            current_time = current_time.tz_localize(market_timezone)
        else:
            current_time = current_time.tz_convert(market_timezone)

    last_timestamp = pd.Timestamp(df.index[-1])
    if last_timestamp.tzinfo is not None:
        last_timestamp = last_timestamp.tz_convert(market_timezone)

    close_minutes = 16 * 60 + settlement_delay_minutes
    cutoff = time(hour=close_minutes // 60, minute=close_minutes % 60)

    if (
        last_timestamp.date() == current_time.date()
        and current_time.time() < cutoff
    ):
        return df.iloc[:-1].copy()
    return df


def _format_index_value(value: Any) -> str:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return str(value)


def get_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``df`` with technical-indicator columns added."""
    df = flatten_columns(df).copy().sort_index()

    if df.empty:
        raise ValueError("Stock data is empty")

    # Duplicate dates would create artificial zero-length return periods.
    df = df.loc[~df.index.duplicated(keep="last")].copy()

    price_col = get_price_column(df)
    price = pd.to_numeric(df[price_col], errors="coerce")

    usable_price = price.dropna()
    if usable_price.empty:
        raise ValueError(f"{price_col} does not contain usable numeric prices")
    if not np.isfinite(usable_price).all() or (usable_price <= 0).any():
        raise ValueError(f"{price_col} must contain finite, positive prices")

    df[price_col] = price
    df["Daily_Return"] = price.pct_change(fill_method=None)

    df["MA_50"] = price.rolling(window=SHORT_MA_WINDOW).mean()
    df["MA_200"] = price.rolling(window=LONG_MA_WINDOW).mean()

    # RSI using exponentially smoothed gains and losses. Explicit handling is
    # needed for rising-only and flat series, where average loss is zero.
    delta = price.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)

    avg_gain = gain.ewm(
        alpha=1 / RSI_WINDOW,
        adjust=False,
        min_periods=RSI_WINDOW,
    ).mean()
    avg_loss = loss.ewm(
        alpha=1 / RSI_WINDOW,
        adjust=False,
        min_periods=RSI_WINDOW,
    ).mean()

    relative_strength = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + relative_strength))
    rsi = rsi.mask((avg_loss == 0) & (avg_gain > 0), 100.0)
    rsi = rsi.mask((avg_loss == 0) & (avg_gain == 0), 50.0)
    df["RSI"] = rsi

    ema_12 = price.ewm(span=12, adjust=False).mean()
    ema_26 = price.ewm(span=26, adjust=False).mean()
    df["MACD"] = ema_12 - ema_26
    df["MACD_signal"] = df["MACD"].ewm(span=9, adjust=False).mean()

    df["BB_Mid"] = price.rolling(window=BOLLINGER_WINDOW).mean()
    df["BB_Std"] = price.rolling(window=BOLLINGER_WINDOW).std()
    df["BB_Upper"] = df["BB_Mid"] + (2 * df["BB_Std"])
    df["BB_Lower"] = df["BB_Mid"] - (2 * df["BB_Std"])

    df["Volatility"] = (
        df["Daily_Return"].rolling(VOLATILITY_WINDOW).std()
        * np.sqrt(TRADING_DAYS_PER_YEAR)
    )

    # Keep the complete history. Dropping every row with a missing indicator
    # would discard the MA_200 warm-up period and distort performance metrics.
    return df


def analyze_stock(
    ticker: str,
    debug: bool = False,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
    exclude_incomplete_current_day: bool = True,
) -> dict[str, str | float | int | None]:
    """Calculate performance metrics and the latest moving-average trend.

    Percentage values in the returned dictionary are expressed as percentage
    points. For example, ``12.5`` means 12.5%, not 0.125.
    """
    normalized_ticker = str(ticker).strip().upper()
    if not normalized_ticker:
        raise ValueError("Ticker cannot be empty")
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")
    if risk_free_rate <= -1:
        raise ValueError("risk_free_rate must be greater than -1")

    raw_df = get_stock_data(normalized_ticker)
    if exclude_incomplete_current_day:
        raw_df = drop_incomplete_current_day(raw_df)
    df = get_indicators(raw_df)
    price_col = get_price_column(df)

    price_series = df[price_col].dropna()
    if len(price_series) < 30:
        raise ValueError(f"Not enough price data to analyze {normalized_ticker}")

    returns = df["Daily_Return"].dropna()
    if len(returns) < 30:
        raise ValueError(f"Not enough return data to analyze {normalized_ticker}")

    # Convert an annual effective rate to the matching per-period rate.
    period_risk_free_rate = (
        (1 + risk_free_rate) ** (1 / periods_per_year) - 1
    )
    excess_returns = returns - period_risk_free_rate
    return_std = excess_returns.std()

    if pd.isna(return_std) or return_std <= np.finfo(float).eps:
        sharpe_ratio = np.nan
    else:
        sharpe_ratio = (
            excess_returns.mean() / return_std
        ) * np.sqrt(periods_per_year)

    start_price = price_series.iloc[0]
    end_price = price_series.iloc[-1]
    total_return = (end_price / start_price) - 1

    if isinstance(price_series.index, pd.DatetimeIndex):
        elapsed_days = (
            price_series.index[-1] - price_series.index[0]
        ).total_seconds() / 86_400
        num_years = elapsed_days / 365.25
    else:
        num_years = len(returns) / periods_per_year

    annual_return = (
        np.nan
        if num_years <= 0
        else (1 + total_return) ** (1 / num_years) - 1
    )

    cumulative_return = price_series / start_price
    drawdown = (cumulative_return / cumulative_return.cummax()) - 1
    max_drawdown = drawdown.min()

    # Use the actual latest row. Falling back to an older complete row could
    # silently return a stale recommendation when the newest data is missing.
    latest = df.iloc[-1]
    current_rsi = latest["RSI"]
    volatility = latest["Volatility"]

    # RSI and volatility can be available before the MA_200 warm-up finishes,
    # so return those values independently from the moving-average signal.
    if latest[["MA_50", "MA_200"]].isna().any():
        signal = "N/A"
    else:
        if latest["MA_50"] > latest["MA_200"]:
            signal = "BUY"
        elif latest["MA_50"] < latest["MA_200"]:
            signal = "SELL"
        else:
            signal = "HOLD"

    result: dict[str, str | float | int | None] = {
        "ticker": normalized_ticker,
        "sharpe": clean_float(sharpe_ratio),
        "annual_return": clean_float(annual_return * 100),
        "max_drawdown": clean_float(max_drawdown * 100),
        "current_rsi": clean_float(current_rsi),
        "volatility": clean_float(volatility * 100),
        "signal": signal,
        "analysis_start": _format_index_value(price_series.index[0]),
        "analysis_end": _format_index_value(price_series.index[-1]),
        "observations": int(len(price_series)),
    }

    if debug:
        first_date = price_series.index[0]
        last_date = price_series.index[-1]
        print(
            f"Analyzed {normalized_ticker}: {len(price_series)} prices "
            f"from {first_date} through {last_date}."
        )

    return result


def compare_stocks(tickers: Iterable[str]) -> pd.DataFrame:
    """Analyze tickers and return results ordered by descending Sharpe ratio."""
    results = [analyze_stock(ticker) for ticker in tickers]

    if not results:
        return pd.DataFrame(columns=RESULT_COLUMNS)

    return (
        pd.DataFrame(results, columns=RESULT_COLUMNS)
        .sort_values(by="sharpe", ascending=False, na_position="last")
        .reset_index(drop=True)
    )


if __name__ == "__main__":
    example_tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"]
    print(compare_stocks(example_tickers))