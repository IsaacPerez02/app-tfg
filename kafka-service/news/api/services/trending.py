"""
Trending ticker engine backed by MongoDB aggregation.

trending_score = volume_weight + sentiment_spike + recency_boost

- volume_weight:   normalised mention count in window
- sentiment_spike: abs(avg_sentiment) — extreme sentiment drives trends
- recency_boost:   ratio of mentions in inner window vs outer window
                   (acceleration signal)
"""

from datetime import datetime, timedelta, timezone

import motor.motor_asyncio

WINDOW_HOURS = {"1h": 1, "6h": 6, "24h": 24}
DEFAULT_WINDOW = "24h"
TOP_N = 20


async def get_trending(
    col: motor.motor_asyncio.AsyncIOMotorCollection,
    window: str = DEFAULT_WINDOW,
) -> list[dict]:
    hours = WINDOW_HOURS.get(window, 24)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    inner_cutoff = now - timedelta(hours=max(1, hours // 6))

    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$unwind": "$tickers"},
        {
            "$group": {
                "_id": "$tickers",
                "mention_count": {"$sum": 1},
                "avg_sentiment": {"$avg": "$sentiment"},
                "recent_mentions": {
                    "$sum": {
                        "$cond": [{"$gte": ["$created_at", inner_cutoff]}, 1, 0]
                    }
                },
            }
        },
        {"$match": {"mention_count": {"$gte": 2}}},
        {
            "$addFields": {
                "volume_weight": {"$ln": {"$add": ["$mention_count", 1]}},
                "sentiment_spike": {"$abs": "$avg_sentiment"},
                "acceleration": {
                    "$cond": [
                        {"$gt": ["$mention_count", 0]},
                        {
                            "$divide": [
                                "$recent_mentions",
                                {"$divide": ["$mention_count", {"$literal": hours}]},
                            ]
                        },
                        0,
                    ]
                },
            }
        },
        {
            "$addFields": {
                "trending_score": {
                    "$add": [
                        {"$multiply": ["$volume_weight", 0.5]},
                        {"$multiply": ["$sentiment_spike", 0.3]},
                        {
                            "$multiply": [
                                {"$min": [{"$divide": ["$acceleration", 10]}, 1.0]},
                                0.2,
                            ]
                        },
                    ]
                }
            }
        },
        {"$sort": {"trending_score": -1}},
        {"$limit": TOP_N},
        {
            "$project": {
                "_id": 0,
                "ticker": "$_id",
                "mention_count": 1,
                "avg_sentiment": {"$round": ["$avg_sentiment", 4]},
                "recent_mentions": 1,
                "acceleration": {"$round": ["$acceleration", 2]},
                "trending_score": {"$round": ["$trending_score", 4]},
            }
        },
    ]

    cursor = col.aggregate(pipeline)
    return await cursor.to_list(length=TOP_N)
