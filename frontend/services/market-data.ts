/**
 * Capa de acceso a la API de market data (FastAPI, puerto 8003).
 *
 * Endpoints:
 *   GET /tickers                                        → TickerSummary[]
 *   GET /candles?ticker=X&timeframe=1m&limit=500        → MarketCandle[]
 *   GET /latest/{ticker}?timeframe=1m                   → MarketCandle
 *   GET /market-indicators?ticker=X&timeframe=1m        → MarketIndicators[]
 *   GET /latest-indicators/{ticker}?timeframe=1m        → MarketIndicators
 *   GET /snapshot/{ticker}/{timeframe}                  → candles + indicators
 *   GET /fundamentals/{ticker}                          → TickerFundamentals (proxy a yfinance-api)
 *   GET /health                                         → {status, candles_1m}
 */

import { CandleTimeframe, MarketCandle, MarketIndicators, TickerFundamentals, TickerSummary } from '@/types'

const BASE = process.env.EXPO_PUBLIC_API_DATA // http://localhost:8003

// Número de candles a pedir según timeframe — suficiente para un chart útil
const TIMEFRAME_LIMITS: Record<CandleTimeframe, number> = {
  '1m':  500,  // ~8 horas
  '5m':  500,  // ~42 horas
  '15m': 500,  // ~5 días
  '1h':  720,  // ~30 días
  '4h':  360,  // ~60 días
  '1d':  365,  // ~1 año
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ── Response shapes ───────────────────────────────────────────────────────────

interface TickersResponse {
  tickers: TickerSummary[]
  count: number
}

interface CandlesResponse {
  ticker: string
  timeframe: string
  count: number
  candles: MarketCandle[]
}

interface LatestResponse {
  ticker: string
  timeframe: string
  candle: MarketCandle | null
}

// ── Service ───────────────────────────────────────────────────────────────────

export const marketDataService = {
  /**
   * GET /tickers
   * Devuelve todos los activos tracked con su resumen OHLCV en vivo.
   * Es el equivalente de getNewsByMode() para el sistema de market data.
   * La lista proviene de TICKER_METADATA en kafka-service/data/api/config.py.
   */
  getTickers: async (): Promise<TickerSummary[] | null> => {
    const data = await safeFetch<TickersResponse>(`${BASE}/tickers`)
    return data?.tickers ?? null
  },

  /**
   * GET /candles?ticker=BTC-USD&timeframe=1m&limit=500
   * Devuelve los últimos N candles en orden descendente.
   * Los invertimos antes de devolverlos (chart espera orden ascendente).
   */
  getCandles: async (
    ticker: string,
    timeframe: CandleTimeframe,
    limit?: number
  ): Promise<MarketCandle[] | null> => {
    const n = limit ?? TIMEFRAME_LIMITS[timeframe]
    const data = await safeFetch<CandlesResponse>(
      `${BASE}/candles?ticker=${encodeURIComponent(ticker)}&timeframe=${timeframe}&limit=${n}`
    )
    if (!data?.candles) return null
    return data.candles
  },

  /**
   * GET /latest/{ticker}?timeframe=1m
   * El candle más reciente disponible.
   */
  getLatestCandle: async (
    ticker: string,
    timeframe: CandleTimeframe = '1m'
  ): Promise<MarketCandle | null> => {
    const data = await safeFetch<LatestResponse>(
      `${BASE}/latest/${encodeURIComponent(ticker)}?timeframe=${timeframe}`
    )
    return data?.candle ?? null
  },

  /** GET /market-indicators?ticker=X&timeframe=tf&limit=N */
  getMarketIndicators: async (
    ticker: string,
    timeframe: CandleTimeframe,
    limit = 200,
  ): Promise<MarketIndicators[] | null> => {
    const data = await safeFetch<{ indicators: MarketIndicators[] }>(
      `${BASE}/market-indicators?ticker=${encodeURIComponent(ticker)}&timeframe=${timeframe}&limit=${limit}`
    )
    return data?.indicators ?? null
  },

  /** GET /latest-indicators/{ticker}?timeframe=tf → el indicador más reciente */
  getLatestIndicators: async (
    ticker: string,
    timeframe: CandleTimeframe = '1h',
  ): Promise<MarketIndicators | null> => {
    const data = await safeFetch<{ indicator: MarketIndicators | null }>(
      `${BASE}/latest-indicators/${encodeURIComponent(ticker)}?timeframe=${timeframe}`
    )
    return data?.indicator ?? null
  },

  /** GET /snapshot/{ticker}/{timeframe} → candles + indicators en una sola llamada */
  getSnapshot: async (
    ticker: string,
    timeframe: CandleTimeframe,
    limit = 300,
  ): Promise<{ candles: MarketCandle[]; indicators: MarketIndicators[] } | null> => {
    const data = await safeFetch<{
      candles: MarketCandle[]
      indicators: MarketIndicators[]
    }>(`${BASE}/snapshot/${encodeURIComponent(ticker)}/${timeframe}?limit=${limit}`)
    if (!data) return null
    return { candles: data.candles ?? [], indicators: data.indicators ?? [] }
  },

  /** GET /fundamentals/{ticker} (proxy a yfinance-api puerto 8000) */
  getFundamentals: async (ticker: string): Promise<TickerFundamentals | null> => {
    const data = await safeFetch<{ ticker: string; data: TickerFundamentals }>(
      `${BASE}/fundamentals/${encodeURIComponent(ticker)}`
    )
    return data?.data ?? null
  },

  /** GET /health */
  health: async (): Promise<{ status: string; candles_1m: number } | null> => {
    return safeFetch<{ status: string; candles_1m: number }>(`${BASE}/health`)
  },
}
