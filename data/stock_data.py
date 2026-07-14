"""Download and validate daily historical stock prices.

Historical prices are provided by yfinance.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf


DEFAULT_PERIOD = "5y"
DAILY_INTERVAL = "1d"
PRICE_FIELDS = ("Open", "High", "Low", "Close", "Adj Close")


def _normalize_ticker(ticker: Any) -> str:
    """Return a non-empty, uppercase ticker symbol."""
    normalized = str(ticker).strip().upper()
    if not normalized:
        raise ValueError("Ticker cannot be empty")
    return normalized


def _normalize_period(period: Any) -> str:
    """Return a non-empty yfinance period string."""
    normalized = str(period).strip().lower()
    if not normalized:
        raise ValueError("Period cannot be empty")
    return normalized


def _flatten_single_ticker_columns(
    df: pd.DataFrame,
    ticker: str,
) -> pd.DataFrame:
    """Flatten either orientation of yfinance single-ticker columns."""
    if not isinstance(df.columns, pd.MultiIndex):
        return df

    price_level = None
    for level in range(df.columns.nlevels):
        labels = set(df.columns.get_level_values(level))
        if "Close" in labels or "Adj Close" in labels:
            price_level = level
            break

    if price_level is None:
        raise ValueError(
            f"Could not identify price columns in downloaded data for {ticker}"
        )

    flattened = df.copy()
    flattened.columns = flattened.columns.get_level_values(price_level)

    if flattened.columns.duplicated().any():
        raise ValueError(
            f"Downloaded data for {ticker} contains duplicate price columns"
        )

    return flattened


def get_stock_data(
    ticker: str,
    period: str = DEFAULT_PERIOD,
) -> pd.DataFrame:
    """Download clean daily prices for one ticker.

    The default five-year period gives stock-level Sharpe, drawdown, and annual
    return calculations more context than a single year. ``strategy.py`` can
    still request a longer period, such as ``10y``, for train/test backtesting.

    ``Daily_Return`` and ``Cumulative_Return`` use adjusted close when it is
    available, otherwise close. The first price row is preserved: its daily
    return is missing and its cumulative return is 1.0.
    """
    normalized_ticker = _normalize_ticker(ticker)
    normalized_period = _normalize_period(period)

    df = yf.download(
        tickers=normalized_ticker,
        period=normalized_period,
        interval=DAILY_INTERVAL,
        auto_adjust=False,
        progress=False,
        threads=False,
        group_by="column",
    )

    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        raise ValueError(
            f"No data downloaded for ticker {normalized_ticker} "
            f"using period {normalized_period}"
        )

    df = _flatten_single_ticker_columns(df, normalized_ticker)
    df = df.copy().sort_index()
    df = df.loc[~df.index.duplicated(keep="last")]

    for column in PRICE_FIELDS:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    if "Adj Close" in df.columns and df["Adj Close"].notna().any():
        price_column = "Adj Close"
    elif "Close" in df.columns and df["Close"].notna().any():
        price_column = "Close"
        # Prevent downstream code from selecting an unusable adjusted column.
        if "Adj Close" in df.columns:
            df = df.drop(columns=["Adj Close"])
    else:
        raise ValueError(
            f"Downloaded data for {normalized_ticker} has no usable price column"
        )

    df = df.dropna(subset=[price_column])
    if df.empty:
        raise ValueError(f"No valid prices downloaded for {normalized_ticker}")

    price = df[price_column].astype(float)
    if not np.isfinite(price.to_numpy()).all():
        raise ValueError(
            f"Downloaded prices for {normalized_ticker} must be finite"
        )
    if (price <= 0).any():
        raise ValueError(
            f"Downloaded prices for {normalized_ticker} must be positive"
        )

    df["Daily_Return"] = price.pct_change(fill_method=None)
    df["Cumulative_Return"] = price / price.iloc[0]

    return df








