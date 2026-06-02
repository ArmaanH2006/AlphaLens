import yfinance as yf
import pandas as pd
import numpy as np

df = yf.download('AAPL', start='2020-01-01', end='2021-01-01')

# June 2 2026. Understand and fix the get_stock_data function to ensure it returns the correct data for the specified tickers and period.


tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"]

stock_data = {}

# this function will get the stock data for a given ticker and period, calculate daily and cumulative returns, and return the resulting DataFrame

def get_stock_data(ticker, period="1y"):
    df = yf.download(ticker, period=period)
    df.columns = df.columns.get_level_values(0)
    df['Daily_Return'] = df['Close'].pct_change()
    df['Cumulative_Return'] = (1 + df['Daily_Return']).cumprod()
    df = df.dropna()
    return df

for ticker in tickers:
    stock_data[ticker] = get_stock_data(ticker)

print(stock_data['AAPL'].head())




