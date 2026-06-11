import { useState, useEffect, useCallback, useRef } from 'react'
import { CandleTimeframe, MarketCandle, MarketIndicators, TickerFundamentals } from '@/types'
import { marketDataService } from '@/services/market-data'

const POLL_MS = 60_000

export interface SnapshotData {
  candles: MarketCandle[]
  indicators: MarketIndicators[]
  latestIndicator: MarketIndicators | null
  fundamentals: TickerFundamentals | null
}

interface UseSnapshotResult extends SnapshotData {
  loading: boolean
  error: string | null
  timeframe: CandleTimeframe
  setTimeframe: (tf: CandleTimeframe) => void
  refresh: () => void
}

export function useSnapshot(
  ticker: string,
  initialTimeframe: CandleTimeframe = '1h',
): UseSnapshotResult {
  const [candles,          setCandles]         = useState<MarketCandle[]>([])
  const [indicators,       setIndicators]      = useState<MarketIndicators[]>([])
  const [latestIndicator,  setLatestIndicator] = useState<MarketIndicators | null>(null)
  const [fundamentals,     setFundamentals]    = useState<TickerFundamentals | null>(null)
  const [loading,          setLoading]         = useState(true)
  const [error,            setError]           = useState<string | null>(null)
  const [timeframe,        setTfState]         = useState<CandleTimeframe>(initialTimeframe)

  const fetchingRef = useRef(false)
  const tfRef       = useRef(timeframe)
  const tickerRef   = useRef(ticker)

  const load = useCallback(async (tk: string, tf: CandleTimeframe) => {
    if (!tk || fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError(null)
    try {
      // Fetch snapshot (candles + indicators) and fundamentals in parallel
      const [snap, funds] = await Promise.all([
        marketDataService.getSnapshot(tk, tf, 300),
        marketDataService.getFundamentals(tk),
      ])
      if (!snap) {
        setError('No se pudieron cargar los datos')
        setCandles([])
        setIndicators([])
        setLatestIndicator(null)
      } else {
        setCandles(snap.candles)
        setIndicators(snap.indicators)
        const last = snap.indicators.length > 0 ? snap.indicators[snap.indicators.length - 1] : null
        setLatestIndicator(last)
      }
      setFundamentals(funds)
    } catch {
      setError('Error cargando datos de mercado')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  const pollLatest = useCallback(async () => {
    if (!tickerRef.current || fetchingRef.current) return
    try {
      const [latestCandle, latestInd] = await Promise.all([
        marketDataService.getLatestCandle(tickerRef.current, tfRef.current),
        marketDataService.getLatestIndicators(tickerRef.current, tfRef.current),
      ])
      if (latestCandle) {
        setCandles(prev => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          if (last.timestamp === latestCandle.timestamp) return [...prev.slice(0, -1), latestCandle]
          return [...prev, latestCandle]
        })
      }
      if (latestInd) setLatestIndicator(latestInd)
    } catch { /* silencioso */ }
  }, [])

  const setTimeframe = useCallback((tf: CandleTimeframe) => {
    tfRef.current = tf
    setTfState(tf)
    load(tickerRef.current, tf)
  }, [load])

  const refresh = useCallback(() => {
    load(tickerRef.current, tfRef.current)
  }, [load])

  useEffect(() => {
    tickerRef.current = ticker
    tfRef.current = initialTimeframe
    setTfState(initialTimeframe)
    load(ticker, initialTimeframe)
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ticker) return
    const id = setInterval(pollLatest, POLL_MS)
    return () => clearInterval(id)
  }, [ticker, pollLatest])

  return { candles, indicators, latestIndicator, fundamentals, loading, error, timeframe, setTimeframe, refresh }
}
