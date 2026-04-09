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
