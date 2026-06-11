"""
Sentiment enrichment pipeline.

Flow:
  Kafka enriched_news
  → run title + summary through FinBERT
  → publish enriched article JSON to Kafka sentiment_enriched topic
"""

import json
import logging

from confluent_kafka import Consumer, KafkaException, Producer

from config import KAFKA_BROKER, KAFKA_INPUT_TOPIC
from services.finbert import analyze

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SENTIMENT_TOPIC = "sentiment_enriched"


def _build_consumer() -> Consumer:
    c = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id":           "sentiment-enricher-group",
        "auto.offset.reset":  "earliest",
        "enable.auto.commit": True,
    })
    c.subscribe([KAFKA_INPUT_TOPIC])
    return c


def _build_producer() -> Producer:
    return Producer({
        "bootstrap.servers": KAFKA_BROKER,
        "retries": 3,
        "acks":    "all",
    })


def enrich(article: dict) -> dict | None:
    title   = article.get("title", "")
    summary = article.get("summary", "")
    text    = f"{title}. {summary}".strip()
    if not text:
        return None
    result = analyze(text)
    return {**article, "sentiment": result.model_dump()}


def run() -> None:
    consumer = _build_consumer()
    producer = _build_producer()
    log.info("Sentiment enricher listening on '%s'…", KAFKA_INPUT_TOPIC)

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())

            try:
                article = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                log.warning("Deserialization error, skipping: %s", e)
                continue

            try:
                enriched = enrich(article)
                if enriched:
                    producer.produce(SENTIMENT_TOPIC, value=json.dumps(enriched).encode("utf-8"))
                    producer.poll(0)
                    log.info("✔ sentiment[%s %.2f]: %s",
                             enriched["sentiment"]["label"],
                             enriched["sentiment"]["score"],
                             article.get("url", "")[:80])
            except Exception as e:
                log.warning("Failed to enrich %s: %s", article.get("url", "?"), e)
    finally:
        consumer.close()
        producer.flush()


if __name__ == "__main__":
    run()
