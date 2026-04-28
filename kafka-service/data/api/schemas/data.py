from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MarketIndicators(BaseModel):
    id: str = Field(alias="_id")

    # --- Identificación ---
    ticker: str
    timestamp: datetime
    timeframe: str  # "1m", "1d", "1h", etc.

    # =========================
    # 📈 TENDENCIA
    # =========================
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None
    adx_14: Optional[float] = None  # fuerza de tendencia

    # =========================
    # ⚡ MOMENTUM
    # =========================
    rsi_14: Optional[float] = None

    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None

    # =========================
    # 🌊 VOLATILIDAD
    # =========================
    atr_14: Optional[float] = None

    bollinger_upper: Optional[float] = None
    bollinger_middle: Optional[float] = None
    bollinger_lower: Optional[float] = None
    bollinger_width: Optional[float] = None

    # extra útil para ML
    true_range_norm: Optional[float] = None  # (high-low)/close aprox

    # =========================
    # 📊 VOLUMEN
    # =========================
    obv: Optional[float] = None
    volume_sma_20: Optional[float] = None
    vwap: Optional[float] = None  # intradía muy importante

    # =========================
    # 📉 RETORNOS / ESTADÍSTICA
    # =========================
    returns_1d: Optional[float] = None
    log_returns_1d: Optional[float] = None
    volatility_7d: Optional[float] = None

    zscore_price: Optional[float] = None  # precio vs media (muy útil en ML)

    # =========================
    # 🧠 METADATA
    # =========================
    source: Optional[str] = None
    created_at: Optional[datetime] = None