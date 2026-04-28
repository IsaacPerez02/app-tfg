"""
Market data service configuration.

ASSET UNIVERSE MODEL
────────────────────
Two complementary layers:

  1. FOCUS_TICKERS   — curated set of high-value assets.
                       Ingested at 1m resolution (max yfinance granularity).
                       Defined in TICKER_METADATA below.

  2. BROAD_UNIVERSE  — full NASDAQ-listed securities fetched dynamically
                       from NASDAQ's public directory.
                       Ingested at 1d resolution.
                       Enabled when BROAD_MODE env var is set.

Adding a new asset to TICKER_METADATA is all that is required for the
frontend to pick it up — config.py is the single source of truth.
"""

import csv
import io
import logging
import os

import requests

log = logging.getLogger(__name__)

# ── Kafka ──────────────────────────────────────────────────────────────────
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")

RAW_CANDLES_TOPIC = "raw_candles_1m"
AGG_CANDLES_TOPIC = "agg_candles"
MARKET_INDICATORS_TOPIC = "market_indicators"

# ── Focus ticker universe (1m resolution) ─────────────────────────────────
# This is the canonical asset list exposed through GET /tickers.
# Adding an entry here is the ONLY change needed to ingest a new asset.

TICKER_METADATA: dict[str, dict] = {
    "AAPL":  {"name": "Apple",     "category": "stock"},
    "MSFT":  {"name": "Microsoft", "category": "stock"},
    "INTC":  {"name": "Intel",     "category": "stock"},
    "GOOGL": {"name": "Google",    "category": "stock"},
    "NFLX":  {"name": "Netflix",   "category": "stock"},
}

TICKERS: list[str] = list(TICKER_METADATA.keys())

# ── Timeframes ─────────────────────────────────────────────────────────────
TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"]

# Minutes per timeframe — drives window alignment in the aggregator
TIMEFRAME_MINUTES: dict[str, int] = {
    "5m":  5,
    "15m": 15,
    "1h":  60,
    "4h":  240,
    "1d":  1440,
}

# ── Ingestion settings ─────────────────────────────────────────────────────
BOOTSTRAP_PERIOD      = "7d"   # yfinance max for 1m interval
POLL_INTERVAL_SECONDS = 60

# Batching — prevents yfinance / network rate-limit errors
INGEST_BATCH_SIZE     = int(os.getenv("INGEST_BATCH_SIZE", "5"))
BATCH_DELAY_SECONDS   = float(os.getenv("BATCH_DELAY_SECONDS", "2.0"))

# ── Broad NASDAQ universe loader ───────────────────────────────────────────
# Used when BROAD_MODE=1 env var is set.
# Fetches full NASDAQ listing (~3 500 symbols) at 1d resolution.
_NASDAQ_LISTING_URL  = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
_OTHER_LISTING_URL   = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"

_broad_cache: dict[str, dict] | None = None


def fetch_nasdaq_universe(max_symbols: int = 500) -> dict[str, dict]:
    """
    Download and parse NASDAQ's public symbol directory.

    Returns a dict of {symbol: {name, category}} ready to be merged with
    TICKER_METADATA.  Results are cached for the lifetime of the process.

    Args:
        max_symbols: cap on the number of additional symbols to load
                     (prevents unbounded memory/latency on first call).
    """
    global _broad_cache
    if _broad_cache is not None:
        return _broad_cache

    result: dict[str, dict] = {}

    for url, default_cat in [(_NASDAQ_LISTING_URL, "stock"), (_OTHER_LISTING_URL, "stock")]:
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text), delimiter="|")
            for row in reader:
                sym  = (row.get("Symbol") or row.get("ACT Symbol") or "").strip()
                name = (row.get("Security Name") or "").strip()
                # Skip test symbols, warrants, units, preferred shares
                if not sym or any(c in sym for c in ("$", "+", ".", " ", "^", "~")):
                    continue
                if sym in TICKER_METADATA:
                    continue  # already in focus list
                result[sym] = {"name": name[:60], "category": default_cat}
                if len(result) >= max_symbols:
                    break
        except Exception as exc:
            log.warning("Could not fetch NASDAQ listing from %s: %s", url, exc)

        if len(result) >= max_symbols:
            break

    _broad_cache = result
    log.info("Broad NASDAQ universe loaded: %d symbols", len(result))
    return result


def get_active_tickers() -> dict[str, dict]:
    """
    Return the full active ticker universe.

    In BROAD_MODE: focus tickers + NASDAQ broad universe (1d interval).
    Default:       focus tickers only (1m interval).
    """
    universe = dict(TICKER_METADATA)
    if os.getenv("BROAD_MODE", "0") == "1":
        broad = fetch_nasdaq_universe()
        universe.update(broad)
    return universe
