/**
 * Hook de acceso a la lista de tickers del data service.
 *
 * Arquitectura idéntica a use-news-data.ts:
 *   - carga inicial en mount
 *   - auto-refresh configurable
 *   - mismo shape de retorno (loading / error / refresh)
 *
 * La fuente de verdad es GET /tickers (puerto 8003), que a su vez
 * deriva su lista de TICKER_METADATA en kafka-service/data/api/config.py.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { TickerSummary } from '@/types'
import { marketDataService } from '@/services/market-data'

const REFRESH_MS = 30_000 // 30 s — mismo intervalo que tickers.tsx usaba con Express

interface UseTickersListResult {
  tickers: TickerSummary[]
  loading: boolean
  error: string | null
  refresh: () => void
  /** Set of ticker symbols tracked by the data service — useful for routing */
  trackedSymbols: Set<string>
}

export function useTickersList(): UseTickersListResult {
  const [tickers,  setTickers]  = useState<TickerSummary[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetchingRef = useRef(false)

  const load = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setError(null)
    try {
      const data = await marketDataService.getTickers()
      if (data === null) {
        setError('No se pudieron cargar los activos')
      } else {
        setTickers(data)
      }
    } catch {
      setError('Error cargando activos del data service')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    load()
  }, [load])

  // Carga inicial
  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh — mantiene precios actualizados sin interacción del usuario
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const trackedSymbols = new Set(tickers.map(t => t.ticker))

  return { tickers, loading, error, refresh, trackedSymbols }
}
