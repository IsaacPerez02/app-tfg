/**
 * Capa de acceso a la API de market data (FastAPI, puerto 8003).
 *
 * El frontend llama DIRECTAMENTE a FastAPI para candles.
 * Misma arquitectura que services/news.ts — NO pasa por Express.
 *
 * Endpoints reales (kafka-service/data/api/main.py):
 *   GET /candles?ticker=BTC-USD&timeframe=1m&limit=500  → MarketCandle[]
 *   GET /candles/{ticker}/{timeframe}                   → MarketCandle[]
 *   GET /latest/{ticker}?timeframe=1m                  → MarketCandle
 *   GET /health                                         → {status, candles_1m}
 */

import { CandleTimeframe, MarketCandle, TickerSummary } from '@/types'

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

  /** GET /health */
  health: async (): Promise<{ status: string; candles_1m: number } | null> => {
    return safeFetch<{ status: string; candles_1m: number }>(`${BASE}/health`)
  },
}
