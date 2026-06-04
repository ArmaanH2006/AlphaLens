import pandas as pd
import numpy as np

# Import function that downloads stock price data
from stock_data import get_stock_data

# Import indicator function and helper for cleaning numbers
from indicators import get_indicators, clean_float


# This function calculates the total return for a strategy.
# Example: if a strategy grows from $1.00 to $1.25, total return is 25%.
def calculate_total_return(returns):
    # Remove missing return values
    returns = returns.dropna()

    # If there are no returns, return NaN
    if returns.empty:
        return np.nan

    # Compound the daily returns into one total return
    return (1 + returns).prod() - 1


# This function calculates the annualized Sharpe ratio.
# Sharpe ratio measures return compared to risk/volatility.
def calculate_sharpe_ratio(returns, risk_free_rate=0.0, periods_per_year=252):
    # Remove missing return values
    returns = returns.dropna()

    # If there are no returns, Sharpe cannot be calculated
    if returns.empty:
        return np.nan

    # Convert the yearly risk-free rate into a daily risk-free rate
    daily_risk_free_rate = risk_free_rate / periods_per_year

    # Calculate returns above the risk-free rate
    excess_returns = returns - daily_risk_free_rate

    # Calculate volatility of the strategy returns
    std = excess_returns.std()

    # If volatility is zero or missing, Sharpe cannot be calculated
    if std == 0 or pd.isna(std):
        return np.nan

    # Calculate daily Sharpe and annualize it using sqrt(252)
    return (excess_returns.mean() / std) * np.sqrt(periods_per_year)


# This function calculates the max drawdown.
# Max drawdown means the biggest drop from a previous high.
def calculate_max_drawdown(returns):
    # Replace missing returns with 0 so the cumulative return does not break
    returns = returns.fillna(0)

    # Build the portfolio growth curve over time
    cumulative_returns = (1 + returns).cumprod()

    # Track the highest portfolio value seen so far
    running_max = cumulative_returns.cummax()

    # Calculate percentage drop from the running high
    drawdown = (cumulative_returns / running_max) - 1

    # Return the worst drawdown
    return drawdown.min()


# This function compares three strategies:
# 1. Momentum
# 2. Mean Reversion
# 3. Buy and Hold
def compare_strategies(ticker):
    # Download 5 years of stock data
    # 5 years is better because MA_200 needs a lot of data
    df = get_stock_data(ticker, period="5y")

    # Add indicators like MA_50, MA_200, RSI, and Daily_Return
    df = get_indicators(df)

    # These columns are required for the strategy logic
    required_columns = ["Daily_Return", "MA_50", "MA_200", "RSI"]

    # Make sure every required column exists
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    # Make sure there is enough data to calculate MA_200
    if df["MA_200"].dropna().empty:
        raise ValueError(f"Not enough data to calculate MA_200 for {ticker}")

    # --------------------------------------------------
    # Momentum strategy
    # Buy when MA_50 crosses above MA_200
    # Sell when MA_50 crosses below MA_200
    # --------------------------------------------------

    # Buy signal happens when MA_50 moves from below MA_200 to above MA_200
    df["Momentum_Buy"] = (
        (df["MA_50"] > df["MA_200"]) &
        (df["MA_50"].shift(1) <= df["MA_200"].shift(1))
    )

    # Sell signal happens when MA_50 moves from above MA_200 to below MA_200
    df["Momentum_Sell"] = (
        (df["MA_50"] < df["MA_200"]) &
        (df["MA_50"].shift(1) >= df["MA_200"].shift(1))
    )

    # Start with no position
    # 1 means holding stock
    # 0 means holding cash
    df["Momentum_Position"] = np.nan

    # Set position to 1 on buy signals
    df.loc[df["Momentum_Buy"], "Momentum_Position"] = 1

    # Set position to 0 on sell signals
    df.loc[df["Momentum_Sell"], "Momentum_Position"] = 0

    # Carry the most recent position forward
    # If no signal happened yet, start in cash
    df["Momentum_Position"] = df["Momentum_Position"].ffill().fillna(0)

    # Calculate momentum strategy returns
    # shift(1) avoids look-ahead bias by using yesterday's position for today's return
    df["Momentum_Return"] = df["Momentum_Position"].shift(1) * df["Daily_Return"]

    # --------------------------------------------------
    # Mean reversion strategy
    # Buy when RSI < 30
    # Sell when RSI > 70
    # --------------------------------------------------

    # Start with no mean reversion position
    df["Mean_Reversion_Position"] = np.nan

    # Buy when RSI is below 30
    df.loc[df["RSI"] < 30, "Mean_Reversion_Position"] = 1

    # Sell when RSI is above 70
    df.loc[df["RSI"] > 70, "Mean_Reversion_Position"] = 0

    # When RSI is between 30 and 70, keep the previous position
    # If there was no previous signal, start in cash
    df["Mean_Reversion_Position"] = (
        df["Mean_Reversion_Position"]
        .ffill()
        .fillna(0)
    )

    # Calculate mean reversion strategy returns
    # shift(1) avoids look-ahead bias
    df["Mean_Reversion_Return"] = (
        df["Mean_Reversion_Position"].shift(1) * df["Daily_Return"]
    )

    # --------------------------------------------------
    # Buy and hold baseline
    # Always hold the stock
    # --------------------------------------------------

    # Buy and hold simply uses the stock's daily returns
    df["Buy_Hold_Return"] = df["Daily_Return"]

    # --------------------------------------------------
    # Latest signals
    # --------------------------------------------------

    # Get the most recent momentum position
    latest_momentum_position = df["Momentum_Position"].iloc[-1]

    # Get the most recent RSI value
    latest_rsi = df["RSI"].iloc[-1]

    # If momentum position is 1, the strategy is currently holding stock
    momentum_signal = "BUY" if latest_momentum_position == 1 else "SELL"

    # Mean reversion signal is based on the current RSI value
    mean_reversion_signal = (
        "BUY" if latest_rsi < 30
        else "SELL" if latest_rsi > 70
        else "HOLD"
    )

    # --------------------------------------------------
    # Build metrics for each strategy
    # --------------------------------------------------

    # Store each strategy's signal, return, Sharpe ratio, and drawdown
    strategies = {
        "Momentum": {
            "signal": momentum_signal,
            "total_return": calculate_total_return(df["Momentum_Return"]),
            "sharpe_ratio": calculate_sharpe_ratio(df["Momentum_Return"]),
            "max_drawdown": calculate_max_drawdown(df["Momentum_Return"]),
        },
        "Mean Reversion": {
            "signal": mean_reversion_signal,
            "total_return": calculate_total_return(df["Mean_Reversion_Return"]),
            "sharpe_ratio": calculate_sharpe_ratio(df["Mean_Reversion_Return"]),
            "max_drawdown": calculate_max_drawdown(df["Mean_Reversion_Return"]),
        },
        "Buy and Hold": {
            "signal": "BUY",
            "total_return": calculate_total_return(df["Buy_Hold_Return"]),
            "sharpe_ratio": calculate_sharpe_ratio(df["Buy_Hold_Return"]),
            "max_drawdown": calculate_max_drawdown(df["Buy_Hold_Return"]),
        },
    }

    # Pick the best strategy using the highest Sharpe ratio
    # If a Sharpe ratio is NaN, give it a very low score so it does not win
    best_strategy = max(
        strategies,
        key=lambda name: strategies[name]["sharpe_ratio"]
        if pd.notna(strategies[name]["sharpe_ratio"])
        else -999
    )

    # Return the final result
    # Percent values are multiplied by 100 before being cleaned
    return {
        "ticker": ticker,
        "strategies": {
            name: {
                "signal": metrics["signal"],
                "total_return": clean_float(metrics["total_return"] * 100),
                "sharpe_ratio": clean_float(metrics["sharpe_ratio"]),
                "max_drawdown": clean_float(metrics["max_drawdown"] * 100),
            }
            for name, metrics in strategies.items()
        },
        "best_strategy": best_strategy,
    }


# This block only runs when this file is executed directly.
# It will not run when this file is imported into another file.


#portfolio_summary(tickers) function that takes a list of stocks and returns a full portfolio level analysis combining all your functions
def portfolio_summary(tickers):
    # Store one summary row per ticker
    stock_rows = []

    # Track failed tickers separately
    errors = []

    for ticker in tickers:
        try:
            # Run full strategy comparison for this ticker
            result = compare_strategies(ticker)

            # Get the best strategy name
            best_strategy = result["best_strategy"]

            # Get the metrics for the best strategy
            best_metrics = result["strategies"][best_strategy]

            # Add one clean row for this stock
            stock_rows.append({
                "ticker": ticker,
                "best_strategy": best_strategy,
                "best_signal": best_metrics["signal"],
                "best_total_return": best_metrics["total_return"],
                "best_sharpe_ratio": best_metrics["sharpe_ratio"],
                "best_max_drawdown": best_metrics["max_drawdown"],

                # Include all strategy Sharpe ratios for comparison
                "momentum_sharpe": result["strategies"]["Momentum"]["sharpe_ratio"],
                "mean_reversion_sharpe": result["strategies"]["Mean Reversion"]["sharpe_ratio"],
                "buy_hold_sharpe": result["strategies"]["Buy and Hold"]["sharpe_ratio"],

                # Include all strategy returns for comparison
                "momentum_return": result["strategies"]["Momentum"]["total_return"],
                "mean_reversion_return": result["strategies"]["Mean Reversion"]["total_return"],
                "buy_hold_return": result["strategies"]["Buy and Hold"]["total_return"],
            })

        except Exception as e:
            # If one ticker fails, do not crash the whole portfolio summary
            errors.append({
                "ticker": ticker,
                "error": str(e)
            })

    # Convert stock results into a DataFrame
    stocks_df = pd.DataFrame(stock_rows)

    # If no stocks worked, return empty results safely
    if stocks_df.empty:
        return {
            "stocks": stocks_df,
            "portfolio_metrics": {
                "num_stocks": 0,
                "num_errors": len(errors),
                "best_overall_ticker": None,
                "best_overall_strategy": None,
                "average_best_sharpe": None,
                "average_best_return": None,
                "average_best_drawdown": None,
            },
            "errors": errors
        }

    # Sort by best Sharpe ratio, highest first
    stocks_df = stocks_df.sort_values(
        by="best_sharpe_ratio",
        ascending=False,
        na_position="last"
    ).reset_index(drop=True)

    # Get the top row after sorting
    top_stock = stocks_df.iloc[0]

    # Count how many times each strategy was selected as best
    strategy_counts = stocks_df["best_strategy"].value_counts().to_dict()

    # Build portfolio-level metrics
    portfolio_metrics = {
        "num_stocks": len(stocks_df),
        "num_errors": len(errors),
        "best_overall_ticker": top_stock["ticker"],
        "best_overall_strategy": top_stock["best_strategy"],
        "best_overall_sharpe": top_stock["best_sharpe_ratio"],
        "average_best_sharpe": round(stocks_df["best_sharpe_ratio"].mean(), 2),
        "average_best_return": round(stocks_df["best_total_return"].mean(), 2),
        "average_best_drawdown": round(stocks_df["best_max_drawdown"].mean(), 2),
        "strategy_counts": strategy_counts,
    }

    return {
        "stocks": stocks_df,
        "portfolio_metrics": portfolio_metrics,
        "errors": errors
    }




if __name__ == "__main__":
    summary = portfolio_summary(["AAPL", "NVDA", "TSLA", "MSFT", "AMD"])

    print("\nSTOCK RESULTS")
    print(summary["stocks"])

    print("\nPORTFOLIO METRICS")
    print(summary["portfolio_metrics"])

    print("\nERRORS")
    print(summary["errors"])

    assert "stocks" in summary
    assert "portfolio_metrics" in summary
    assert "errors" in summary

    assert not summary["stocks"].empty
    assert "best_strategy" in summary["stocks"].columns
    assert "best_sharpe_ratio" in summary["stocks"].columns

    print("\nportfolio_summary PASSED")






# Right now we have only 3 stragties in the compare statgeies. I shall come back and add more stragties. these stratgies are going to be more complicated.
#The file works, it is best to finish it all than to come back and make it more complicated and messy. I want to make sure the basic structure is solid before I add more complexity. I will add more strategies in the future, but for now I want to focus on making sure the current code is clean and well tested.
