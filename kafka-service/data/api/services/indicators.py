"""
In-memory indicators store. Thread-safe.

Populated by:
    Kafka market_indicators topic (stream processor)

Consumed by:
    FastAPI endpoints
"""

import threading
from typing import Optional

_lock = threading.Lock()

_store: dict[str, dict[str, list]] = {}  
# ticker → timeframe → [indicators]


MAX_INDICATORS: dict[str, int] = {
    "1m": 10080,
    "5m": 2016,
    "15m": 672,
    "1h": 720,
    "4h": 180,
    "1d": 730,
}


def ingest_indicator(indicator: dict) -> None:
    ticker = indicator["ticker"]
    tf = indicator.get("timeframe", "1m")
    ts = indicator["timestamp"]

    with _lock:
        lst = _store.setdefault(ticker, {}).setdefault(tf, [])

        if lst and lst[-1]["timestamp"] == ts:
            return  # duplicate

        lst.append(indicator)

        maxn = MAX_INDICATORS.get(tf, 1000)
        if len(lst) > maxn:
            del lst[:-maxn]


def get_indicators(
    ticker: str,
    timeframe: str,
    limit: int = 100,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> list[dict]:

    with _lock:
        items = list(_store.get(ticker, {}).get(timeframe, []))

    if start:
        items = [x for x in items if x["timestamp"] >= start]

    if end:
        items = [x for x in items if x["timestamp"] <= end]

    return list(reversed(items[-limit:]))


def get_latest_indicator(ticker: str, timeframe: str) -> Optional[dict]:
    with _lock:
        lst = _store.get(ticker, {}).get(timeframe, [])
        return dict(lst[-1]) if lst else None


def count_indicators(timeframe: str = "1m") -> int:
    with _lock:
        return sum(len(v.get(timeframe, [])) for v in _store.values())