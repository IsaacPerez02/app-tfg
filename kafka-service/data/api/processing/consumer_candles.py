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


def _to_datetime(ts: str | datetime) -> datetime:
    if isinstance(ts, datetime):
        dt = ts
    else:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt


def _wait_for_kafka(broker: str, timeout: int = 120) -> None:
    log.info("Waiting for Kafka...")
    from confluent_kafka.admin import AdminClient
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            AdminClient({"bootstrap.servers": broker}).list_topics(timeout=5)
            log.info("Kafka ready")
            return
        except Exception as e:
            log.warning("Kafka not ready: %s — retry in 3s", e)
            time.sleep(3)
    raise RuntimeError(f"Kafka not available after {timeout}s")


def run():
    # ───────────────────────── Kafka setup ─────────────────────────
    _wait_for_kafka(KAFKA_BROKER)

    consumer = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id": "candle-aggregator",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })

    producer = Producer({
        "bootstrap.servers": KAFKA_BROKER
    })

    # IMPORTANT: subscribe
    consumer.subscribe([RAW_CANDLES_TOPIC])

    buf = AggregationBuffer()
    now_utc = lambda: datetime.now(timezone.utc).isoformat()

    log.info("Aggregator started, consuming: %s", RAW_CANDLES_TOPIC)

    try:
        while True:
            msg = consumer.poll(1.0)

            if msg is None:
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                log.error("Kafka error: %s", msg.error())
                continue

            try:
                raw = msg.value()

                # ── SAFE DECODE ──
                if raw is None:
                    continue

                candle = json.loads(raw.decode("utf-8"))

                ticker = candle["ticker"]
                candle["timestamp"] = _to_datetime(candle["timestamp"])

                log.info("[RAW] %s %s %s %s",
                         ticker,
                         candle["timeframe"],
                         candle["timestamp"],
                         candle["close"])

                # ── FEED BUFFER ──
                closed = buf.ingest(ticker, candle)

                # ── EMIT AGGREGATED ──
                for tf, ws, ohlcv in closed:
                    payload = {
                        "_id": _candle_id(ticker, ws, tf),
                        "ticker": ticker,
                        "timestamp": ws.isoformat(),
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
                        value=json.dumps(payload).encode("utf-8"),
                    )

                    log.info("[AGG] %s %s closed window %s",
                             ticker, tf, ws)

                producer.poll(0)

                if closed:
                    producer.flush()

            except Exception as e:
                log.error("Processing error: %s", e)

    except KeyboardInterrupt:
        log.info("Stopping aggregator...")

    finally:
        consumer.close()
        producer.flush()


if __name__ == "__main__":
    run()