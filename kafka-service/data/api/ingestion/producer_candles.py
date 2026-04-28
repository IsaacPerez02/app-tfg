"""
Candle ingestion pipeline — multi-ticker, batched.

SOURCE:
  FastAPI local server -> http://localhost:8000/candles/{ticker}/{tf}

Bootstrap: fetch full history for each ticker, publish ALL to Kafka.
Streaming: poll latest candle every POLL_INTERVAL_SECONDS, publish new ones.
Kafka is the ONLY dependency — no external persistence.
"""

import json
import os
import logging
import time
from datetime import datetime, timezone
from itertools import islice

import pandas as pd
import requests
from confluent_kafka import Producer

from config import (
    BATCH_DELAY_SECONDS,
    BOOTSTRAP_PERIOD,
    INGEST_BATCH_SIZE,
    KAFKA_BROKER,
    POLL_INTERVAL_SECONDS,
    RAW_CANDLES_TOPIC,
    get_active_tickers,
    TICKER_METADATA,
)
from schemas.marketCandle import MarketCandle
    
import hashlib

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:8000")


def _wait_for_kafka(producer: Producer, timeout: int = 120) -> None:
    log.info("Waiting for Kafka to be ready...")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            producer.list_topics(timeout=5)
            log.info("Kafka is ready.")
            return
        except Exception as e:
            log.warning("Kafka not ready yet: %s — retrying in 3s", e)
            time.sleep(3)
    raise RuntimeError("Kafka not available after %ds" % timeout)

_MIN_CALL_GAP = 1.0
_last_call_ts = 0.0


def _rate_limit_wait():
    global _last_call_ts
    gap = time.monotonic() - _last_call_ts
    if gap < _MIN_CALL_GAP:
        time.sleep(_MIN_CALL_GAP - gap)
    _last_call_ts = time.monotonic()


def _build_session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    })
    return s


def _fetch_from_api(ticker: str, tf: str, session: requests.Session) -> pd.DataFrame:
    _rate_limit_wait()

    try:
        url = f"{FASTAPI_URL}/candles/{ticker}/{tf}"
        r = session.get(url, timeout=10)

        if r.status_code != 200:
            return pd.DataFrame()

        data = r.json().get("data", [])
        if not data:
            return pd.DataFrame()

        df = pd.DataFrame(data)

        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
            df = df.set_index("timestamp")

        df.columns = [c.lower() for c in df.columns]

        required = {"open", "high", "low", "close", "volume"}
        if not required.issubset(df.columns):
            return pd.DataFrame()

        return df.sort_index()

    except Exception as e:
        log.debug("[API ERROR] %s %s %s", ticker, tf, e)
        return pd.DataFrame()


def _candle_id(ticker: str, ts: datetime, tf: str) -> str:
    raw = f"{ticker}_{ts.isoformat()}_{tf}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _df_to_candles(df: pd.DataFrame, ticker: str, tf: str):
    candles = []
    now = datetime.now(timezone.utc)

    for ts, row in df.iterrows():
        ts = ts.to_pydatetime()
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        candles.append(MarketCandle(**{
            "_id": _candle_id(ticker, ts, tf),
            "ticker": ticker,
            "timestamp": ts,
            "timeframe": tf,
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row["volume"]),
            "source": "fastapi-local",
            "created_at": now,
        }))

    return candles


def _publish(producer: Producer, candles, ticker: str) -> int:
    _errors: list[str] = []

    def _on_delivery(err, msg):
        if err:
            _errors.append(str(err))

    for c in candles:
        payload = c.model_dump(by_alias=True)
        payload["timestamp"] = payload["timestamp"].isoformat()
        payload["created_at"] = payload["created_at"].isoformat()

        producer.produce(
            RAW_CANDLES_TOPIC,
            key=ticker,
            value=json.dumps(payload),
            on_delivery=_on_delivery,
        )

    producer.flush()

    if _errors:
        log.error("[publish] %s: %d delivery failures — first: %s", ticker, len(_errors), _errors[0])
        raise RuntimeError(f"Kafka delivery failed for {ticker}: {_errors[0]}")

    return len(candles)


def _batched(iterable, n: int):
    it = iter(iterable)
    while chunk := list(islice(it, n)):
        yield chunk


def run():
    universe = get_active_tickers()
    log.info("Universe loaded: %d tickers", len(universe))

    producer = Producer({"bootstrap.servers": KAFKA_BROKER})
    _wait_for_kafka(producer)
    session = _build_session()

    def _primary_tf(ticker: str):
        return "1m" if ticker in TICKER_METADATA else "1d"

    last_ts = {}
    working_tf = {}

    ok = fail = 0

    # ==========================
    # BOOTSTRAP
    # ==========================
    log.info("BOOTSTRAP START")

    for batch in _batched(list(universe.keys()), INGEST_BATCH_SIZE):
        for ticker in batch:
            tf = _primary_tf(ticker)

            df = _fetch_from_api(ticker, tf, session)

            if df.empty:
                log.error("[bootstrap] %s FAILED", ticker)
                fail += 1
                working_tf[ticker] = tf
                continue

            candles = _df_to_candles(df, ticker, tf)
            try:
                _publish(producer, candles, ticker)
            except RuntimeError as e:
                log.error("[bootstrap] %s publish failed: %s", ticker, e)
                fail += 1
                working_tf[ticker] = tf
                continue

            last_ts[ticker] = df.index[-1].to_pydatetime()
            working_tf[ticker] = tf

            ok += 1
            log.info("[bootstrap] %s -> %d candles", ticker, len(candles))

        time.sleep(BATCH_DELAY_SECONDS)

    log.info("BOOTSTRAP DONE: %d OK / %d FAIL", ok, fail)

    # ==========================
    # POLLING LOOP
    # ==========================
    log.info("Polling started...")

    while True:
        time.sleep(POLL_INTERVAL_SECONDS)

        for batch in _batched(list(universe.keys()), INGEST_BATCH_SIZE):
            for ticker in batch:
                try:
                    tf = working_tf.get(ticker, _primary_tf(ticker))

                    df = _fetch_from_api(ticker, tf, session)
                    if df.empty:
                        continue

                    prev = last_ts.get(ticker)
                    if prev is not None:
                        df = df[df.index > pd.Timestamp(prev)]
                        
                    if df.empty:
                        continue

                    candles = _df_to_candles(df, ticker, tf)
                    _publish(producer, candles, ticker)

                    last_ts[ticker] = df.index[-1].to_pydatetime()

                    log.info("[poll] %s +%d candles", ticker, len(candles))

                except Exception as e:
                    log.error("[poll] %s error: %s", ticker, e)

            time.sleep(BATCH_DELAY_SECONDS)


if __name__ == "__main__":
    run()