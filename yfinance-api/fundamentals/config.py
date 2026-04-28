import os

# ==============================
# BASE PATHS
# ==============================
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "fundamentals")

os.makedirs(DATA_DIR, exist_ok=True)

# ==============================
# SETTINGS
# ==============================
TICKERS = ["AAPL", "MSFT", "INTC", "GOOGL", "NFLX"]

# 3 meses
MAX_AGE_SECONDS = 60 * 60 * 24 * 90