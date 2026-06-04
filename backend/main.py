from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import sys
from pathlib import Path

# Make the data folder importable from backend/main.py
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
sys.path.append(str(DATA_DIR))

from indicators import analyze_stock, compare_stocks
from recommendation import recommend
from strategy import compare_strategies, portfolio_summary


app = FastAPI(
    title="AlphaLens API",
    description="Backend API for stock analysis, recommendations, and strategy comparison.",
    version="1.0.0"
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "AlphaLens backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@app.get("/analyze/{ticker}")
def analyze_endpoint(ticker: str):
    try:
        return analyze_stock(ticker.upper())
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not analyze {ticker.upper()}: {str(e)}"
        )


@app.get("/recommend/{ticker}")
def recommend_endpoint(ticker: str):
    try:
        return recommend(ticker.upper())
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not recommend {ticker.upper()}: {str(e)}"
        )


@app.get("/strategies/{ticker}")
def strategies_endpoint(ticker: str):
    try:
        return compare_strategies(ticker.upper())
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not compare strategies for {ticker.upper()}: {str(e)}"
        )


@app.get("/compare")
def compare_endpoint(tickers: str = Query(..., description="Comma-separated tickers like AAPL,NVDA,TSLA")):
    try:
        ticker_list = [ticker.strip().upper() for ticker in tickers.split(",") if ticker.strip()]

        if not ticker_list:
            raise ValueError("Please provide at least one ticker.")

        df = compare_stocks(ticker_list)

        return {
            "tickers": ticker_list,
            "results": df.to_dict(orient="records")
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not compare stocks: {str(e)}"
        )


@app.get("/portfolio")
def portfolio_endpoint(tickers: str = Query(..., description="Comma-separated tickers like AAPL,NVDA,TSLA")):
    try:
        ticker_list = [ticker.strip().upper() for ticker in tickers.split(",") if ticker.strip()]

        if not ticker_list:
            raise ValueError("Please provide at least one ticker.")

        summary = portfolio_summary(ticker_list)

        return {
            "tickers": ticker_list,
            "stocks": summary["stocks"].to_dict(orient="records"),
            "portfolio_metrics": summary["portfolio_metrics"],
            "errors": summary["errors"],
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not build portfolio summary: {str(e)}"
        )