"""
Market Data API — stateless, Kafka-backed in-memory store.

Endpoints:
  GET /tickers                                       → live ticker summaries
  GET /candles?ticker=AAPL&timeframe=1m&limit=100    → latest candles
  GET /candles/{ticker}/{timeframe}                  → candles for ticker+tf
  GET /candles/{ticker}                              → candles for ticker (default 1m)
  GET /latest/{ticker}?timeframe=1m                  → most recent candle
  GET /health                                        → liveness + candle count
"""

import json
import logging
import threading
from datetime import datetime
from typing import Optional

from confluent_kafka import Consumer, KafkaError
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import AGG_CANDLES_TOPIC, KAFKA_BROKER, RAW_CANDLES_TOPIC, TICKER_METADATA, TICKERS, TIMEFRAMES
import services.candles as store
import services.indicators as store_indicators

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ALL_TIMEFRAMES = ["1m"] + TIMEFRAMES


def _kafka_consumer_loop() -> None:
    consumer = Consumer({
        "bootstrap.servers":  KAFKA_BROKER,
        "group.id":           "data-api-consumer-v2",  # FIX: clears stale committed offsets; in-memory store rebuilds from earliest on every restart anyway
        "auto.offset.reset":  "earliest",
        "enable.auto.commit": False,
    })
    consumer.subscribe([RAW_CANDLES_TOPIC, AGG_CANDLES_TOPIC])
    log.info("API Kafka consumer started on [%s, %s]", RAW_CANDLES_TOPIC, AGG_CANDLES_TOPIC)
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                log.error("Kafka error: %s", msg.error())
                continue
            try:
                candle = json.loads(msg.value())
                store.ingest_candle(candle)
            except Exception as exc:
                log.error("Failed to ingest candle: %s", exc)
    finally:
        consumer.close()


app = FastAPI(title="Market Data API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    t = threading.Thread(target=_kafka_consumer_loop, daemon=True)
    t.start()
    log.info("Background Kafka consumer thread started")


# ── Tickers ────────────────────────────────────────────────────────────────

@app.get("/tickers")
def get_tickers() -> JSONResponse:
    summaries = store.get_ticker_summaries(TICKERS, TICKER_METADATA)
    return JSONResponse({"tickers": summaries, "count": len(summaries)})


# ── Candles ────────────────────────────────────────────────────────────────

@app.get("/candles")
def candles_query(
    ticker:    str                = Query("BTC-USD"),
    timeframe: str                = Query("1m"),
    limit:     int                = Query(100, ge=1, le=1000),
    start:     Optional[datetime] = Query(None),
    end:       Optional[datetime] = Query(None),
) -> JSONResponse:
    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)
    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}. Valid: {ALL_TIMEFRAMES}"}, status_code=400)
    data = store.get_candles(ticker, timeframe, limit, start, end)
    return JSONResponse({"ticker": ticker, "timeframe": timeframe, "count": len(data), "candles": data})


@app.get("/candles/{ticker}/{timeframe}")
def candles_by_ticker_tf(
    ticker:    str,
    timeframe: str,
    limit:     int                = Query(100, ge=1, le=1000),
    start:     Optional[datetime] = Query(None),
    end:       Optional[datetime] = Query(None),
) -> JSONResponse:
    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)
    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}. Valid: {ALL_TIMEFRAMES}"}, status_code=400)
    data = store.get_candles(ticker, timeframe, limit, start, end)
    return JSONResponse({"ticker": ticker, "timeframe": timeframe, "count": len(data), "candles": data})


@app.get("/candles/{ticker}")
def candles_by_ticker(
    ticker:    str,
    timeframe: str = Query("1m"),
    limit:     int = Query(100, ge=1, le=1000),
) -> JSONResponse:
    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)
    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}. Valid: {ALL_TIMEFRAMES}"}, status_code=400)
    data = store.get_candles(ticker, timeframe, limit)
    return JSONResponse({"ticker": ticker, "timeframe": timeframe, "count": len(data), "candles": data})


# ── Market Indicators ────────────────────────────────────────────────────────

@app.get("/market-indicators")
def indicators_query(
    ticker:    str = Query("BTC-USD"),
    timeframe: str = Query("1m"),
    limit:     int = Query(100, ge=1, le=1000),
    start:     Optional[datetime] = Query(None),
    end:       Optional[datetime] = Query(None),
) -> JSONResponse:

    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)

    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}"}, status_code=400)

    data = store_indicators.get_indicators(ticker, timeframe, limit, start, end)

    return JSONResponse({
        "ticker": ticker,
        "timeframe": timeframe,
        "count": len(data),
        "indicators": data,
    })


@app.get("/latest-indicators/{ticker}")
def latest_indicators(
    ticker: str,
    timeframe: str = Query("1m"),
) -> JSONResponse:

    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)

    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}"}, status_code=400)

    data = store_indicators.get_indicators(ticker, timeframe, limit=1)

    if not data:
        return JSONResponse({"ticker": ticker, "indicator": None})

    return JSONResponse({
        "ticker": ticker,
        "timeframe": timeframe,
        "indicator": data[-1],
    })


@app.get("/market-indicators/{ticker}/{timeframe}")
def indicators_by_ticker_tf(
    ticker:    str,
    timeframe: str,
    limit:     int = Query(100, ge=1, le=1000),
) -> JSONResponse:

    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)

    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}"}, status_code=400)

    data = store_indicators.get_indicators(ticker, timeframe, limit)

    return JSONResponse({
        "ticker": ticker,
        "timeframe": timeframe,
        "count": len(data),
        "indicators": data,
    })

# ── Candles & Market Indicators ──────────────────────────────────────────────────────── 

@app.get("/snapshot/{ticker}/{timeframe}")
def snapshot(
    ticker: str,
    timeframe: str,
    limit: int = Query(100, ge=1, le=1000),
) -> JSONResponse:

    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)

    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}"}, status_code=400)

    candles = store.get_candles(ticker, timeframe, limit)
    indicators = store_indicators.get_indicators(ticker, timeframe, limit)

    return JSONResponse({
        "ticker": ticker,
        "timeframe": timeframe,
        "candles_count": len(candles),
        "indicators_count": len(indicators),
        "candles": candles,
        "indicators": indicators,
    })
    

# ── Latest ─────────────────────────────────────────────────────────────────

@app.get("/latest/{ticker}")
def latest(
    ticker:    str,
    timeframe: str = Query("1m"),
) -> JSONResponse:
    if ticker not in TICKERS:
        return JSONResponse({"error": f"Unknown ticker: {ticker}"}, status_code=404)
    if timeframe not in ALL_TIMEFRAMES:
        return JSONResponse({"error": f"Unknown timeframe: {timeframe}. Valid: {ALL_TIMEFRAMES}"}, status_code=400)
    candle = store.get_latest_candle(ticker, timeframe)
    return JSONResponse({"ticker": ticker, "timeframe": timeframe, "candle": candle})


# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> JSONResponse:
    count = store.count_candles("1m")
    return JSONResponse({"status": "ok", "candles_1m": count})


@app.get("/health/indicators")
def health_indicators() -> JSONResponse:

    stats = {}

    for tf in ALL_TIMEFRAMES:
        stats[tf] = store.count_indicators(tf)

    return JSONResponse({
        "status": "ok",
        "indicators": stats,
    })