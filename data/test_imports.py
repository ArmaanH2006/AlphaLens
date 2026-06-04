# This file checks that all project files import correctly.
# If there is a circular import or bad import, this file will fail.

print("Testing imports...")

from stock_data import get_stock_data
print("stock_data.py imported successfully")

from indicators import get_indicators, analyze_stock, compare_stocks, clean_float
print("indicators.py imported successfully")

from recommendation import recommend
print("recommendation.py imported successfully")

from strategy import compare_strategies, portfolio_summary
print("strategy.py imported successfully")

print("All imports passed")