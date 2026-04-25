"""
MongoDB sink consumer.

Flow:
  Kafka enriched_news
  → compute importance_score
  → deduplicate via hash(url) as _id
  → upsert into MongoDB news.articles
"""

import hashlib
import json
import logging
import re
import unicodedata
from datetime import datetime, timezone

import pymongo
from confluent_kafka import Consumer, KafkaException

from config import ENRICHED_TOPIC, KAFKA_BROKER, MONGO_COLLECTION, MONGO_DB, MONGO_URI, RECENCY_TAU_HOURS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

import math


# ── Importance scoring ────────────────────────────────────────────────────────

def _parse_date(date_str: str) -> datetime | None:
    try:
        return datetime.strptime(date_str[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _recency_decay(date_str: str) -> float:
    dt = _parse_date(date_str)
    if dt is None:
        return 0.5
    hours_old = max(0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600)
    return math.exp(-hours_old / RECENCY_TAU_HOURS)


def compute_importance(doc: dict) -> float:
    sentiment_weight = abs(doc.get("sentiment", 0.0)) * 1.5
    ticker_weight = min(len(doc.get("tickers", [])) * 2.0, 6.0)
    entity_weight = min(
        (len(doc.get("persons", [])) + len(doc.get("organizations", []))) * 0.5,
        3.0,
    )
    decay = _recency_decay(doc.get("date", ""))
    raw = sentiment_weight + ticker_weight + entity_weight
    return round(raw * decay, 4)


# ── Title normalisation (for duplicate detection) ─────────────────────────────

def _normalise_title(title: str) -> str:
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    t = re.sub(r"[^\w\s]", "", t).lower()
    return " ".join(t.split())


# ── URL hash (_id) ────────────────────────────────────────────────────────────

def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:24]


# ── Kafka consumer + MongoDB writer ───────────────────────────────────────────

def run() -> None:
    kafka = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id": "mongo-sink-group",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })
    kafka.subscribe([ENRICHED_TOPIC])

    mongo = pymongo.MongoClient(MONGO_URI)
    col = mongo[MONGO_DB][MONGO_COLLECTION]

    # Ensure indexes exist (idempotent)
    col.create_index("date")
    col.create_index("tickers")
    col.create_index("sentiment")
    col.create_index("importance_score")
    col.create_index("created_at")
    col.create_index("title_norm")   # for title-level dedup

    log.info("Mongo sink listening on '%s'…", ENRICHED_TOPIC)

    try:
        while True:
            msg = kafka.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())

            doc = json.loads(msg.value().decode("utf-8"))
            url = doc.get("url", "")
            if not url:
                continue

            doc_id = url_hash(url)
            title_norm = _normalise_title(doc.get("title", ""))

            # Level 2 dedup: skip if identical normalised title already in DB
            if col.find_one({"title_norm": title_norm, "_id": {"$ne": doc_id}}):
                log.debug("Duplicate title, skipping: %s", title_norm[:60])
                continue

            score = compute_importance(doc)

            record = {
                "_id": doc_id,
                "date": doc.get("date", ""),
                "title": doc.get("title", ""),
                "title_norm": title_norm,
                "text": doc.get("text", ""),
                "summary": doc.get("summary", ""),
                "url": url,
                "source": doc.get("source", ""),
                "tickers": doc.get("tickers", []),
                "persons": doc.get("persons", []),
                "organizations": doc.get("organizations", []),
                "themes": doc.get("tags", []),
                "sentiment": doc.get("sentiment", 0.0),
                "importance_score": score,
                "created_at": datetime.now(timezone.utc),
            }

            try:
                col.update_one(
                    {"_id": doc_id},
                    {"$setOnInsert": record},
                    upsert=True,
                )
                log.info("✔ saved: [%.2f] %s", score, url[:80])
            except Exception as e:
                log.error("MongoDB write error: %s", e)
    finally:
        kafka.close()


if __name__ == "__main__":
    run()
