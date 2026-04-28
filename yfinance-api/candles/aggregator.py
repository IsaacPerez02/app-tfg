import pandas as pd

from .storage import read_csv, write_csv, file_path
from .config import RESAMPLE_RULES

# ==============================
# GENERIC RESAMPLE
# ==============================
def resample_df(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    df = df.set_index("timestamp").sort_index()

    agg = df.resample(rule).agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum"
    }).dropna()

    return agg.reset_index()

# ==============================
# BUILD 4H FROM 1H
# ==============================
def build_4h(ticker: str):
    src = file_path(ticker, "1h")
    dst = file_path(ticker, "4h")

    df = read_csv(src)
    if df is None:
        return

    agg = resample_df(df, "4h")
    write_csv(agg, dst)

# ==============================
# INTRADAY AGGREGATION
# ==============================
def aggregate_intraday(ticker: str):
    path = file_path(ticker, "1m")
    df = read_csv(path)

    if df is None:
        return

    for tf, rule in RESAMPLE_RULES.items():
        agg = resample_df(df, rule)
        write_csv(agg, file_path(ticker, tf))