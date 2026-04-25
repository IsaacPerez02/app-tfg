import { useState, useEffect } from 'react'
import { BackendNews } from '@/types'
import { newsService } from '@/services/news'

interface UseNewsByTickerResult {
  news: BackendNews[]
  loading: boolean
}

export function useNewsByTicker(ticker: string): UseNewsByTickerResult {
  const [news,    setNews]    = useState<BackendNews[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    newsService.getNewsByTicker(ticker, 3).then(data => {
      if (!cancelled) setNews(data ?? [])
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [ticker])

  return { news, loading }
}
