"""
News Feed API — stateless, MongoDB-backed.

Endpoints:
  GET /news?mode=top|latest&limit=50&ticker=INTC  → financial news feed
  GET /news/{id}                                   → single article by _id
  GET /trending?window=1h|6h|24h                  → trending tickers
  GET /health                                      → liveness + article count
"""

import logging
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db.mongo import create_indexes, get_collection
from schemas.news import NewsItem, TrendingTicker
from services.ranking import sort_by_score
from services.trending import get_trending

log = logging.getLogger(__name__)

app = FastAPI(title="News Feed API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tickers soportados — solo estos aparecen en queries de filtrado
ALLOWED_TICKERS = {
    "GOOGL", "MSFT", "NFLX", "META", "INTC", "AAPL", "WBD", "SBUX", "SQ",
    "ORCL", "QCOM", "FOX", "CHTR", "AMZN", "COST", "NVDA", "TSLA", "CMCSA",
    "PEP", "HON", "WBA", "CSCO", "MAR", "AMGN", "UBER",
}


@app.on_event("startup")
async def startup() -> None:
    await create_indexes()
    log.info("MongoDB indexes ready")


# ── Feed ──────────────────────────────────────────────────────────────────────

@app.get("/news", response_model=list[NewsItem])
async def get_news(
    mode:   Literal["top", "latest"] = Query("top"),
    limit:  int                       = Query(20, ge=1, le=100),
    page:   int                       = Query(1, ge=1),
    ticker: Optional[str]             = Query(None),
) -> list[NewsItem]:
    col  = get_collection()
    skip = (page - 1) * limit

    # Filtrado por ticker (ignora tickers no permitidos)
    query: dict = {}
    if ticker:
        ticker = ticker.upper()
        if ticker not in ALLOWED_TICKERS:
            return []
        query = {"tickers": ticker}

    if mode == "latest":
        cursor = col.find(query, {"title_norm": 0}).sort("date", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [NewsItem(**d) for d in docs]

    # mode == "top": pool para re-rank = siguiente ventana de limit*4 artículos
    pool = limit * 4
    cursor = col.find(query, {"title_norm": 0}).sort("importance_score", -1).skip(skip).limit(pool)
    docs = await cursor.to_list(length=pool)
    ranked = sort_by_score(docs)
    return [NewsItem(**d) for d in ranked[:limit]]


# ── Detalle ───────────────────────────────────────────────────────────────────

@app.get("/news/{news_id}", response_model=NewsItem)
async def get_news_by_id(news_id: str) -> NewsItem:
    col = get_collection()
    doc = await col.find_one({"_id": news_id}, {"title_norm": 0})
    if doc is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return NewsItem(**doc)

# ── Tickers ──────────────────────────────────────────────────────────────────

@app.get("/news/{ticker}", response_model=list[NewsItem])
async def get_news_by_ticker(
    ticker: str,
    mode:   Literal["top", "latest"] = Query("top"),
    limit:  int                       = Query(20, ge=1, le=100),
    page:   int                       = Query(1, ge=1),
) -> list[NewsItem]:
    """
    Obtiene noticias para un ticker específico.

    - mode="top"   → ordenado por importance_score (defecto)
    - mode="latest" → cronológico
    """
    col = get_collection()
    skip = (page - 1) * limit

    ticker = ticker.upper()
    if ticker not in ALLOWED_TICKERS:
        return []  # ticker not monitored

    query = {"tickers": ticker}

    if mode == "latest":
        # latest chronological
        cursor = col.find(query, {"title_norm": 0}).sort("date", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [NewsItem(**d) for d in docs]

    # mode == "top": rank by importance_score (sample pool)
    pool = limit * 4
    cursor = col.find(query, {"title_norm": 0}).sort("importance_score", -1).skip(skip).limit(pool)
    docs = await cursor.to_list(length=pool)
    ranked = sort_by_score(docs)
    return [NewsItem(**d) for d in ranked[:limit]]

# ── Trending ──────────────────────────────────────────────────────────────────

@app.get("/trending", response_model=list[TrendingTicker])
async def trending(
    window: Literal["1h", "6h", "24h"] = Query("24h"),
) -> list[TrendingTicker]:
    col = get_collection()
    results = await get_trending(col, window=window)
    return [TrendingTicker(**r) for r in results]


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> JSONResponse:
    col = get_collection()
    count = await col.estimated_document_count()
    return JSONResponse({"status": "ok", "articles": count})
