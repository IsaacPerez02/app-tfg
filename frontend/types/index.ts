export interface Ticker {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  category: 'crypto' | 'forex' | 'commodity' | 'stock';
  icon?: string;
  historicalData: CandleData[];
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface News {
  id: string;
  title: string;
  description: string;
  content: string;
  image?: string;
  source: string;
  category: 'crypto' | 'forex' | 'stocks' | 'economy' | 'general';
  timestamp: Date;
  sentiment: 'positive' | 'neutral' | 'negative';
  relatedTickers?: string[];
  url?: string;
}

/**
 * Formato exacto que devuelve GET /news (FastAPI puerto 8002).
 * Basado en api/schemas/news.py — NewsItem.
 * sentiment es float: >0.1 positivo, <-0.1 negativo, resto neutral.
 */
export interface BackendNews {
  _id: string;            // mapeado desde _id de Mongo
  date: string;          // ISO 8601
  title: string;
  text: string;          // cuerpo completo
  summary: string;       // resumen generado
  url: string;
  source: string;
  tickers: string[];
  persons: string[];
  organizations: string[];
  themes: string[];
  sentiment: number;          // float: positivo > 0, negativo < 0
  importance_score: number;   // 0.0 – 1.0
  created_at: string | null;
}

/** Trending ticker — GET /trending */
export interface TrendingTicker {
  ticker: string;
  mention_count: number;
  avg_sentiment: number;
  recent_mentions: number;
  acceleration: number;
  trending_score: number;
}

/** Modos de feed soportados por el backend */
export type NewsFeedMode = 'latest' | 'top';

/** Deriva etiqueta y color de sentimiento desde el float del backend */
export function parseSentiment(value: number): {
  label: 'Positivo' | 'Neutral' | 'Negativo';
  key: 'positive' | 'neutral' | 'negative';
  color: string;
} {
  if (value > 0.1)  return { label: 'Positivo', key: 'positive', color: '#05B169' };
  if (value < -0.1) return { label: 'Negativo', key: 'negative', color: '#F6465D' };
  return               { label: 'Neutral',  key: 'neutral',  color: '#F0B90B' };
}

export interface AIRecommendation {
  id: string;
  ticker: string;
  tickerName: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  targetPrice: number;
  stopLoss: number;
  entryPrice?: number;
  analysis: string;
  indicators: {
    rsi: number;
    macd: string;
    movingAverage50: number;
    bollinger: string;
  };
  timeframe: '1h' | '4h' | '1d' | '1w';
  timestamp: Date;
  aiModel: string;
  risk: 'low' | 'medium' | 'high';
}
