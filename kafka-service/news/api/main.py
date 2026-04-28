"""
News Feed API — stateless, Kafka-backed in-memory store.

Endpoints:
  GET /news?mode=top|latest&limit=20&ticker=INTC  → financial news feed
  GET /news/{id}                                   → single article by _id
  GET /trending?window=1h|6h|24h                  → trending tickers
  GET /health                                      → liveness + article count
"""

import json
import logging
import threading
from typing import Literal, Optional

from confluent_kafka import Consumer, KafkaError
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ENRICHED_TOPIC, KAFKA_BROKER
from schemas.news import NewsItem, TrendingTicker
from services.ranking import sort_by_score
from services.trending import get_trending
import services.store as store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ALLOWED_TICKERS = {
    "GOOGL", "MSFT", "NFLX", "META", "INTC", "AAPL", "WBD", "SBUX", "SQ",
    "ORCL", "QCOM", "FOX", "CHTR", "AMZN", "COST", "NVDA", "TSLA", "CMCSA",
    "PEP", "HON", "WBA", "CSCO", "MAR", "AMGN", "UBER",
}


def _kafka_consumer_loop() -> None:
    consumer = Consumer({
        "bootstrap.servers":  KAFKA_BROKER,
        "group.id":           "news-api-consumer",
        "auto.offset.reset":  "earliest",
        "enable.auto.commit": True,
    })
    consumer.subscribe([ENRICHED_TOPIC])
    log.info("News API Kafka consumer started on '%s'", ENRICHED_TOPIC)
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
                article = json.loads(msg.value().decode("utf-8"))
                store.ingest(article)
            except Exception as exc:
                log.error("Failed to ingest article: %s", exc)
    finally:
        consumer.close()


app = FastAPI(title="News Feed API")

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


# ── Feed ──────────────────────────────────────────────────────────────────────

@app.get("/news", response_model=list[NewsItem])
def get_news(
    mode:   Literal["top", "latest"] = Query("top"),
    limit:  int                       = Query(20, ge=1, le=100),
    page:   int                       = Query(1, ge=1),
    ticker: Optional[str]             = Query(None),
) -> list[NewsItem]:
    skip = (page - 1) * limit
    ticker_filter = None
    if ticker:
        ticker = ticker.upper()
        if ticker not in ALLOWED_TICKERS:
            return []
        ticker_filter = ticker

    if mode == "latest":
        docs = store.get_articles(ticker=ticker_filter, sort_by="date", limit=limit, skip=skip)
        return [NewsItem(**d) for d in docs]

    pool = limit * 4
    docs = store.get_articles(ticker=ticker_filter, sort_by="importance_score", limit=pool, skip=skip)
    ranked = sort_by_score(docs)
    return [NewsItem(**d) for d in ranked[:limit]]


# ── Detail ────────────────────────────────────────────────────────────────────

@app.get("/news/{news_id}", response_model=NewsItem)
def get_news_by_id(news_id: str) -> NewsItem:
    doc = store.get_article_by_id(news_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return NewsItem(**doc)


# ── Trending ──────────────────────────────────────────────────────────────────

@app.get("/trending", response_model=list[TrendingTicker])
def trending(
    window: Literal["1h", "6h", "24h"] = Query("24h"),
) -> list[TrendingTicker]:
    articles = store.get_all_articles()
    results  = get_trending(articles, window=window)
    return [TrendingTicker(**r) for r in results]


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "articles": store.count_articles()})
