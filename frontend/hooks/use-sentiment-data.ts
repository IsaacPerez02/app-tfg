import { useState, useEffect, useCallback, useRef } from 'react'
import { BackendSentimentNews, NewsFeedMode } from '@/types'
import { sentimentService } from '@/services/sentiment'

const PAGE_SIZE = 20

interface UseSentimentFeedResult {
  articles: BackendSentimentNews[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
  mode: NewsFeedMode
  setMode: (m: NewsFeedMode) => void
}

export function useSentimentFeed(initialMode: NewsFeedMode = 'latest'): UseSentimentFeedResult {
  const [articles,    setArticles]    = useState<BackendSentimentNews[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [hasMore,     setHasMore]     = useState(true)
  const [mode,        setModeState]   = useState<NewsFeedMode>(initialMode)

  const pageRef     = useRef(1)
  const fetchingRef = useRef(false)
  const modeRef     = useRef(mode)

  const load = useCallback(async (currentMode: NewsFeedMode) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    pageRef.current = 1
    setLoading(true)
    setError(null)
    setHasMore(true)
    try {
      const data = await sentimentService.getByMode(currentMode, 1, PAGE_SIZE)
      if (data === null) {
        setError('No se pudieron cargar los análisis')
        setArticles([])
      } else {
        setArticles(data)
        setHasMore(data.length === PAGE_SIZE)
      }
    } catch {
      setError('Error cargando análisis')
      setArticles([])
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return
    fetchingRef.current = true
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    try {
      const data = await sentimentService.getByMode(modeRef.current, nextPage, PAGE_SIZE)
      if (data && data.length > 0) {
        setArticles(prev => {
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
      // mantener lista existente
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

  return { articles, loading, loadingMore, error, hasMore, refresh, loadMore, mode, setMode }
}
