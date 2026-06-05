from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import sys
import time
from pathlib import Path


# Make the data folder importable from backend/main.py
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
sys.path.insert(0, str(DATA_DIR))


from indicators import analyze_stock, compare_stocks
from recommendation import recommend
from strategy import compare_strategies, portfolio_summary


# Hardcoded list of 20 stocks for the dashboard trending bar.
# Later, this can be replaced with a dynamic trending stock source.
TRENDING_TICKERS = [
    "AAPL", "MSFT", "NVDA", "TSLA", "AMD",
    "GOOGL", "AMZN", "META", "NFLX", "AVGO",
    "JPM", "V", "MA", "UNH", "LLY",
    "COST", "WMT", "HD", "SPY", "QQQ"
]


# Valid yfinance periods.
# This helper is ready for future endpoints that accept a period parameter.
VALID_PERIODS = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]


def validate_ticker(ticker: str):
    """
    Cleans and validates a ticker symbol.
    Converts lowercase tickers to uppercase.
    Allows letters, numbers, dots, and hyphens.
    """
    ticker = ticker.strip().upper()

    if not ticker:
        raise HTTPException(
            status_code=400,
            detail="Ticker cannot be empty."
        )

    if not ticker.replace(".", "").replace("-", "").isalnum():
        raise HTTPException(
            status_code=400,
            detail="Ticker can only contain letters, numbers, dots, or hyphens."
        )

    return ticker


def validate_period(period: str):
    """
    Validates a yfinance period string.
    """
    period = period.strip().lower()

    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period. Valid periods are: {', '.join(VALID_PERIODS)}"
        )

    return period


app = FastAPI(
    title="AlphaLens API",
    description="Backend API for stock analysis, recommendations, and strategy comparison.",
    version="1.0.0"
)


# Frontend URLs that are allowed to call this backend.
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# Enable CORS so the frontend can communicate with this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Logs response time for every request.
# Also adds X-Process-Time-ms to the response headers.
@app.middleware("http")
async def log_response_time(request, call_next):
    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time
    process_time_ms = round(process_time * 1000, 2)

    print(
        f"{request.method} {request.url.path} "
        f"completed in {process_time_ms}ms "
        f"with status {response.status_code}"
    )

    response.headers["X-Process-Time-ms"] = str(process_time_ms)

    return response


@app.get("/")
def root():
    return {
        "message": "AlphaLens backend is running"
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "AlphaLens API is healthy and ready to serve requests."
    }


@app.get("/api/trending")
def trending_endpoint():
    """
    Checks a predefined list of 20 stocks and returns only the BUY recommendations.
    This can power a trending bar on the dashboard.
    """
    buy_signals = []
    errors = []

    for ticker in TRENDING_TICKERS:
        try:
            result = recommend(ticker)

            if result.get("label") == "BUY":
                buy_signals.append({
                    "ticker": result.get("ticker"),
                    "score": result.get("score"),
                    "label": result.get("label"),
                    "reasoning": result.get("reasoning")
                })

        except Exception as e:
            errors.append({
                "ticker": ticker,
                "error": str(e)
            })

    return {
        "count": len(buy_signals),
        "tickers_checked": TRENDING_TICKERS,
        "buy_signals": buy_signals,
        "errors": errors
    }


@app.get("/analyze/{ticker}")
def analyze_endpoint(ticker: str):
    try:
        ticker = validate_ticker(ticker)
        return analyze_stock(ticker)

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not analyze {ticker}: {str(e)}"
        )


@app.get("/recommend/{ticker}")
def recommend_endpoint(ticker: str):
    try:
        ticker = validate_ticker(ticker)
        return recommend(ticker)

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not recommend {ticker}: {str(e)}"
        )


@app.get("/strategies/{ticker}")
def strategies_endpoint(ticker: str):
    try:
        ticker = validate_ticker(ticker)
        return compare_strategies(ticker)

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not compare strategies for {ticker}: {str(e)}"
        )


@app.get("/compare")
def compare_endpoint(
    tickers: str = Query(..., description="Comma-separated tickers like AAPL,NVDA,TSLA")
):
    try:
        ticker_list = [
            validate_ticker(ticker)
            for ticker in tickers.split(",")
            if ticker.strip()
        ]

        if not ticker_list:
            raise ValueError("Please provide at least one ticker.")

        df = compare_stocks(ticker_list)

        return {
            "tickers": ticker_list,
            "results": df.to_dict(orient="records")
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not compare stocks: {str(e)}"
        )


@app.get("/portfolio")
def portfolio_endpoint(
    tickers: str = Query(..., description="Comma-separated tickers like AAPL,NVDA,TSLA")
):
    try:
        ticker_list = [
            validate_ticker(ticker)
            for ticker in tickers.split(",")
            if ticker.strip()
        ]

        if not ticker_list:
            raise ValueError("Please provide at least one ticker.")

        summary = portfolio_summary(ticker_list)

        return {
            "tickers": ticker_list,
            "stocks": summary["stocks"].to_dict(orient="records"),
            "portfolio_metrics": summary["portfolio_metrics"],
            "errors": summary["errors"],
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not build portfolio summary: {str(e)}"
        )