from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MarketCandle(BaseModel):
    id: str = Field(alias="_id")

    # --- Identificación ---
    ticker: str
    timestamp: datetime
    timeframe: str

    # --- OHLCV ---
    open: float
    high: float
    low: float
    close: float
    volume: float

    # --- Metadata ---
    source: str = "yfinance"
    created_at: Optional[datetime] = None