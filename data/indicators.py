from matplotlib import ticker
import pandas as pd
import numpy as np
from stock_data import get_stock_data


def clean_float(x):
    # clean float function makes sure the output is given correctly 
    if pd.isna(x):
        return None
    return float(round(x, 2))


def flatten_columns(df):
    # handles yfinance data if it comes back with multi-level columns
    if isinstance(df.columns, pd.MultiIndex):
        if "Close" in df.columns.get_level_values(0):
            df.columns = df.columns.get_level_values(0)
        elif "Close" in df.columns.get_level_values(1):
            df.columns = df.columns.get_level_values(1)

    return df


def get_price_column(df):
    # use adjusted close if it exists, otherwise use Close
    # adjusted close is better because it accounts for splits/dividends
    if "Adj Close" in df.columns:
        return "Adj Close"
    elif "Close" in df.columns:
        return "Close"
    else:
        raise ValueError("No Close or Adj Close column found in the stock data")


def get_indicators(df):
    df = df.copy().sort_index()
    df = flatten_columns(df)

    price_col = get_price_column(df)

    # make sure Daily_Return exists and uses the same price column
    df["Daily_Return"] = df[price_col].pct_change()

    # calculates the 50 day and 200 day moving averages.  
    df['MA_50'] = df[price_col].rolling(window=50).mean()
    df['MA_200'] = df[price_col].rolling(window=200).mean()


    #calculate RSI. Relative Strength Index (RSI) is a momentum oscillator that measures the speed and change of price movements. It is typically used to identify overbought or oversold conditions in a stock.


    #step 1 calculate the daily price changes
    delta = df[price_col].diff()

    #step 2 separate the gains and losses
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    #step 3 find the average gain and loss over a 14 day period
    avg_gain = gain.ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    avg_loss = loss.ewm(alpha=1/14, adjust=False, min_periods=14).mean()

    #step 5 calculate the relative strength (RS) Make sure the average loss is not zero to avoid division by zero errors. If the average loss is zero, we can set the RS to a very high value (indicating an extremely strong gain) or handle it in a way that makes sense for your analysis.
    RS = avg_gain / avg_loss.replace(0, np.nan)
    RSI = 100 - (100 / (1 + RS))
    df['RSI'] = RSI

    #MACD line and a MACD signal line.
    ema_12 = df[price_col].ewm(span=12, adjust=False).mean()
    ema_26 = df[price_col].ewm(span=26, adjust=False).mean()
    df['MACD'] = ema_12 - ema_26
    df['MACD_signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

    #Bollinger Bands upper, mid, lower
    df['BB_Mid'] = df[price_col].rolling(window=20).mean()
    df['BB_Std'] = df[price_col].rolling(window=20).std()

    #claculate the upper and lower bands
    df['BB_Upper'] = df['BB_Mid'] + (df['BB_Std'] * 2)
    df['BB_Lower'] = df['BB_Mid'] - (df['BB_Std'] * 2)

    #rolling 30 day volitility anualized
    df['Volatility'] = df['Daily_Return'].rolling(30).std() * (252**0.5)

    # IMPORTANT:
    # Do not return df.dropna() here because it removes about 199 rows
    # due to the 200 day moving average. That was making annual return
    # calculate from only a short recent period.
    return df


#analyze_stock(ticker) that returns Sharpe, annual return, max drawdown, RSI, volatility, and buy/sell signal

def analyze_stock(ticker, debug=False):
    raw_df = get_stock_data(ticker)
    raw_df = raw_df.copy().sort_index()
    raw_df = flatten_columns(raw_df)

    price_col = get_price_column(raw_df)

    # use the real price series from the downloaded data
    price_series = raw_df[price_col].dropna()

    if len(price_series) < 30:
        raise ValueError(f"Not enough price data to analyze {ticker}")

    # make sure Daily_Return exists and is based on the same price column
    raw_df["Daily_Return"] = raw_df[price_col].pct_change()

    # calculate indicators, but do not use the shortened indicator dataframe
    # for annual return, sharpe, or max drawdown
    df = get_indicators(raw_df)

    # use the full return history for performance calculations
    returns = raw_df['Daily_Return'].dropna()

    if len(returns) < 30:
        raise ValueError(f"Not enough return data to analyze {ticker}")

    return_std = returns.std()

    if return_std == 0 or pd.isna(return_std):
        sharpe_ratio = np.nan
    else:
        sharpe_ratio = (returns.mean() / return_std) * (252 ** 0.5)

    # calculate total return directly from actual downloaded start/end prices
    start_price = price_series.iloc[0]
    end_price = price_series.iloc[-1]

    total_return = (end_price / start_price) - 1

    # this should match total_return very closely
    total_return_from_daily_returns = (1 + returns).prod() - 1

    # use actual calendar time if the index is dates
    if isinstance(price_series.index, pd.DatetimeIndex):
        start_date = price_series.index[0]
        end_date = price_series.index[-1]
        num_years = (end_date - start_date).days / 365.25
    else:
        start_date = None
        end_date = None
        num_years = len(returns) / 252

    if num_years <= 0:
        annual_return = np.nan
    else:
        annual_return = (1 + total_return) ** (1 / num_years) - 1

    # max drawdown based on the real price series
    cumulative_return = price_series / start_price
    rolling_max = cumulative_return.cummax()
    drawdown = (cumulative_return - rolling_max) / rolling_max
    max_drawdown = drawdown.min()

    # use latest row where the indicators needed for signal exist
    indicator_df = df.dropna(subset=['MA_50', 'MA_200', 'RSI', 'Volatility'])

    if indicator_df.empty:
        signal = "N/A"
        current_rsi = np.nan
        volatility = np.nan
    else:
        latest = indicator_df.iloc[-1]

        current_rsi = latest['RSI']
        volatility = latest['Volatility']

        signal = "BUY" if latest['MA_50'] > latest['MA_200'] else "SELL"

    return {
        "ticker": ticker,
        "sharpe": clean_float(sharpe_ratio),
        "annual_return": clean_float(annual_return * 100),
        "max_drawdown": clean_float(max_drawdown * 100),
        "current_rsi": clean_float(current_rsi),
        "volatility": clean_float(volatility * 100),
        "signal": signal
    }


#compare_stocks(tickers) that returns all analyzed stocks as a sorted DataFrame by Sharpe ratio

def compare_stocks(tickers):
    results = []

    for ticker in tickers:
        analysis = analyze_stock(ticker)
        results.append(analysis)

    df = pd.DataFrame(results)

    # sort from highest Sharpe ratio to lowest Sharpe ratio
    df = df.sort_values(by="sharpe", ascending=False)

    # reset index so it looks clean
    df = df.reset_index(drop=True)

    return df


tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"]

comparison_df = compare_stocks(tickers)

print(comparison_df)