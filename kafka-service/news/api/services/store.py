"""
In-memory news article store. Thread-safe. Populated by the API's background Kafka consumer.
Deduplicates by URL hash (_id) and normalised title.
"""

import hashlib
import math
import re
import threading
import unicodedata
from datetime import datetime, timezone

_lock:    threading.Lock    = threading.Lock()
_articles: dict[str, dict] = {}   # _id → article dict
_title_norms: set[str]     = set() # fast title dedup

MAX_ARTICLES = 5000


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:24]


def _normalise_title(title: str) -> str:
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    t = re.sub(r"[^\w\s]", "", t).lower()
    return " ".join(t.split())


def _compute_importance(doc: dict) -> float:
    from config import RECENCY_TAU_HOURS
    try:
        dt = datetime.strptime(doc.get("date", "")[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
        hours_old = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600)
        decay = math.exp(-hours_old / RECENCY_TAU_HOURS)
    except Exception:
        decay = 0.5
    sentiment = abs(doc.get("sentiment", 0.0)) * 1.5
    tickers   = min(len(doc.get("tickers", [])) * 2.0, 6.0)
    entities  = min((len(doc.get("persons", [])) + len(doc.get("organizations", []))) * 0.5, 3.0)
    return round((sentiment + tickers + entities) * decay, 4)


def ingest(raw: dict) -> None:
    url = raw.get("url", "")
    if not url:
        return
    doc_id     = _url_hash(url)
    title_norm = _normalise_title(raw.get("title", ""))

    with _lock:
        if doc_id in _articles:
            return
        if title_norm and title_norm in _title_norms:
            return

        score = _compute_importance(raw)
        doc = {
            "_id":            doc_id,
            "date":           raw.get("date", ""),
            "title":          raw.get("title", ""),
            "title_norm":     title_norm,
            "text":           raw.get("text", ""),
            "summary":        raw.get("summary", ""),
            "url":            url,
            "source":         raw.get("source", ""),
            "tickers":        raw.get("tickers", []),
            "persons":        raw.get("persons", []),
            "organizations":  raw.get("organizations", []),
            "themes":         raw.get("tags", raw.get("themes", [])),
            "sentiment":      raw.get("sentiment", 0.0),
            "importance_score": score,
            "created_at":     datetime.now(timezone.utc),
        }
        _articles[doc_id] = doc
        if title_norm:
            _title_norms.add(title_norm)

        # Trim oldest by date when over limit
        if len(_articles) > MAX_ARTICLES:
            oldest_id = min(_articles, key=lambda k: _articles[k]["date"])
            old = _articles.pop(oldest_id)
            _title_norms.discard(old.get("title_norm", ""))


def get_articles(
    ticker:  str | None = None,
    sort_by: str        = "date",
    limit:   int        = 20,
    skip:    int        = 0,
) -> list[dict]:
    with _lock:
        items = list(_articles.values())
    if ticker:
        items = [a for a in items if ticker in a.get("tickers", [])]
    items.sort(key=lambda a: a.get(sort_by, ""), reverse=True)
    return items[skip: skip + limit]


def get_article_by_id(doc_id: str) -> dict | None:
    with _lock:
        return _articles.get(doc_id)


def count_articles() -> int:
    with _lock:
        return len(_articles)


def get_all_articles() -> list[dict]:
    with _lock:
        return list(_articles.values())
