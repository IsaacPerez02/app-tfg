/**
 * Capa de acceso a la API de noticias (FastAPI, puerto 8002).
 *
 * El frontend llama DIRECTAMENTE a FastAPI para noticias.
 * NO pasa por Express (decisión de arquitectura: Express solo para tickers/auth).
 *
 * Endpoints reales (api/main.py):
 *   GET /news?mode=top|latest&limit=50   → BackendNews[]
 *   GET /trending?window=1h|6h|24h       → TrendingTicker[]
 *   GET /health                          → {status, articles}
 *
 * NOTA: No existe GET /news/:id.
 *       El detalle funciona desde el cache en memoria (newsCache).
 */

import { BackendNews, NewsFeedMode, TrendingTicker } from '@/types'

const BASE = process.env.EXPO_PUBLIC_API_NEWS // http://192.168.x.x:8002

// ── Cache de noticias ─────────────────────────────────────────────────────────
// Compartido entre el feed y el detalle, ya que no existe endpoint de detalle.

export const newsCache = new Map<string, BackendNews>()

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

// ── Service ───────────────────────────────────────────────────────────────────

export const newsService = {
  /**
   * GET /news?mode=latest|top&limit=50
   * Puebla newsCache como efecto secundario.
   */
  getNewsByMode: async (
    mode: NewsFeedMode,
    page = 1,
    limit = 20
  ): Promise<BackendNews[] | null> => {
    const data = await safeFetch<BackendNews[]>(
      `${BASE}/news?mode=${mode}&page=${page}&limit=${limit}`
    )
    if (data) {
      for (const item of data) newsCache.set(item._id, item)
    }
    return data
  },

  /** Wrappers semánticos */
  getLatestNews: (page = 1, limit = 20) => newsService.getNewsByMode('latest', page, limit),
  getTopNews:    (page = 1, limit = 20) => newsService.getNewsByMode('top',    page, limit),

  /**
   * GET /news/:id — endpoint real.
   * Primero intenta el cache; si no está, hace fetch.
   */
  getNewsById: async (id: string): Promise<BackendNews | null> => {
    if (newsCache.has(id)) return newsCache.get(id)!
    const data = await safeFetch<BackendNews>(`${BASE}/news/${encodeURIComponent(id)}`)
    if (data) newsCache.set(id, data)
    return data
  },

  /** GET /news?ticker=INTC&mode=top&limit=N — top N noticias para un ticker */
  getNewsByTicker: async (
    ticker: string,
    limit = 3
  ): Promise<BackendNews[] | null> => {
    const data = await safeFetch<BackendNews[]>(
      `${BASE}/news?ticker=${ticker.toUpperCase()}&mode=top&limit=${limit}`
    )
    if (data) {
      for (const item of data) newsCache.set(item._id, item)
    }
    return data
  },

  /** GET /trending?window=1h|6h|24h */
  getTrending: async (
    window: '1h' | '6h' | '24h' = '24h'
  ): Promise<TrendingTicker[] | null> => {
    return safeFetch<TrendingTicker[]>(`${BASE}/trending?window=${window}`)
  },

  /** GET /health */
  health: async (): Promise<{ status: string; articles: number } | null> => {
    return safeFetch<{ status: string; articles: number }>(`${BASE}/health`)
  },
}
