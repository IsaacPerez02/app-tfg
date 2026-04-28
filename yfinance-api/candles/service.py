import pandas as pd
from datetime import datetime, timezone

from .config import BOOTSTRAP_PARAMS
from .storage import read_csv, write_csv, file_path
from .downloader import download_data
from .aggregator import aggregate_intraday, build_4h

# ==============================
# BOOTSTRAP
# ==============================
def bootstrap_ticker(ticker: str):
    print(f"[BOOTSTRAP] {ticker}")

    for tf, params in BOOTSTRAP_PARAMS.items():
        path = file_path(ticker, tf)
        existing = read_csv(path)

        try:
            df = download_data(ticker, **params)

            if df is None:
                print(f"  ✖ {tf} empty")
                continue

            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

            if existing is not None and not existing.empty:
                combined = pd.concat([existing, df], ignore_index=True)
                combined = combined.drop_duplicates(subset=["timestamp"])
                combined = combined.sort_values("timestamp")
            else:
                combined = df

            write_csv(combined, path)
            print(f"  ✔ {tf} rows={len(combined)}")

        except Exception as e:
            print(f"  ✖ {tf} error: {e}")

    build_4h(ticker)

# ==============================
# UPDATE 1M
# ==============================
def update_1m(ticker: str):
    path = file_path(ticker, "1m")

    df = download_data(ticker, interval="1m", period="1d")

    if df is None:
        return

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    existing = read_csv(path)

    if existing is not None and not existing.empty:
        combined = pd.concat([existing, df], ignore_index=True)
        combined = combined.drop_duplicates(subset=["timestamp"])
        combined = combined.sort_values("timestamp")
    else:
        combined = df

    write_csv(combined, path)

# ==============================
# PIPELINE
# ==============================
def update_pipeline(ticker: str):
    update_1m(ticker)
    aggregate_intraday(ticker)

# ==============================
# MARKET TIME
# ==============================
def get_market_time(ticker: str):
    import yfinance as yf

    data = yf.Ticker(ticker)
    hist = data.history(period="1d", interval="1m")

    if hist.empty:
        return None

    last_ts = hist.index[-1].to_pydatetime()
    now_utc = datetime.now(timezone.utc)

    return {
        "ticker": ticker,
        "last_yahoo_candle_time_utc": last_ts.isoformat(),
        "server_time_utc": now_utc.isoformat(),
        "delay_seconds": (now_utc - last_ts).total_seconds()
    }