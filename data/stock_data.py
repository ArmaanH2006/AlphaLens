import yfinance as yf
import pandas as pd
import numpy as np



def get_stock_data(ticker, period="1y"):
    df = yf.download(ticker, period=period)
    df.columns = df.columns.get_level_values(0)
    df['Daily_Return'] = df['Close'].pct_change()
    df['Cumulative_Return'] = (1 + df['Daily_Return']).cumprod()
    df = df.dropna()
    return df







