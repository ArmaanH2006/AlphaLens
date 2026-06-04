import yfinance as yf
import pandas as pd
import numpy as np
from typing import Optional


def get_stock_data(ticker: str, period: str = "1y") -> pd.DataFrame:
    # Download historical stock data for the given ticker and period.
    df: Optional[pd.DataFrame] = yf.download(ticker, period=period)

    # yfinance can return None or an empty DataFrame if the ticker is invalid.
    if df is None or df.empty:
        raise ValueError(f"No data downloaded for ticker {ticker}")

    # Flatten multi-level columns from yfinance to a simple Index.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    if "Close" not in df.columns:
        raise ValueError(f"Downloaded data for {ticker} has no Close column")

    # Calculate daily and cumulative returns using the closing prices.
    df["Daily_Return"] = df["Close"].pct_change()
    df["Cumulative_Return"] = (1 + df["Daily_Return"]).cumprod()
    df = df.dropna()
    return df







