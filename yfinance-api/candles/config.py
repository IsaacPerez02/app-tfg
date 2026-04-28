import os
from typing import List

# ==============================
# GLOBAL CONFIG
# ==============================
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "candles")

os.makedirs(DATA_DIR, exist_ok=True)

TICKERS: List[str] = ["AAPL", "MSFT", "INTC", "GOOGL", "NFLX"]

BOOTSTRAP_PARAMS = {
    "1m":  {"interval": "1m",  "period": "7d"},
    "5m":  {"interval": "5m",  "period": "60d"},
    "15m": {"interval": "15m", "period": "60d"},
    "1h":  {"interval": "1h",  "period": "730d"},
    "4h":  {"interval": "1h",  "period": "730d"},
    "1d":  {"interval": "1d",  "period": "max"},
    "1wk": {"interval": "1wk", "period": "max"},
    "1mo": {"interval": "1mo", "period": "max"},
    "3mo": {"interval": "3mo", "period": "max"},
}

RESAMPLE_RULES = {
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
}