import { useState, useEffect } from 'react'
import { BackendNews } from '@/types'
import { newsService } from '@/services/news'

interface UseNewsDetailResult {
  news: BackendNews | null
  loading: boolean
  error: string | null
}

export function useNewsDetail(id: string): UseNewsDetailResult {
  const [news,    setNews]    = useState<BackendNews | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    newsService.getNewsById(id).then(data => {
      if (cancelled) return
      if (data) {
        setNews(data)
      } else {
        setError('Noticia no encontrada')
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [id])

  return { news, loading, error }
}
