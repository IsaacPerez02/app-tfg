/**
 * Capa de acceso a la API de sentimiento (FastAPI, puerto 8004).
 *
 * Endpoints reales (kafka-service/sentiment/api/main.py):
 *   GET /sentiment?mode=latest|top&limit=20&page=1&ticker=AAPL  → BackendSentimentNews[]
 *   GET /sentiment/:id                                           → BackendSentimentNews
 *   GET /health                                                  → {status, articles}
 */

import { BackendSentimentNews, NewsFeedMode } from '@/types'

const BASE = process.env.EXPO_PUBLIC_API_SENTIMENT // http://192.168.x.x:8004

export const sentimentCache = new Map<string, BackendSentimentNews>()

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const sentimentService = {
  getByMode: async (
    mode: NewsFeedMode,
    page = 1,
    limit = 20
  ): Promise<BackendSentimentNews[] | null> => {
    const data = await safeFetch<BackendSentimentNews[]>(
      `${BASE}/sentiment?mode=${mode}&page=${page}&limit=${limit}`
    )
    if (data) {
      for (const item of data) sentimentCache.set(item._id, item)
    }
    return data
  },

  getLatest: (page = 1, limit = 20) => sentimentService.getByMode('latest', page, limit),
  getTop:    (page = 1, limit = 20) => sentimentService.getByMode('top',    page, limit),

  getById: async (id: string): Promise<BackendSentimentNews | null> => {
    if (sentimentCache.has(id)) return sentimentCache.get(id)!
    const data = await safeFetch<BackendSentimentNews>(`${BASE}/sentiment/${encodeURIComponent(id)}`)
    if (data) sentimentCache.set(id, data)
    return data
  },

  health: async (): Promise<{ status: string; articles: number } | null> => {
    return safeFetch<{ status: string; articles: number }>(`${BASE}/health`)
  },
}
