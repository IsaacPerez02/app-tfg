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

/**
 * Formato exacto que devuelve GET /tickers (FastAPI puerto 8003).
 * Basado en TICKER_METADATA de kafka-service/data/api/config.py.
 * Es el equivalente de BackendNews en el sistema de noticias.
 */
export interface TickerSummary {
  ticker: string;       // e.g. "BTC-USD"
  name: string;         // e.g. "Bitcoin"
  category: string;     // "crypto" | "stock" | ...
  price: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  change: number;       // % change from open
  changeAbs: number;    // absolute change
  last_updated: string | null;
}

/**
 * Formato exacto que devuelve GET /candles (FastAPI puerto 8003).
 * Basado en kafka-service/data/api/schemas/marketCandle.py — MarketCandle.
 */
export interface MarketCandle {
  ticker: string;
  timestamp: string;     // ISO 8601
  timeframe: string;     // "1m" | "5m" | "15m" | "1h" | "4h" | "1d"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  created_at: string | null;
}

export type CandleTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * Indicadores técnicos del endpoint GET /market-indicators (puerto 8003).
 * Basado en kafka-service/data/api/schemas/data.py — MarketIndicators.
 */
export interface MarketIndicators {
  ticker: string;
  timestamp: string;
  timeframe: string;
  close?: number | null;
  // Oscillators
  rsi_14:       number | null;
  stoch_k:      number | null;
  stoch_d:      number | null;
  stochrsi_k:   number | null;
  stochrsi_d:   number | null;
  macd:         number | null;
  macd_signal:  number | null;
  macd_hist:    number | null;
  // legacy alias
  macd_histogram?: number | null;
  cci_20:       number | null;
  willr_14:     number | null;
  uo:           number | null;
  roc_9:        number | null;
  ao:           number | null;
  mom_10:       number | null;
  bull_power:   number | null;
  bear_power:   number | null;
  // Moving averages
  sma_5:   number | null;
  sma_10:  number | null;
  sma_20:  number | null;
  sma_50:  number | null;
  sma_100: number | null;
  sma_200: number | null;
  ema_5:   number | null;
  ema_9:   number | null;
  ema_10:  number | null;
  ema_20:  number | null;
  ema_21:  number | null;
  ema_50:  number | null;
  ema_100: number | null;
  ema_200: number | null;
  wma_10:  number | null;
  wma_20:  number | null;
  hma_9:   number | null;
  vwma_20: number | null;
  // Volatility
  adx_14:           number | null;
  adx_plus_di:      number | null;
  adx_minus_di:     number | null;
  atr_14:           number | null;
  bollinger_upper:  number | null;
  bollinger_middle: number | null;
  bollinger_lower:  number | null;
  bollinger_width:  number | null;
  // legacy aliases
  bb_upper?:  number | null;
  bb_middle?: number | null;
  bb_lower?:  number | null;
  bb_width?:  number | null;
  ichimoku_tenkan: number | null;
  ichimoku_kijun:  number | null;
  // Volume
  obv:    number | null;
  vwap:   number | null;
  mfi_14: number | null;
  cmf_20: number | null;
  fi_13:  number | null;
  // legacy
  volume_sma_20?: number | null;
  // Signals (from producer_indicators.py)
  oscillator_signals?: Record<string, string>;
  ma_signals?:         Record<string, string>;
  oscillators_summary?: string;
  ma_summary?:          string;
  global_summary?:      string;
  // legacy stats
  returns_1d?:     number | null;
  log_returns_1d?: number | null;
  volatility_7d?:  number | null;
  zscore_price?:   number | null;
}

/**
 * Fundamentales del endpoint GET /fundamentals/{ticker} (proxy en puerto 8003 → 8000).
 * Basado en yfinance-api/fundamentals/downloader.py.
 */
export interface TickerFundamentals {
  marketCap:             number | null;
  trailingPE:            number | null;
  forwardPE:             number | null;
  trailingEps:           number | null;
  forwardEps:            number | null;
  totalRevenue:          number | null;
  grossMargins:          number | null;
  operatingMargins:      number | null;
  profitMargins:         number | null;
  returnOnEquity:        number | null;
  returnOnAssets:        number | null;
  debtToEquity:          number | null;
  currentRatio:          number | null;
  fiftyTwoWeekHigh:      number | null;
  fiftyTwoWeekLow:       number | null;
  beta:                  number | null;
  dividendYield:         number | null;
  payoutRatio:           number | null;
  sharesOutstanding:     number | null;
  floatShares:           number | null;
  targetMeanPrice:       number | null;
  targetHighPrice:       number | null;
  targetLowPrice:        number | null;
  sector:                string | null;
  industry:              string | null;
  shortName:             string | null;
  longName:              string | null;
  currency:              string | null;
  // legacy fields also present
  priceToBook?:          number | null;
  freeCashflow?:         number | null;
  [key: string]: unknown;
}

/** FinBERT sentiment result attached to each sentiment article */
export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral';
  score: number;   // 0.0 – 1.0 softmax probability
  model: string;   // "finbert-aapl-cls"
}

/**
 * Formato exacto que devuelve GET /sentiment (FastAPI puerto 8004).
 * Todos los campos de BackendNews + sentiment estructurado de FinBERT.
 */
export interface BackendSentimentNews {
  _id: string;
  date: string;
  title: string;
  text: string;
  summary: string;
  url: string;
  source: string;
  tickers: string[];
  persons: string[];
  organizations: string[];
  themes: string[];
  importance_score: number;
  sentiment: SentimentResult;
  created_at: string | null;
}

/** Deriv etiqueta y color desde SentimentResult de FinBERT */
export function parseSentimentResult(s: SentimentResult): {
  label: 'Positivo' | 'Neutral' | 'Negativo';
  key: 'positive' | 'neutral' | 'negative';
  color: string;
} {
  if (s.label === 'positive') return { label: 'Positivo', key: 'positive', color: '#05B169' };
  if (s.label === 'negative') return { label: 'Negativo', key: 'negative', color: '#F6465D' };
  return { label: 'Neutral', key: 'neutral', color: '#F0B90B' };
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

/** Thermometer value from sentiment API (GET /thermometer/latest, /thermometer/history) */
export interface ThermometerValue {
  symbol: string;
  timestamp: string;     // ISO 8601
  thermometer_indicator: number;  // [0, 1] normalized
  thermometer_raw: number;         // [-1, +1] raw
  thermometer_polarity: number;    // [0, 1] conviction
  alert_level: string;   // MUY ALTO / ALTO / NEUTRO / BAJO / MUY BAJO
  signal: string;        // BUY / SELL / NEUTRAL
  articles_in_window: number;
  total_weight: number;
}
