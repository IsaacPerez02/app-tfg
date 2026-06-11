"""
Thermometer cache — load historical daily aggregates from parquet.
"""

import logging
import pandas as pd
from datetime import datetime
from typing import Optional
from pathlib import Path

log = logging.getLogger(__name__)

_cache: dict = {}  # { 'daily_records': [...], 'last_loaded': timestamp }


def load_historical(parquet_path: str) -> bool:
    """Load daily aggregates from parquet. Returns True if successful."""
    global _cache
    try:
        if not Path(parquet_path).exists():
            log.warning(f"Parquet file not found: {parquet_path}")
            return False

        df = pd.read_parquet(parquet_path)
        log.info(f"Loaded thermometer parquet: {len(df)} rows")

        # Expect columns: date, mean_sentiment, mean_strength, sum_relevance, article_count
        required = ["date", "mean_sentiment", "mean_strength", "sum_relevance", "article_count"]
        if not all(c in df.columns for c in required):
            log.error(f"Missing columns. Expected: {required}, Got: {list(df.columns)}")
            return False

        df["date"] = pd.to_datetime(df["date"])
        daily_records = [
            {
                "date": row["date"],
                "mean_sentiment": float(row["mean_sentiment"]),
                "mean_strength": float(row["mean_strength"]),
                "sum_relevance": float(row["sum_relevance"]),
                "article_count": int(row["article_count"]),
            }
            for _, row in df.iterrows()
        ]

        _cache = {"daily_records": daily_records, "last_loaded": datetime.now()}
        log.info(f"Thermometer cache initialized: {len(daily_records)} daily records")
        return True

    except Exception as e:
        log.error(f"Failed to load thermometer cache: {e}")
        return False


def get_daily_records() -> list[dict]:
    """Get all daily aggregates in cache."""
    return _cache.get("daily_records", [])


def is_loaded() -> bool:
    """Check if cache is initialized."""
    return bool(_cache.get("daily_records"))


def append_daily(record: dict) -> None:
    """Add or update a daily record (for real-time updates)."""
    global _cache
    if "daily_records" not in _cache:
        _cache["daily_records"] = []

    daily = _cache["daily_records"]
    record_date = record["date"]

    # Update if exists for same date, else append
    existing = next((i for i, r in enumerate(daily) if r["date"] == record_date), None)
    if existing is not None:
        daily[existing] = record
    else:
        daily.append(record)
        daily.sort(key=lambda r: r["date"])
