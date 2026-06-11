"""
Indicators producer — calculates comprehensive TA indicators for each ticker × timeframe
using pandas-ta, then publishes JSON payloads to MARKET_INDICATORS_TOPIC.

Runs bootstrap once (calculates from all available candles) then polls every 60s.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import pandas_ta as ta
import requests
from confluent_kafka import Producer

from config import (
    KAFKA_BROKER,
    MARKET_INDICATORS_TOPIC,
    POLL_INTERVAL_SECONDS,
    TICKERS,
    TIMEFRAMES,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:8000")

ALL_TIMEFRAMES = ["1m"] + TIMEFRAMES

# Min candles needed to compute reliable indicators
MIN_CANDLES: dict[str, int] = {
    "1m": 50,
    "5m": 50,
    "15m": 50,
    "1h": 50,
    "4h": 30,
    "1d": 30,
}

# How many candles to request per timeframe (enough for 200-period indicators)
CANDLE_LIMIT: dict[str, int] = {
    "1m": 500,
    "5m": 400,
    "15m": 300,
    "1h": 300,
    "4h": 250,
    "1d": 250,
}


def _wait_for_kafka(producer: Producer, timeout: int = 120) -> None:
    log.info("Waiting for Kafka to be ready...")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            producer.list_topics(timeout=5)
            log.info("Kafka is ready.")
            return
        except Exception as e:
            log.warning("Kafka not ready: %s — retry in 3s", e)
            time.sleep(3)
    raise RuntimeError("Kafka not available after %ds" % timeout)


def _fetch_candles(ticker: str, tf: str, session: requests.Session) -> pd.DataFrame:
    limit = CANDLE_LIMIT.get(tf, 300)
    try:
        url = f"{FASTAPI_URL}/candles/{ticker}/{tf}?limit={limit}"
        r = session.get(url, timeout=10)
        if r.status_code != 200:
            return pd.DataFrame()
        data = r.json().get("data", [])
        if not data:
            return pd.DataFrame()
        df = pd.DataFrame(data)
        df.columns = [c.lower() for c in df.columns]
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        df = df.set_index("timestamp").sort_index()
        required = {"open", "high", "low", "close", "volume"}
        if not required.issubset(df.columns):
            return pd.DataFrame()
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        return df.dropna(subset=["open", "high", "low", "close"])
    except Exception as e:
        log.debug("fetch_candles %s %s: %s", ticker, tf, e)
        return pd.DataFrame()


def _safe(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (f != f or f == float("inf") or f == float("-inf")) else round(f, 6)
    except Exception:
        return None


def _signal_rsi(rsi: float | None) -> str:
    if rsi is None:
        return "Neutral"
    if rsi >= 70:
        return "Overbought"
    if rsi <= 30:
        return "Oversold"
    if rsi >= 55:
        return "Buy"
    if rsi <= 45:
        return "Sell"
    return "Neutral"


def _signal_ma(close: float, ma: float | None) -> str:
    if ma is None or close is None:
        return "Neutral"
    return "Buy" if close > ma else "Sell"


def _signal_macd(macd: float | None, signal: float | None) -> str:
    if macd is None or signal is None:
        return "Neutral"
    return "Buy" if macd > signal else "Sell"


def _signal_bb(close: float, upper: float | None, lower: float | None) -> str:
    if upper is None or lower is None:
        return "Neutral"
    if close >= upper:
        return "Overbought"
    if close <= lower:
        return "Oversold"
    mid = (upper + lower) / 2
    return "Buy" if close > mid else "Sell"


def _signal_adx(adx: float | None, plus_di: float | None, minus_di: float | None) -> str:
    if adx is None or adx < 20:
        return "Neutral"
    if plus_di is None or minus_di is None:
        return "Neutral"
    return "Buy" if plus_di > minus_di else "Sell"


def _signal_stoch(k: float | None, d: float | None) -> str:
    if k is None:
        return "Neutral"
    if k >= 80:
        return "Overbought"
    if k <= 20:
        return "Oversold"
    if d is not None:
        return "Buy" if k > d else "Sell"
    return "Neutral"


def _signal_cci(cci: float | None) -> str:
    if cci is None:
        return "Neutral"
    if cci >= 100:
        return "Overbought"
    if cci <= -100:
        return "Oversold"
    return "Buy" if cci > 0 else "Sell"


def _signal_williams(wr: float | None) -> str:
    if wr is None:
        return "Neutral"
    if wr >= -20:
        return "Overbought"
    if wr <= -80:
        return "Oversold"
    return "Buy" if wr > -50 else "Sell"


def _signal_momentum(mom: float | None) -> str:
    if mom is None:
        return "Neutral"
    return "Buy" if mom > 0 else "Sell"


def _signal_ao(ao: float | None) -> str:
    if ao is None:
        return "Neutral"
    return "Buy" if ao > 0 else "Sell"


def _summary(signals: list[str]) -> str:
    counts = {"Buy": 0, "Sell": 0, "Neutral": 0, "Overbought": 0, "Oversold": 0}
    for s in signals:
        counts[s] = counts.get(s, 0) + 1
    buy = counts["Buy"] + counts["Oversold"]
    sell = counts["Sell"] + counts["Overbought"]
    neu = counts["Neutral"]
    total = buy + sell + neu
    if total == 0:
        return "Neutral"
    if buy > sell * 2 and buy > neu:
        return "Strong Buy"
    if sell > buy * 2 and sell > neu:
        return "Strong Sell"
    if buy > sell and buy > neu:
        return "Buy"
    if sell > buy and sell > neu:
        return "Sell"
    return "Neutral"


def _calc_hma(series: pd.Series, period: int) -> pd.Series:
    half = max(1, period // 2)
    sqrt_p = max(1, int(period ** 0.5))
    wma_half = series.ewm(span=half, adjust=False).mean()
    wma_full = series.ewm(span=period, adjust=False).mean()
    diff = 2 * wma_half - wma_full
    return diff.ewm(span=sqrt_p, adjust=False).mean()


def _calc_vwma(close: pd.Series, volume: pd.Series, period: int) -> pd.Series:
    pv = close * volume
    return pv.rolling(period).sum() / volume.rolling(period).sum()


def compute_indicators(df: pd.DataFrame) -> dict:
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]
    n = len(df)

    last_close = float(close.iloc[-1])

    # ── Oscillators ───────────────────────────────────────────────────────────

    # RSI 14
    rsi_s = ta.rsi(close, length=14)
    rsi_14 = _safe(rsi_s.iloc[-1] if rsi_s is not None and n > 0 else None)

    # Stochastic 14,3,3
    stoch = ta.stoch(high, low, close, k=14, d=3, smooth_k=3)
    stoch_k = _safe(stoch.iloc[-1, 0] if stoch is not None and n > 0 else None)
    stoch_d = _safe(stoch.iloc[-1, 1] if stoch is not None and n > 0 else None)

    # StochRSI
    stochrsi = ta.stochrsi(close, length=14)
    stochrsi_k = _safe(stochrsi.iloc[-1, 0] if stochrsi is not None and n > 0 else None)
    stochrsi_d = _safe(stochrsi.iloc[-1, 1] if stochrsi is not None and n > 0 else None)

    # MACD 12,26,9
    macd_df = ta.macd(close, fast=12, slow=26, signal=9)
    macd_val = _safe(macd_df.iloc[-1, 0] if macd_df is not None and n > 0 else None)
    macd_sig = _safe(macd_df.iloc[-1, 2] if macd_df is not None and n > 0 else None)
    macd_hist = _safe(macd_df.iloc[-1, 1] if macd_df is not None and n > 0 else None)

    # CCI 20
    cci_s = ta.cci(high, low, close, length=20)
    cci_20 = _safe(cci_s.iloc[-1] if cci_s is not None and n > 0 else None)

    # Williams %R 14
    willr_s = ta.willr(high, low, close, length=14)
    willr_14 = _safe(willr_s.iloc[-1] if willr_s is not None and n > 0 else None)

    # Ultimate Oscillator
    uo_s = ta.uo(high, low, close)
    uo_val = _safe(uo_s.iloc[-1] if uo_s is not None and n > 0 else None)

    # ROC 9
    roc_s = ta.roc(close, length=9)
    roc_9 = _safe(roc_s.iloc[-1] if roc_s is not None and n > 0 else None)

    # Awesome Oscillator
    ao_s = ta.ao(high, low)
    ao_val = _safe(ao_s.iloc[-1] if ao_s is not None and n > 0 else None)

    # Momentum 10
    mom_s = ta.mom(close, length=10)
    mom_10 = _safe(mom_s.iloc[-1] if mom_s is not None and n > 0 else None)

    # Bull/Bear Power (Elder)
    ema13 = ta.ema(close, length=13)
    bull_power = _safe((high.iloc[-1] - ema13.iloc[-1]) if ema13 is not None and n > 0 else None)
    bear_power = _safe((low.iloc[-1] - ema13.iloc[-1]) if ema13 is not None and n > 0 else None)

    # ── Moving Averages ───────────────────────────────────────────────────────

    def _sma(p):
        s = ta.sma(close, length=p)
        return _safe(s.iloc[-1] if s is not None and len(s) > 0 else None)

    def _ema(p):
        s = ta.ema(close, length=p)
        return _safe(s.iloc[-1] if s is not None and len(s) > 0 else None)

    def _wma(p):
        s = ta.wma(close, length=p)
        return _safe(s.iloc[-1] if s is not None and len(s) > 0 else None)

    sma_5   = _sma(5)
    sma_10  = _sma(10)
    sma_20  = _sma(20)
    sma_50  = _sma(50)
    sma_100 = _sma(100)
    sma_200 = _sma(200)

    ema_5   = _ema(5)
    ema_9   = _ema(9)
    ema_10  = _ema(10)
    ema_20  = _ema(20)
    ema_21  = _ema(21)
    ema_50  = _ema(50)
    ema_100 = _ema(100)
    ema_200 = _ema(200)

    wma_10 = _wma(10)
    wma_20 = _wma(20)

    hma_9_s  = _calc_hma(close, 9)
    hma_9    = _safe(hma_9_s.iloc[-1] if len(hma_9_s) > 0 else None)

    vwma_20_s = _calc_vwma(close, volume, 20)
    vwma_20   = _safe(vwma_20_s.iloc[-1] if len(vwma_20_s) > 0 else None)

    # ── Volatility ────────────────────────────────────────────────────────────

    # ADX 14
    adx_df = ta.adx(high, low, close, length=14)
    adx_14   = _safe(adx_df.iloc[-1, 0] if adx_df is not None and n > 0 else None)
    adx_plus = _safe(adx_df.iloc[-1, 1] if adx_df is not None and n > 0 else None)
    adx_minus= _safe(adx_df.iloc[-1, 2] if adx_df is not None and n > 0 else None)

    # ATR 14
    atr_s = ta.atr(high, low, close, length=14)
    atr_14 = _safe(atr_s.iloc[-1] if atr_s is not None and n > 0 else None)

    # Bollinger Bands 20,2
    bb_df = ta.bbands(close, length=20, std=2)
    bb_upper  = _safe(bb_df.iloc[-1, 0] if bb_df is not None and n > 0 else None)
    bb_middle = _safe(bb_df.iloc[-1, 1] if bb_df is not None and n > 0 else None)
    bb_lower  = _safe(bb_df.iloc[-1, 2] if bb_df is not None and n > 0 else None)
    bb_width  = _safe(bb_df.iloc[-1, 3] if bb_df is not None and n > 0 and bb_df.shape[1] > 3 else None)

    # Ichimoku
    try:
        ich = ta.ichimoku(high, low, close)
        ich_df = ich[0] if isinstance(ich, tuple) else ich
        tenkan  = _safe(ich_df["ITS_9"].iloc[-1]  if ich_df is not None and "ITS_9"  in ich_df.columns else None)
        kijun   = _safe(ich_df["IKS_26"].iloc[-1] if ich_df is not None and "IKS_26" in ich_df.columns else None)
    except Exception:
        tenkan = kijun = None

    # ── Volume ────────────────────────────────────────────────────────────────

    # OBV
    obv_s = ta.obv(close, volume)
    obv = _safe(obv_s.iloc[-1] if obv_s is not None and n > 0 else None)

    # VWAP (intraday approximation using all available data)
    try:
        typical = (high + low + close) / 3
        cum_pv  = (typical * volume).cumsum()
        cum_vol = volume.cumsum()
        vwap_s  = cum_pv / cum_vol
        vwap    = _safe(vwap_s.iloc[-1])
    except Exception:
        vwap = None

    # MFI 14
    mfi_s = ta.mfi(high, low, close, volume, length=14)
    mfi_14 = _safe(mfi_s.iloc[-1] if mfi_s is not None and n > 0 else None)

    # CMF 20
    cmf_s = ta.cmf(high, low, close, volume, length=20)
    cmf_20 = _safe(cmf_s.iloc[-1] if cmf_s is not None and n > 0 else None)

    # Force Index 13
    try:
        fi_s = ta.efi(close, volume, length=13)
        fi_13 = _safe(fi_s.iloc[-1] if fi_s is not None and n > 0 else None)
    except Exception:
        fi_13 = None

    # ── Signals ───────────────────────────────────────────────────────────────

    oscillator_signals = {
        "rsi_14":     _signal_rsi(rsi_14),
        "stoch_k":    _signal_stoch(stoch_k, stoch_d),
        "stochrsi_k": _signal_stoch(stochrsi_k, stochrsi_d),
        "macd":       _signal_macd(macd_val, macd_sig),
        "cci_20":     _signal_cci(cci_20),
        "willr_14":   _signal_williams(willr_14),
        "uo":         _signal_momentum(uo_val - 50 if uo_val is not None else None),
        "roc_9":      _signal_momentum(roc_9),
        "ao":         _signal_ao(ao_val),
        "mom_10":     _signal_momentum(mom_10),
        "bull_power": _signal_momentum(bull_power),
        "bear_power": _signal_momentum(bear_power),
    }

    ma_signals = {
        "sma_5":   _signal_ma(last_close, sma_5),
        "sma_10":  _signal_ma(last_close, sma_10),
        "sma_20":  _signal_ma(last_close, sma_20),
        "sma_50":  _signal_ma(last_close, sma_50),
        "sma_100": _signal_ma(last_close, sma_100),
        "sma_200": _signal_ma(last_close, sma_200),
        "ema_5":   _signal_ma(last_close, ema_5),
        "ema_9":   _signal_ma(last_close, ema_9),
        "ema_10":  _signal_ma(last_close, ema_10),
        "ema_20":  _signal_ma(last_close, ema_20),
        "ema_21":  _signal_ma(last_close, ema_21),
        "ema_50":  _signal_ma(last_close, ema_50),
        "ema_100": _signal_ma(last_close, ema_100),
        "ema_200": _signal_ma(last_close, ema_200),
        "wma_10":  _signal_ma(last_close, wma_10),
        "wma_20":  _signal_ma(last_close, wma_20),
        "hma_9":   _signal_ma(last_close, hma_9),
        "vwma_20": _signal_ma(last_close, vwma_20),
    }

    oscillators_summary = _summary(list(oscillator_signals.values()))
    ma_summary          = _summary(list(ma_signals.values()))
    global_summary      = _summary(list(oscillator_signals.values()) + list(ma_signals.values()))

    return {
        # meta
        "close": last_close,
        # oscillators
        "rsi_14": rsi_14,
        "stoch_k": stoch_k, "stoch_d": stoch_d,
        "stochrsi_k": stochrsi_k, "stochrsi_d": stochrsi_d,
        "macd": macd_val, "macd_signal": macd_sig, "macd_hist": macd_hist,
        "cci_20": cci_20,
        "willr_14": willr_14,
        "uo": uo_val,
        "roc_9": roc_9,
        "ao": ao_val,
        "mom_10": mom_10,
        "bull_power": bull_power, "bear_power": bear_power,
        # moving averages
        "sma_5": sma_5, "sma_10": sma_10, "sma_20": sma_20,
        "sma_50": sma_50, "sma_100": sma_100, "sma_200": sma_200,
        "ema_5": ema_5, "ema_9": ema_9, "ema_10": ema_10,
        "ema_20": ema_20, "ema_21": ema_21,
        "ema_50": ema_50, "ema_100": ema_100, "ema_200": ema_200,
        "wma_10": wma_10, "wma_20": wma_20,
        "hma_9": hma_9, "vwma_20": vwma_20,
        # volatility
        "adx_14": adx_14, "adx_plus_di": adx_plus, "adx_minus_di": adx_minus,
        "atr_14": atr_14,
        "bb_upper": bb_upper, "bb_middle": bb_middle, "bb_lower": bb_lower, "bb_width": bb_width,
        "ichimoku_tenkan": tenkan, "ichimoku_kijun": kijun,
        # volume
        "obv": obv,
        "vwap": vwap,
        "mfi_14": mfi_14,
        "cmf_20": cmf_20,
        "fi_13": fi_13,
        # signals
        "oscillator_signals": oscillator_signals,
        "ma_signals": ma_signals,
        "oscillators_summary": oscillators_summary,
        "ma_summary": ma_summary,
        "global_summary": global_summary,
    }


def _publish_indicator(producer: Producer, ticker: str, tf: str, data: dict) -> None:
    payload = {
        "ticker": ticker,
        "timeframe": tf,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **data,
    }
    producer.produce(
        MARKET_INDICATORS_TOPIC,
        key=f"{ticker}_{tf}",
        value=json.dumps(payload),
    )
    producer.flush()


def run() -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0", "Accept": "application/json"})

    producer = Producer({"bootstrap.servers": KAFKA_BROKER})
    _wait_for_kafka(producer)

    log.info("Indicators producer started — tickers=%s timeframes=%s", TICKERS, ALL_TIMEFRAMES)

    while True:
        for ticker in TICKERS:
            for tf in ALL_TIMEFRAMES:
                try:
                    df = _fetch_candles(ticker, tf, session)
                    if df.empty or len(df) < MIN_CANDLES.get(tf, 30):
                        log.debug("Not enough candles for %s %s (%d)", ticker, tf, len(df))
                        continue
                    data = compute_indicators(df)
                    _publish_indicator(producer, ticker, tf, data)
                    log.info("Indicators published: %s %s (global=%s)", ticker, tf, data["global_summary"])
                except Exception as e:
                    log.error("Error computing indicators %s %s: %s", ticker, tf, e)
                time.sleep(0.2)  # small gap per ticker/tf to avoid rate limits

        log.info("Indicators cycle done — sleeping %ds", POLL_INTERVAL_SECONDS)
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
