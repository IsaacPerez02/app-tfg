import { useEffect, useState } from 'react'
import { ThermometerValue } from '@/types'

interface ThermometerHistory {
  count: number
  history: ThermometerValue[]
}

interface UseThermometerReturn {
  latest: ThermometerValue | null
  history: ThermometerValue[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const API_BASE = process.env.EXPO_PUBLIC_API_SENTIMENT || 'http://localhost:8004'

async function fetchThermometerLatest(): Promise<ThermometerValue | null> {
  try {
    const res = await fetch(`${API_BASE}/thermometer/latest`)
    if (!res.ok) return null
    return (await res.json()) as ThermometerValue
  } catch {
    return null
  }
}

async function fetchThermometerHistory(days: number): Promise<ThermometerValue[]> {
  try {
    const res = await fetch(`${API_BASE}/thermometer/history?days=${days}`)
    if (!res.ok) return []
    const data = (await res.json()) as ThermometerHistory
    return data.history || []
  } catch {
    return []
  }
}

export function useThermometer(historyDays: number = 90): UseThermometerReturn {
  const [latest, setLatest] = useState<ThermometerValue | null>(null)
  const [history, setHistory] = useState<ThermometerValue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const [latestData, historyData] = await Promise.all([
        fetchThermometerLatest(),
        fetchThermometerHistory(historyDays),
      ])

      if (!latestData) {
        setError('Failed to fetch thermometer data')
      } else {
        setLatest(latestData)
        setHistory(historyData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [historyDays])

  return { latest, history, loading, error, refresh }
}
