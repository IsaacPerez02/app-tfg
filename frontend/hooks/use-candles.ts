import { useState, useEffect, useCallback, useRef } from 'react'
import { CandleTimeframe, MarketCandle } from '@/types'
import { marketDataService } from '@/services/market-data'

const POLL_MS = 60_000 // 60 s — matches backend ingestion interval

interface UseCandlesResult {
  candles: MarketCandle[]
  loading: boolean
  error: string | null
  timeframe: CandleTimeframe
  setTimeframe: (tf: CandleTimeframe) => void
  refresh: () => void
}

export function useCandles(
  ticker: string,
  initialTimeframe: CandleTimeframe = '1h'
): UseCandlesResult {
  const [candles,   setCandles]   = useState<MarketCandle[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [timeframe, setTfState]   = useState<CandleTimeframe>(initialTimeframe)

  // Refs estables — evitan stale closures en el polling
  const fetchingRef  = useRef(false)
  const tfRef        = useRef(timeframe)
  const tickerRef    = useRef(ticker)

  // Carga histórica completa — resetea el estado
  const load = useCallback(async (tk: string, tf: CandleTimeframe) => {
    if (!tk) return
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const data = await marketDataService.getCandles(tk, tf)
      if (data === null) {
        setError('No se pudieron cargar los candles')
        setCandles([])
      } else {
        setCandles(data)
      }
    } catch {
      setError('Error cargando datos de mercado')
      setCandles([])
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // Poll: obtiene el último candle y lo fusiona si es nuevo
  const pollLatest = useCallback(async () => {
    if (!tickerRef.current || fetchingRef.current) return
    try {
      const latest = await marketDataService.getLatestCandle(tickerRef.current, tfRef.current)
      if (!latest) return
      setCandles(prev => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last.timestamp === latest.timestamp) {
          // Actualizar el último candle (puede haber cambiado el close/high/low)
          return [...prev.slice(0, -1), latest]
        }
        // Nuevo candle — append
        return [...prev, latest]
      })
    } catch {
      // Silencioso — la lista existente sigue visible
    }
  }, [])

  const setTimeframe = useCallback((tf: CandleTimeframe) => {
    tfRef.current = tf
    setTfState(tf)
    load(tickerRef.current, tf)
  }, [load])

  const refresh = useCallback(() => {
    load(tickerRef.current, tfRef.current)
  }, [load])

  // Carga inicial
  useEffect(() => {
    tickerRef.current = ticker
    tfRef.current = initialTimeframe
    setTfState(initialTimeframe)
    load(ticker, initialTimeframe)
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling de actualización cada 60 s
  useEffect(() => {
    if (!ticker) return
    const id = setInterval(pollLatest, POLL_MS)
    return () => clearInterval(id)
  }, [ticker, pollLatest])

  return { candles, loading, error, timeframe, setTimeframe, refresh }
}
