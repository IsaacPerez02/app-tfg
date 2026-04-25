from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class NewsItem(BaseModel):
    id: str = Field(alias="_id")
    date: str

    @field_validator("date", mode="before")
    @classmethod
    def normalize_date(cls, v: str) -> str:
        """Convierte formato GDELT (YYYYMMDDHHMMSS) a ISO 8601 si es necesario."""
        if v and len(v) >= 14 and "T" not in v and "-" not in v:
            try:
                dt = datetime.strptime(v[:14], "%Y%m%d%H%M%S")
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                pass
        return v
    title: str
    text: str
    summary: str
    url: str
    source: str

    tickers: list[str] = []
    persons: list[str] = []
    organizations: list[str] = []
    themes: list[str] = []

    sentiment: float = 0.0
    importance_score: float = 0.0
    created_at: Optional[datetime] = None

    model_config = {"populate_by_name": True}


class TrendingTicker(BaseModel):
    ticker: str
    mention_count: int
    avg_sentiment: float
    recent_mentions: int
    acceleration: float
    trending_score: float
