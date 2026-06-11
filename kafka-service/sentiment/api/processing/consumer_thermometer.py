"""
Thermometer consumer — aggregates daily sentiment, computes thermometer, publishes to Kafka.

Flow:
  sentiment_enriched → daily aggregation → thermometer calculation
  → topic: sentiment.thermometer.AAPL → MongoDB
"""

import json
import logging
from datetime import datetime
from collections import defaultdict

from confluent_kafka import Consumer, KafkaException, Producer

from config import KAFKA_BROKER
from db.thermometer_cache import get_daily_records, append_daily
from services.thermometer import compute_thermometer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SENTIMENT_TOPIC = "sentiment_enriched"
THERMOMETER_TOPIC = "sentiment.thermometer.AAPL"


def _build_consumer() -> Consumer:
    return Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id": "thermometer-aggregator",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })


def _build_producer() -> Producer:
    return Producer({
        "bootstrap.servers": KAFKA_BROKER,
        "retries": 3,
        "acks": "all",
    })


def _aggregate_day(articles: list[dict]) -> dict | None:
    """
    Aggregate articles from one day into daily record.
    Requires: finbert_sentiment, relevance_score
    """
    if not articles:
        return None

    # Weighted mean sentiment
    total_rel = sum(a.get("relevance_score", 0) for a in articles)
    if total_rel < 1e-9:
        return None

    mean_sentiment = sum(
        a.get("sentiment", {}).get("score", 0) * a.get("relevance_score", 0)
        for a in articles
    ) / total_rel

    # Strength = abs(sentiment) as conviction
    mean_strength = sum(
        abs(a.get("sentiment", {}).get("score", 0)) * a.get("relevance_score", 0)
        for a in articles
    ) / total_rel

    return {
        "date": articles[0]["date"],  # all same day
        "mean_sentiment": float(mean_sentiment),
        "mean_strength": float(mean_strength),
        "sum_relevance": float(total_rel),
        "article_count": len(articles),
    }


def run() -> None:
    """Main loop: aggregate daily sentiment → compute thermometer → publish."""
    consumer = _build_consumer()
    producer = _build_producer()
    log.info("Thermometer consumer listening on '%s'…", SENTIMENT_TOPIC)

    daily_buffer = defaultdict(list)  # { date_str: [articles] }

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
                log.warning("Deserialization error: %s", e)
                continue

            # Skip non-AAPL articles
            if "AAPL" not in article.get("tickers", []):
                continue

            # Extract date (normalize to day)
            date_str = article.get("date", "").split("T")[0]
            if not date_str:
                continue

            # Buffer article by day
            daily_buffer[date_str].append(article)

            # Once a day changes, compute and publish previous day
            today = datetime.now().strftime("%Y-%m-%d")
            for prev_date in list(daily_buffer.keys()):
                if prev_date < today:  # Past day
                    articles = daily_buffer.pop(prev_date)
                    daily_rec = _aggregate_day(articles)
                    if not daily_rec:
                        continue

                    append_daily(daily_rec)
                    all_dailies = get_daily_records()
                    ref_date = datetime.fromisoformat(prev_date)

                    thermo = compute_thermometer(ref_date, all_dailies)
                    if not thermo:
                        continue

                    msg_payload = thermo._asdict()
                    producer.produce(
                        THERMOMETER_TOPIC,
                        value=json.dumps(msg_payload).encode("utf-8"),
                    )
                    producer.poll(0)

                    log.info(
                        "✓ thermometer[%s %s]: %.4f (%s)",
                        thermo.symbol,
                        prev_date,
                        thermo.thermometer_indicator,
                        thermo.signal,
                    )

    except Exception as e:
        log.error(f"Consumer error: {e}")
    finally:
        consumer.close()
        producer.flush()


if __name__ == "__main__":
    run()
