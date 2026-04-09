import { useState, useEffect } from 'react';
import { MOCK_TICKERS } from '@/utils/mock-data';
import { Ticker } from '@/types';

export function useMarketData() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setTickers(MOCK_TICKERS);
        setLoading(false);
      } catch {
        setError('Error cargando datos');
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const refetch = () => {
    setLoading(true);
    setTimeout(() => {
      setTickers(MOCK_TICKERS);
      setLoading(false);
    }, 500);
  };

  return { tickers, loading, error, refetch };
}
