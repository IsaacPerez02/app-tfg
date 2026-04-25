"""
Enrichment pipeline.

Flow:
  Kafka raw_news
  → download article HTML (trafilatura)
  → validate (min length, not paywalled)
  → publish EnrichedNews to Kafka enriched_news
"""

import json
import logging
from datetime import datetime, timezone

import trafilatura
from confluent_kafka import Consumer, KafkaException, Producer

from config import ENRICHED_TOPIC, KAFKA_BROKER, RAW_TOPIC

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MIN_TEXT_LEN = 150
MAX_TEXT_LEN = 8000

JUNK_PHRASES = [
    "subscribe to read", "sign in to read", "paywall",
    "javascript is required", "enable javascript", "cookies required",
]


def _build_consumer() -> Consumer:
    c = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id": "enricher-group",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })
    c.subscribe([RAW_TOPIC])
    return c


def _build_producer() -> Producer:
    return Producer({
        "bootstrap.servers": KAFKA_BROKER,
        "retries": 3,
        "acks": "all",
    })


def _clean(text: str) -> str:
    return " ".join(text.split())


def _is_junk(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in JUNK_PHRASES)


def fetch_article(url: str) -> tuple[str, str] | tuple[None, None]:
    """Download and parse an article with trafilatura. Returns (title, text) or (None, None)."""
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None, None
        result = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=False,
            output_format="json",
            with_metadata=True,
        )
        if not result:
            return None, None
        import json as _json
        data = _json.loads(result)
        title = (data.get("title") or "").strip()
        text = _clean(data.get("text") or "")
        return title, text
    except Exception:
        return None, None


def enrich(raw: dict) -> dict | None:
    """Enrich a raw news item. Returns enriched dict or None if article is unusable."""
    url = raw.get("url", "")
    if not url:
        return None

    title, text = fetch_article(url)

    if not text or len(text) < MIN_TEXT_LEN:
        return None
    if _is_junk(text):
        return None

    summary = text[:500] if len(text) > 500 else text
    text_trimmed = text[:MAX_TEXT_LEN]

    return {
        "date": raw.get("date", datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")),
        "title": title or url,
        "text": text_trimmed,
        "summary": summary,
        "url": url,
        "source": raw.get("source", ""),
        "tickers": raw.get("tickers", []),
        "persons": raw.get("persons", []),
        "organizations": raw.get("organizations", []),
        "tags": raw.get("tags", []),
        "sentiment": raw.get("sentiment", 0.0),
        "importance_score": 0.0,
    }


def run() -> None:
    consumer = _build_consumer()
    producer = _build_producer()
    log.info("Enricher listening on '%s'…", RAW_TOPIC)

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())

            raw = json.loads(msg.value().decode("utf-8"))
            try:
                enriched = enrich(raw)
                if enriched:
                    producer.produce(ENRICHED_TOPIC, value=json.dumps(enriched).encode("utf-8"))
                    producer.poll(0)
                    log.info("✔ enriched: %s", enriched["url"][:80])
            except Exception as e:
                log.warning("Failed to enrich %s: %s", raw.get("url", "?"), e)
    finally:
        consumer.close()
        producer.flush()


if __name__ == "__main__":
    run()
