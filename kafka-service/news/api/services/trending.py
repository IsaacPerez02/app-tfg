"""
Trending ticker engine — pure in-memory, no MongoDB dependency.
"""

import math
from datetime import datetime, timedelta, timezone

WINDOW_HOURS = {"1h": 1, "6h": 6, "24h": 24}
DEFAULT_WINDOW = "24h"
TOP_N = 20


def _parse_created_at(doc: dict) -> datetime | None:
    ca = doc.get("created_at")
    if isinstance(ca, datetime):
        return ca.replace(tzinfo=timezone.utc) if ca.tzinfo is None else ca
    if isinstance(ca, str):
        try:
            return datetime.fromisoformat(ca)
        except Exception:
            pass
    return None


def get_trending(articles: list[dict], window: str = DEFAULT_WINDOW) -> list[dict]:
    hours       = WINDOW_HOURS.get(window, 24)
    now         = datetime.now(timezone.utc)
    cutoff      = now - timedelta(hours=hours)
    inner_cutoff = now - timedelta(hours=max(1, hours // 6))

    ticker_stats: dict[str, dict] = {}

    for article in articles:
        ca = _parse_created_at(article)
        if ca is None or ca < cutoff:
            continue
        for ticker in article.get("tickers", []):
            s = ticker_stats.setdefault(ticker, {
                "mention_count":   0,
                "sentiments":      [],
                "recent_mentions": 0,
            })
            s["mention_count"] += 1
            s["sentiments"].append(article.get("sentiment", 0.0))
            if ca >= inner_cutoff:
                s["recent_mentions"] += 1

    results = []
    for ticker, s in ticker_stats.items():
        if s["mention_count"] < 2:
            continue
        avg_sent       = sum(s["sentiments"]) / len(s["sentiments"])
        volume_weight  = math.log(s["mention_count"] + 1)
        sentiment_spike = abs(avg_sent)
        accel = (
            s["recent_mentions"] / (s["mention_count"] / hours)
            if s["mention_count"] > 0 else 0.0
        )
        trending_score = round(
            volume_weight * 0.5 + sentiment_spike * 0.3 + min(accel / 10, 1.0) * 0.2,
            4,
        )
        results.append({
            "ticker":         ticker,
            "mention_count":  s["mention_count"],
            "avg_sentiment":  round(avg_sent, 4),
            "recent_mentions": s["recent_mentions"],
            "acceleration":   round(accel, 2),
            "trending_score": trending_score,
        })

    results.sort(key=lambda r: r["trending_score"], reverse=True)
    return results[:TOP_N]
