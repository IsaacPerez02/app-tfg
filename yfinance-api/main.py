import asyncio
import os
import math
from datetime import datetime, timezone
from typing import Dict

import pandas as pd
from fastapi import FastAPI, HTTPException

from candles import (
    bootstrap_ticker,
    update_pipeline,
    get_market_time
)
from candles.config import TICKERS, BOOTSTRAP_PARAMS
from candles.storage import file_path

from fundamentals import get_fundamentals

app = FastAPI(title="yfinance-api")

# ==============================
# INTERNAL STATE
# ==============================
STATE: Dict[str, str] = {
    "status": "starting",
    "last_tick": None
}

# ==============================
# UTILS
# ==============================
def validate_ticker(ticker: str):
    if ticker not in TICKERS:
        raise HTTPException(status_code=404, detail="Unknown ticker")

def validate_tf(tf: str):
    valid = list(BOOTSTRAP_PARAMS.keys()) + ["4h"]
    if tf not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid timeframe: {tf}")

# ==============================
# LOOP ENGINE
# ==============================
async def wait_next():
    now = datetime.now(timezone.utc)
    wait = 60 - now.second
    if wait <= 0:
        wait += 60
    await asyncio.sleep(wait)

async def loop():
    while True:
        try:
            await wait_next()

            now = datetime.now(timezone.utc)
            print("[TICK]", now)

            for t in TICKERS:
                try:
                    update_pipeline(t)
                except Exception as e:
                    print(f"[ERROR][{t}]", e)

            STATE["last_tick"] = now.isoformat()

        except Exception as e:
            print("[LOOP ERROR]", e)
            await asyncio.sleep(5)

# ==============================
# BOOTSTRAP (NON-BLOCKING)
# ==============================
async def bootstrap_all():
    print("[BOOTSTRAP START]")

    for t in TICKERS:
        try:
            await asyncio.to_thread(bootstrap_ticker, t)
        except Exception as e:
            print(f"[BOOTSTRAP ERROR][{t}]", e)

    print("[BOOTSTRAP DONE]")

# ==============================
# STARTUP
# ==============================
@app.on_event("startup")
async def startup():
    asyncio.create_task(bootstrap_all())
    asyncio.create_task(loop())

    STATE["status"] = "running"
    print("[READY]")

# ==============================
# ROOT
# ==============================
@app.get("/")
def root():
    return {
        "service": "yfinance-api",
        "status": STATE["status"],
        "tickers": TICKERS
    }

# ==============================
# CANDLES
# ==============================
@app.get("/candles/{ticker}/{tf}")
def candles(ticker: str, tf: str):
    validate_ticker(ticker)
    validate_tf(tf)

    path = file_path(ticker, tf)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="No data")

    df = pd.read_csv(path)

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    return {
        "ticker": ticker,
        "timeframe": tf,
        "rows": len(df),
        "data": df.to_dict(orient="records")
    }

# ==============================
# META
# ==============================
@app.get("/tickers")
def list_tickers():
    return {
        "count": len(TICKERS),
        "tickers": TICKERS
    }

@app.get("/timeframes")
def list_timeframes():
    return {
        "timeframes": list(BOOTSTRAP_PARAMS.keys()) + ["4h"]
    }

# ==============================
# MARKET TIME
# ==============================
@app.get("/market-time/{ticker}")
def market_time(ticker: str):
    validate_ticker(ticker)

    try:
        data = get_market_time(ticker)

        if data is None:
            raise HTTPException(status_code=404, detail="No market data")

        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# FUNDAMENTALS
# ==============================
def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    elif isinstance(obj, float) and math.isnan(obj):
        return None
    else:
        return obj

        
@app.get("/fundamentals/{ticker}")
def fundamentals(ticker: str):
    if ticker not in TICKERS:
        raise HTTPException(status_code=404, detail="Unknown ticker")

    try:
        data = get_fundamentals(ticker)

        clean_data = clean_nan(data)

        return {
            "ticker": ticker,
            "data": clean_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# HEALTH / STATUS
# ==============================
@app.get("/health")
def health():
    return {
        "status": STATE["status"],
        "last_tick": STATE["last_tick"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }