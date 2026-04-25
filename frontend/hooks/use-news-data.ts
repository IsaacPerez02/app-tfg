import { useState, useEffect, useCallback, useRef } from 'react'
import { BackendNews, NewsFeedMode } from '@/types'
import { newsService } from '@/services/news'

const PAGE_SIZE = 20

interface UseNewsFeedResult {
  news: BackendNews[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
  mode: NewsFeedMode
  setMode: (m: NewsFeedMode) => void
}

export function useNewsFeed(initialMode: NewsFeedMode = 'latest'): UseNewsFeedResult {
  const [news,        setNews]        = useState<BackendNews[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [hasMore,     setHasMore]     = useState(true)
  const [mode,        setModeState]   = useState<NewsFeedMode>(initialMode)

  // Refs estables para evitar stale closures
  const pageRef       = useRef(1)
  const fetchingRef   = useRef(false)
  const modeRef       = useRef(mode)

  // Carga inicial / refresh — resetea todo
  const load = useCallback(async (currentMode: NewsFeedMode) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    pageRef.current = 1
    setLoading(true)
    setError(null)
    setHasMore(true)
    try {
      const data = await newsService.getNewsByMode(currentMode, 1, PAGE_SIZE)
      if (data === null) {
        setError('No se pudieron cargar las noticias')
        setNews([])
      } else {
        setNews(data)
        setHasMore(data.length === PAGE_SIZE)
      }
    } catch {
      setError('Error cargando noticias')
      setNews([])
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // Siguiente página — append
  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return
    fetchingRef.current = true
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    try {
      const data = await newsService.getNewsByMode(modeRef.current, nextPage, PAGE_SIZE)
      if (data && data.length > 0) {
        setNews(prev => {
          // Deduplicar por _id
          const existing = new Set(prev.map(n => n._id))
          const fresh = data.filter(n => !existing.has(n._id))
          return [...prev, ...fresh]
        })
        pageRef.current = nextPage
        setHasMore(data.length === PAGE_SIZE)
      } else {
        setHasMore(false)
      }
    } catch {
      // No mostramos error en loadMore — la lista existente sigue visible
    } finally {
      setLoadingMore(false)
      fetchingRef.current = false
    }
  }, [hasMore])

  const setMode = useCallback((m: NewsFeedMode) => {
    modeRef.current = m
    setModeState(m)
    load(m)
  }, [load])

  const refresh = useCallback(() => load(modeRef.current), [load])

  useEffect(() => {
    modeRef.current = initialMode
    load(initialMode)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { news, loading, loadingMore, error, hasMore, refresh, loadMore, mode, setMode }
}
