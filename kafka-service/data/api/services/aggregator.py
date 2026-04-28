"""
Time-based OHLCV aggregation engine.

Rules:
- All higher timeframes derive exclusively from 1m candles.
- Windows are aligned to UTC time boundaries (not count-based).
- A window is finalized the moment a candle from the NEXT window arrives.
- Incomplete windows (gaps in 1m data) are still emitted — partial is valid.
- The buffer is incremental: O(1) per candle after the initial window closes.
"""

from datetime import datetime, timezone

from config import TIMEFRAME_MINUTES


def window_start(ts: datetime, timeframe: str) -> datetime:
    """Return the UTC-aligned start of the window containing `ts`."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    if timeframe == "1d":
        return ts.replace(hour=0, minute=0, second=0, microsecond=0)

    minutes = TIMEFRAME_MINUTES[timeframe]
    total_min = ts.hour * 60 + ts.minute
    floor_min = (total_min // minutes) * minutes
    return ts.replace(
        hour=floor_min // 60,
        minute=floor_min % 60,
        second=0,
        microsecond=0,
    )


def _aggregate(candles: list[dict]) -> dict:
    """OHLCV aggregate over a list of 1m candle dicts."""
    return {
        "open":   candles[0]["open"],
        "high":   max(c["high"]   for c in candles),
        "low":    min(c["low"]    for c in candles),
        "close":  candles[-1]["close"],
        "volume": sum(c["volume"] for c in candles),
    }


class AggregationBuffer:
    """
    Stateful buffer that receives 1m candles and emits closed higher-timeframe
    windows as (timeframe, window_start_datetime, ohlcv_dict) tuples.

    One instance per consumer process; shared across all tickers.
    """

    def __init__(self) -> None:
        # Structure: {ticker: {timeframe: {window_start_datetime: [candle_dict, ...]}}}
        self._buf: dict[str, dict[str, dict[datetime, list[dict]]]] = {}

    def ingest(self, ticker: str, candle: dict) -> list[tuple[str, datetime, dict]]:
        """
        Add a 1m candle.  Returns a (possibly empty) list of closed windows,
        each as (timeframe, ws, ohlcv).
        """
        ts = candle["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        closed: list[tuple[str, datetime, dict]] = []

        ticker_buf = self._buf.setdefault(ticker, {})

        for tf in TIMEFRAME_MINUTES:
            ws = window_start(ts, tf)
            tf_buf = ticker_buf.setdefault(tf, {})

            # Close all windows that are strictly older than the current one
            for old_ws in [w for w in tf_buf if w < ws]:
                closed.append((tf, old_ws, _aggregate(tf_buf.pop(old_ws))))

            tf_buf.setdefault(ws, []).append(candle)

        return closed
