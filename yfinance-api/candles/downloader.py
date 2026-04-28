import pandas as pd
import yfinance as yf
from typing import Optional

# ==============================
# NORMALIZE
# ==============================
def normalize_df(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    if df is None or df.empty:
        return None

    df = df.copy()

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    return df

# ==============================
# OHLCV
# ==============================
def df_to_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    df = df.reset_index()
    ts_col = df.columns[0]

    return pd.DataFrame({
        "timestamp": df[ts_col],
        "open": df["Open"].values,
        "high": df["High"].values,
        "low": df["Low"].values,
        "close": df["Close"].values,
        "volume": df["Volume"].values,
    })

# ==============================
# DOWNLOAD
# ==============================
def download_data(ticker: str, **params) -> Optional[pd.DataFrame]:
    df = yf.download(
        tickers=ticker,
        progress=False,
        **params
    )

    df = normalize_df(df)

    if df is None:
        return None

    return df_to_ohlcv(df)