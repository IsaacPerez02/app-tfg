import { useState, useEffect } from 'react';
import { MOCK_RECOMMENDATIONS } from '@/utils/mock-data';
import { AIRecommendation } from '@/types';

export function useAIRecommendations(filter?: 'BUY' | 'SELL' | 'HOLD') {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const filtered = filter
        ? MOCK_RECOMMENDATIONS.filter(r => r.action === filter)
        : MOCK_RECOMMENDATIONS;

      setRecommendations(
        filtered.sort((a, b) => b.confidence - a.confidence)
      );
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [filter]);

  return { recommendations, loading };
}
