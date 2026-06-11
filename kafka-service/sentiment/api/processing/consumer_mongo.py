"""
MongoDB sink for sentiment-enriched articles.

Flow:
  Kafka sentiment_enriched
  → deduplicate via hash(url) as _id
  → upsert into MongoDB sentiment.sentiment_news
"""

import hashlib
import json
import logging
from datetime import datetime, timezone

from confluent_kafka import Consumer, KafkaException

from config import KAFKA_BROKER
from db.mongo import get_collection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SENTIMENT_TOPIC = "sentiment_enriched"


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:24]


def run() -> None:
    kafka = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id":           "sentiment-mongo-sink-group",
        "auto.offset.reset":  "earliest",
        "enable.auto.commit": True,
    })
    kafka.subscribe([SENTIMENT_TOPIC])

    col = get_collection()
    log.info("Sentiment Mongo sink listening on '%s'…", SENTIMENT_TOPIC)

    try:
        while True:
            msg = kafka.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())

            try:
                doc = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                log.warning("Deserialization error, skipping: %s", e)
                continue

            url = doc.get("url", "")
            if not url:
                continue

            doc_id = url_hash(url)
            record = {
                "_id":            doc_id,
                "date":           doc.get("date", ""),
                "title":          doc.get("title", ""),
                "text":           doc.get("text", ""),
                "summary":        doc.get("summary", ""),
                "url":            url,
                "source":         doc.get("source", ""),
                "tickers":        doc.get("tickers", []),
                "persons":        doc.get("persons", []),
                "organizations":  doc.get("organizations", []),
                "themes":         doc.get("tags", doc.get("themes", [])),
                "importance_score": doc.get("importance_score", 0.0),
                "sentiment":      doc.get("sentiment", {}),
                "created_at":     datetime.now(timezone.utc),
            }

            try:
                col.update_one(
                    {"_id": doc_id},
                    {"$setOnInsert": record},
                    upsert=True,
                )
                label = record["sentiment"].get("label", "?")
                score = record["sentiment"].get("score", 0.0)
                log.info("✔ saved [%s %.2f]: %s", label, score, url[:80])
            except Exception as e:
                log.error("MongoDB write error: %s", e)
    finally:
        kafka.close()


if __name__ == "__main__":
    run()
