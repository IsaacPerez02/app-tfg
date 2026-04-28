"""
Candle aggregation processor.

Consumes raw_candles_1m, aggregates to higher timeframes (5m, 15m, 1h, 4h, 1d)
using AggregationBuffer, and publishes closed windows to agg_candles.
"""

import hashlib
import json
import logging
import time
from datetime import datetime, timezone

from confluent_kafka import Consumer, Producer, KafkaError

from config import KAFKA_BROKER, RAW_CANDLES_TOPIC, AGG_CANDLES_TOPIC
from services.aggregator import AggregationBuffer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def _candle_id(ticker: str, ts: datetime, tf: str) -> str:
    raw = f"{ticker}_{ts.isoformat()}_{tf}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def wait_for_topic(consumer, topic: str, timeout: int = 60) -> None:
    log.info("Waiting for topic '%s'...", topic)
    start = time.time()
    while time.time() - start < timeout:
        md = consumer.list_topics(timeout=5)
        if topic in md.topics:
            log.info("Topic '%s' ready", topic)
            return
        time.sleep(2)
    raise TimeoutError(f"Topic {topic} not available after {timeout}s")


def run() -> None:
    for attempt in range(30):
        try:
            consumer = Consumer({
                "bootstrap.servers": KAFKA_BROKER,
                "group.id": "candle-aggregator",
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
            })
            producer = Producer({"bootstrap.servers": KAFKA_BROKER})
            consumer.list_topics(timeout=5)
            log.info("Kafka connected")
            break
        except Exception as e:
            log.warning("[Kafka not ready] retry %d/30: %s", attempt, e)
            time.sleep(2)
    else:
        raise RuntimeError("Kafka never became ready")

    wait_for_topic(consumer, RAW_CANDLES_TOPIC)
    consumer.subscribe([RAW_CANDLES_TOPIC])

    buf = AggregationBuffer()
    now_utc = lambda: datetime.now(timezone.utc).isoformat()

    log.info("Candle aggregator started — consuming %s", RAW_CANDLES_TOPIC)

    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                log.warning("Kafka error: %s", msg.error())
                continue

            try:
                candle = json.loads(msg.value())
                ticker = candle["ticker"]

                closed = buf.ingest(ticker, candle)

                for tf, ws, ohlcv in closed:
                    ts_iso = ws.isoformat()
                    payload = {
                        "_id": _candle_id(ticker, ws, tf),
                        "ticker": ticker,
                        "timestamp": ts_iso,
                        "timeframe": tf,
                        "open": ohlcv["open"],
                        "high": ohlcv["high"],
                        "low": ohlcv["low"],
                        "close": ohlcv["close"],
                        "volume": ohlcv["volume"],
                        "source": "aggregator",
                        "created_at": now_utc(),
                    }
                    producer.produce(
                        AGG_CANDLES_TOPIC,
                        key=ticker,
                        value=json.dumps(payload),
                    )
                    producer.poll(0)

                if closed:
                    producer.flush()
                    log.debug("[agg] %s closed %d windows", ticker, len(closed))

            except Exception as exc:
                log.error("Failed to process candle: %s", exc)

    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()
        producer.flush()
        log.info("Aggregator stopped")


if __name__ == "__main__":
    run()
