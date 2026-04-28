"""
In-memory candle store. Thread-safe. Populated by the API's background Kafka consumer.
"""

import bisect
import threading
from datetime import datetime
from typing import Optional

_lock  = threading.Lock()
_store: dict[str, dict[str, list]] = {}
_ts_index: dict[str, dict[str, set]] = {}  # ticker → tf → set of timestamps (dedup)

MAX_CANDLES: dict[str, int] = {
    "1m":  10080,
    "5m":  2016,
    "15m": 672,
    "1h":  720,
    "4h":  180,
    "1d":  730,
}


def ingest_candle(candle: dict) -> None:
    ticker = candle["ticker"]
    tf     = candle.get("timeframe", "1m")
    ts     = candle["timestamp"]

    with _lock:
        seen = _ts_index.setdefault(ticker, {}).setdefault(tf, set())
        if ts in seen:
            return  # true dedup por timestamp
        seen.add(ts)

        lst = _store.setdefault(ticker, {}).setdefault(tf, [])

        # Inserción ordenada por timestamp (string ISO ordena correctamente)
        keys = [c["timestamp"] for c in lst]
        idx  = bisect.bisect_left(keys, ts)
        lst.insert(idx, candle)

        # Trim
        maxn = MAX_CANDLES.get(tf, 1000)
        if len(lst) > maxn:
            removed = lst[:-maxn]
            del lst[:-maxn]
            # Limpiar el índice de los eliminados
            for c in removed:
                seen.discard(c["timestamp"])


def get_candles(
    ticker:    str,
    timeframe: str,
    limit:     int                = 100,
    start:     Optional[datetime] = None,
    end:       Optional[datetime] = None,
) -> list[dict]:
    with _lock:
        items = list(_store.get(ticker, {}).get(timeframe, []))
    if start:
        si = start.isoformat()
        items = [c for c in items if c["timestamp"] >= si]
    if end:
        ei = end.isoformat()
        items = [c for c in items if c["timestamp"] <= ei]
    # Devuelve los últimos `limit` en orden ascendente (más reciente al final)
    return items[-limit:]


def get_latest_candle(ticker: str, timeframe: str) -> Optional[dict]:
    with _lock:
        lst = _store.get(ticker, {}).get(timeframe, [])
        return dict(lst[-1]) if lst else None


def count_candles(timeframe: str = "1m") -> int:
    with _lock:
        return sum(len(v.get(timeframe, [])) for v in _store.values())


def get_ticker_summaries(tickers: list[str], metadata: dict) -> list[dict]:
    result = []
    with _lock:
        for ticker in tickers:
            tf_data = _store.get(ticker, {})
            lst_1m  = tf_data.get("1m", [])
            lst_1d  = tf_data.get("1d", [])
            if lst_1m:
                latest   = lst_1m[-1]
                price    = latest["close"]
                day      = lst_1d[-1] if lst_1d else None
                day_open = day["open"]   if day else price
                day_high = day["high"]   if day else price
                day_low  = day["low"]    if day else price
                day_vol  = day["volume"] if day else 0.0
                change   = ((price - day_open) / day_open * 100) if day_open else 0.0
                result.append({
                    "ticker":       ticker,
                    "price":        price,
                    "open":         day_open,
                    "dayHigh":      day_high,
                    "dayLow":       day_low,
                    "volume":       day_vol,
                    "change":       round(change, 4),
                    "changeAbs":    round(price - day_open, 4),
                    "last_updated": latest["timestamp"],
                    **metadata.get(ticker, {}),
                })
            else:
                result.append({
                    "ticker":       ticker,
                    "price":        0.0,
                    "open":         0.0,
                    "dayHigh":      0.0,
                    "dayLow":       0.0,
                    "volume":       0.0,
                    "change":       0.0,
                    "changeAbs":    0.0,
                    "last_updated": None,
                    **metadata.get(ticker, {}),
                })
    return result