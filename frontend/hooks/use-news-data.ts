import { useState, useEffect } from 'react';
import { MOCK_NEWS } from '@/utils/mock-data';
import { News } from '@/types';

export function useNewsData(category?: string) {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const filtered = category
        ? MOCK_NEWS.filter(n => n.category === category)
        : MOCK_NEWS;
      setNews(filtered);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [category]);

  return { news, loading };
}
