"""
Sentiment Service — consumes enriched_news, runs FinBERT, stores to MongoDB.

Threads:
  consumer_enricher  — reads enriched_news, produces sentiment_enriched
  consumer_mongo     — reads sentiment_enriched, writes to MongoDB

Endpoints:
  GET /sentiment?mode=latest|top&limit=20&page=1&ticker=AAPL
  GET /sentiment/{id}
  GET /health
"""

import logging
import threading
from typing import Literal, Optional
from datetime import datetime

import pymongo
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import KAFKA_INPUT_TOPIC, MONGO_COLLECTION, MONGO_DB, MONGO_URI, THERMOMETER_PARQUET
from db.thermometer_cache import load_historical as load_thermometer_historical, get_daily_records
from services.thermometer import compute_thermometer
import processing.consumer_enricher as enricher
import processing.consumer_mongo as mongo_sink
import processing.consumer_thermometer as thermometer_consumer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="Sentiment Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_mongo: pymongo.MongoClient | None = None


def _col() -> pymongo.collection.Collection:
    global _mongo
    if _mongo is None:
        _mongo = pymongo.MongoClient(MONGO_URI)
    return _mongo[MONGO_DB][MONGO_COLLECTION]


@app.on_event("startup")
def startup() -> None:
    # Load thermometer historical data
    if load_thermometer_historical(THERMOMETER_PARQUET):
        log.info("Thermometer cache loaded successfully")
    else:
        log.warning("Failed to load thermometer cache from %s", THERMOMETER_PARQUET)

    threading.Thread(target=enricher.run, daemon=True, name="enricher").start()
    threading.Thread(target=mongo_sink.run, daemon=True, name="mongo-sink").start()
    threading.Thread(target=thermometer_consumer.run, daemon=True, name="thermometer").start()
    log.info("Sentiment enricher, Mongo sink, and thermometer consumer threads started")


# ── Feed ──────────────────────────────────────────────────────────────────────

@app.get("/sentiment")
def get_sentiment(
    mode:   Literal["latest", "top"] = Query("latest"),
    limit:  int                       = Query(20, ge=1, le=100),
    page:   int                       = Query(1, ge=1),
    ticker: Optional[str]             = Query(None),
):
    skip = (page - 1) * limit
    col = _col()

    query: dict = {}
    if ticker:
        query["tickers"] = ticker.upper()

    sort_field = "date" if mode == "latest" else "importance_score"

    docs = list(
        col.find(query, {"_id": 1, "date": 1, "title": 1, "text": 1, "summary": 1,
                         "url": 1, "source": 1, "tickers": 1, "persons": 1,
                         "organizations": 1, "themes": 1, "importance_score": 1,
                         "sentiment": 1, "created_at": 1})
           .sort(sort_field, pymongo.DESCENDING)
           .skip(skip)
           .limit(limit)
    )

    for d in docs:
        if "created_at" in d and d["created_at"] is not None:
            d["created_at"] = d["created_at"].isoformat()

    return docs


# ── Detail ────────────────────────────────────────────────────────────────────

@app.get("/sentiment/{doc_id}")
def get_sentiment_by_id(doc_id: str):
    col = _col()
    doc = col.find_one({"_id": doc_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Article not found")
    if "created_at" in doc and doc["created_at"] is not None:
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


# ── Thermometer ──────────────────────────────────────────────────────────────

@app.get("/thermometer/latest")
def get_thermometer_latest() -> JSONResponse:
    """Get latest thermometer value for AAPL."""
    daily_records = get_daily_records()
    if not daily_records:
        return JSONResponse({"error": "Thermometer cache not loaded"}, status_code=503)

    # Latest daily record
    latest_daily = daily_records[-1]
    ref_date = datetime.fromisoformat(latest_daily["date"].isoformat())
    thermo = compute_thermometer(ref_date, daily_records)

    if not thermo:
        return JSONResponse({"error": "Failed to compute thermometer"}, status_code=500)

    return JSONResponse(thermo._asdict())


@app.get("/thermometer/history")
def get_thermometer_history(days: int = Query(30, ge=1, le=365)) -> JSONResponse:
    """Get thermometer history for last N days."""
    daily_records = get_daily_records()
    if not daily_records:
        return JSONResponse({"error": "Thermometer cache not loaded"}, status_code=503)

    results = []
    for daily in daily_records[-days:]:
        ref_date = datetime.fromisoformat(daily["date"].isoformat())
        thermo = compute_thermometer(ref_date, daily_records)
        if thermo:
            results.append(thermo._asdict())

    return JSONResponse({"count": len(results), "history": results})


@app.get("/thermometer/all")
def get_thermometer_all() -> JSONResponse:
    """Get all available thermometer data."""
    daily_records = get_daily_records()
    if not daily_records:
        return JSONResponse({"error": "Thermometer cache not loaded"}, status_code=503)

    results = []
    for daily in daily_records:
        ref_date = datetime.fromisoformat(daily["date"].isoformat())
        thermo = compute_thermometer(ref_date, daily_records)
        if thermo:
            results.append(thermo._asdict())

    return JSONResponse({"count": len(results), "history": results})


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> JSONResponse:
    try:
        count = _col().estimated_document_count()
    except Exception:
        count = -1
    daily_count = len(get_daily_records())
    return JSONResponse({"status": "ok", "articles": count, "thermometer_days": daily_count})
