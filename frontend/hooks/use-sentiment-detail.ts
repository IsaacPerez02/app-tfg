import { useState, useEffect } from 'react'
import { BackendSentimentNews } from '@/types'
import { sentimentService } from '@/services/sentiment'

interface UseSentimentDetailResult {
  article: BackendSentimentNews | null
  loading: boolean
  error: string | null
}

export function useSentimentDetail(id: string): UseSentimentDetailResult {
  const [article, setArticle] = useState<BackendSentimentNews | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    sentimentService.getById(id).then(data => {
      if (cancelled) return
      if (data) {
        setArticle(data)
      } else {
        setError('Análisis no encontrado')
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [id])

  return { article, loading, error }
}
