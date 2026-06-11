"""
Thermometer calculation engine — exponential decay aggregation of sentiment.

Formula:
  weight_i = exp(-λ × days_ago_i) × sum_relevance_i
  thermometer_raw_t = Σ(weight_i × mean_sentiment_i) / Σ(weight_i)
  thermometer_indicator_t = clip((thermometer_raw + 1.0) / 2.0, 0, 1)
"""

import numpy as np
from datetime import datetime, timedelta
from typing import NamedTuple

LAMBDA = 0.15  # decay constant (half-life ≈ 4.6 days)
WINDOW_DAYS = 60


class ThermometerValue(NamedTuple):
    symbol: str
    timestamp: str  # ISO 8601
    thermometer_indicator: float  # [0, 1]
    thermometer_raw: float  # [-1, +1]
    thermometer_polarity: float  # [0, 1] conviction
    alert_level: str  # MUY ALTO / ALTO / NEUTRO / BAJO / MUY BAJO
    signal: str  # BUY / SELL / NEUTRAL
    articles_in_window: int
    total_weight: float


def _alert_level(indicator: float) -> tuple[str, str]:
    """Map indicator [0,1] → alert_level + signal."""
    if indicator >= 0.70:
        return "MUY ALTO", "BUY"
    elif indicator >= 0.55:
        return "ALTO", "BUY"
    elif indicator >= 0.45:
        return "NEUTRO", "NEUTRAL"
    elif indicator >= 0.30:
        return "BAJO", "SELL"
    else:
        return "MUY BAJO", "SELL"


def compute_thermometer(
    ref_date: datetime,
    daily_records: list[dict],
) -> ThermometerValue | None:
    """
    Compute thermometer for a single reference date.

    Args:
        ref_date: calculation date
        daily_records: list of {
            'date': datetime,
            'mean_sentiment': float [-1, +1],
            'mean_strength': float [0, 1],
            'sum_relevance': float,
            'article_count': int,
        }

    Returns:
        ThermometerValue or None if no data in window
    """
    if not daily_records:
        return None

    ref_ns = np.datetime64(ref_date, "ns")
    cutoff_ns = ref_ns - np.timedelta64(WINDOW_DAYS, "D")

    day_arr = np.array([np.datetime64(r["date"], "ns") for r in daily_records])
    sent_arr = np.array([r["mean_sentiment"] for r in daily_records], dtype=float)
    str_arr = np.array([r["mean_strength"] for r in daily_records], dtype=float)
    rel_arr = np.array([r["sum_relevance"] for r in daily_records], dtype=float)
    cnt_arr = np.array([r["article_count"] for r in daily_records], dtype=int)

    mask = (day_arr >= cutoff_ns) & (day_arr <= ref_ns)
    if not mask.any():
        return None

    days_ago = (ref_ns - day_arr[mask]).astype("timedelta64[D]").astype(float)
    decay = np.exp(-LAMBDA * days_ago)
    weights = decay * rel_arr[mask]
    total_w = weights.sum()

    if total_w < 1e-9:
        return None

    indicator = float((weights * sent_arr[mask]).sum() / total_w)
    polarity = float((weights * str_arr[mask]).sum() / total_w)
    indicator_norm = float(np.clip((indicator + 1.0) / 2.0, 0.0, 1.0))
    alert, signal = _alert_level(indicator_norm)

    return ThermometerValue(
        symbol="AAPL",
        timestamp=ref_date.isoformat(),
        thermometer_indicator=round(indicator_norm, 4),
        thermometer_raw=round(indicator, 4),
        thermometer_polarity=round(polarity, 4),
        alert_level=alert,
        signal=signal,
        articles_in_window=int(cnt_arr[mask].sum()),
        total_weight=round(float(total_w), 4),
    )
