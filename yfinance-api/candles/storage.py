import os
import pandas as pd
from typing import Optional

from .config import DATA_DIR

# ==============================
# PATHS
# ==============================
def ticker_dir(ticker: str):
    path = os.path.join(DATA_DIR, ticker)
    os.makedirs(path, exist_ok=True)
    return path

def file_path(ticker: str, tf: str):
    return os.path.join(ticker_dir(ticker), f"{tf}.csv")

# ==============================
# CSV IO
# ==============================
def read_csv(path: str) -> Optional[pd.DataFrame]:
    if not os.path.exists(path):
        return None

    df = pd.read_csv(path)

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    return df

def write_csv(df: pd.DataFrame, path: str):
    df.to_csv(path, index=False)