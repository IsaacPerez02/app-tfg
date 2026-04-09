// backend/routes/tickers.js

const express = require('express');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const Ticker = require('../models/Tickers');

const router = express.Router();

// ============================================
// ⚙️ CONFIGURACIÓN Y CACHÉ
// ============================================

const CACHE = new Map(); // { symbol: { data, timestamp } }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const DEFAULT_SYMBOLS = ['BTC-USD', 'ETH-USD', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'NVDA'];

// ============================================
// 📈 UTILIDADES Y HELPERS
// ============================================

function isCacheValid(symbol) {
  const cached = CACHE.get(symbol);
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_TTL;
}

function setCacheData(symbol, data) {
  CACHE.set(symbol, {
    data,
    timestamp: Date.now()
  });
}

function getCacheData(symbol) {
  const cached = CACHE.get(symbol);
  return cached?.data || null;
}

/**
 * Calcula Simple Moving Average
 */
function calculateSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    result.push(Number(avg.toFixed(2)));
  }
  return result;
}

/**
 * Calcula RSI (Relative Strength Index)
 */
function calculateRSI(data, period = 14) {
  const result = [];
  const closes = data.map(d => d.close);

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }

    const gains = [];
    const losses = [];

    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains.push(diff);
      else losses.push(Math.abs(diff));
    }

    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    result.push(Number(rsi.toFixed(2)));
  }

  return result;
}

/**
 * Calcula MACD (Moving Average Convergence Divergence)
 */
function calculateMACD(data) {
  const closes = data.map(d => d.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine = ema12.map((v12, i) => {
    if (!v12 || !ema26[i]) return null;
    return Number((v12 - ema26[i]).toFixed(2));
  });

  const signalLine = calculateEMA(macdLine.filter(v => v !== null), 9);

  return { macdLine, signalLine };
}

/**
 * Calcula EMA (Exponential Moving Average)
 */
function calculateEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);

  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += data[i];
  }
  sma /= period;
  result.push(Number(sma.toFixed(2)));

  for (let i = period; i < data.length; i++) {
    const ema = (data[i] - result[result.length - 1]) * k + result[result.length - 1];
    result.push(Number(ema.toFixed(2)));
  }

  return result;
}

/**
 * Calcula Bollinger Bands
 */
function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const closes = data.map(d => d.close);
  const sma = calculateSMA(data, period);

  const result = {
    upper: [],
    middle: [],
    lower: []
  };

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || sma[i] === null) {
      result.upper.push(null);
      result.middle.push(null);
      result.lower.push(null);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    result.middle.push(Number(mean.toFixed(2)));
    result.upper.push(Number((mean + stdDev * multiplier).toFixed(2)));
    result.lower.push(Number((mean - stdDev * multiplier).toFixed(2)));
  }

  return result;
}

/**
 * Valida si un símbolo es válido
 */
function isValidSymbol(symbol) {
  return /^[A-Z0-9\-\.]{1,10}$/.test(symbol);
}

/**
 * Formatea datos de volumen
 */
function formatVolume(volume) {
  if (!volume) return 'N/A';
  if (volume >= 1e9) return '$' + (volume / 1e9).toFixed(2) + 'B';
  if (volume >= 1e6) return '$' + (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return '$' + (volume / 1e3).toFixed(2) + 'K';
  return '$' + volume.toFixed(0);
}

/**
 * Fetch quote con reintento
 */
async function fetchQuoteWithRetry(symbol, maxRetries = 3) {
  if (isCacheValid(symbol)) {
    return getCacheData(symbol);
  }

  let yfQuote = null;
  try {
    yfQuote = await Promise.race([
      yahooFinance.quote(symbol),
      new Promise((_, reject) => setTimeout(() => reject(new Error('YF Timeout')), 3000))
    ]);
  } catch (err) {
    console.warn(`[War] yahooFinance.quote timeout/error for ${symbol}`);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();

      if (!json.chart || !json.chart.result || !json.chart.result[0]) {
        throw new Error("No data found");
      }

      const meta = json.chart.result[0].meta;
      const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
      const price = meta.regularMarketPrice ?? 0;
      const changeAbs = price - prevClose;
      const change = prevClose > 0 ? (changeAbs / prevClose) * 100 : 0;

      const marketCap =
        yfQuote?.marketCap ??
        yfQuote?.marketCap?.raw ??
        yfQuote?.price?.marketCap ??
        null;

      const data = {
        symbol,
        name: symbol,
        price: price,
        change: change,
        changeAbs: changeAbs,
        currency: meta.currency ?? 'USD',
        volume: meta.regularMarketVolume ?? 0,
        avgVolume: 0,
        marketCap: marketCap,
        pe: null,
        dividend: 0,
        dayHigh: meta.regularMarketDayHigh ?? 0,
        dayLow: meta.regularMarketDayLow ?? 0,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
        open: meta.regularMarketOpen ?? 0,
        previousClose: prevClose,
      };

      setCacheData(symbol, data);
      return data;

    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed for ${symbol}:`, err.message);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  return {
    symbol,
    name: symbol,
    price: 0,
    change: 0,
    changeAbs: 0,
    currency: 'USD',
    volume: 0,
    avgVolume: 0,
    marketCap: 0,
    error: true
  };
}

/**
 * Fetch histórico con reintentos
 */
async function fetchHistoricalData(symbol, range = '1y', interval = '1d') {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (!json.chart.result || json.chart.result.length === 0) return [];

    const result = json.chart.result[0];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    return timestamps.map((ts, i) => {
      const open = quotes.open?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const close = quotes.close?.[i];
      if (open == null || high == null || low == null || close == null) return null;

      return {
        date: new Date(ts * 1000).toISOString().split('T')[0],
        timestamp: ts * 1000,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: quotes.volume?.[i] || 0,
        adjClose: Number(close.toFixed(2))
      };
    }).filter(Boolean);

  } catch (err) {
    console.error(`Historical data error for ${symbol}:`, err.message);
    return [];
  }
}

/**
 * Calcula cambios de período
 */
function calculatePeriodChanges(historicalData) {
  if (!historicalData || historicalData.length < 2) {
    return {
      day: 0,
      week: 0,
      month: 0,
      threeMonths: 0,
      year: 0
    };
  }

  const now = historicalData[historicalData.length - 1].close;
  const getChangePercent = (periodAgo) => {
    if (!periodAgo) return 0;
    return Number((((now - periodAgo) / periodAgo) * 100).toFixed(2));
  };

  return {
    day: historicalData.length > 1 ? getChangePercent(historicalData[historicalData.length - 2].close) : 0,
    week: historicalData.length > 5 ? getChangePercent(historicalData[historicalData.length - 5].close) : 0,
    month: historicalData.length > 20 ? getChangePercent(historicalData[historicalData.length - 20].close) : 0,
    threeMonths: historicalData.length > 60 ? getChangePercent(historicalData[historicalData.length - 60].close) : 0,
    year: historicalData.length > 250 ? getChangePercent(historicalData[0].close) : 0
  };
}

// ============================================
// 🔌 ENDPOINTS
// ============================================

/**
 * GET /api/tickers
 * Lista todos los tickers con datos actualizados
 */
router.get('/', async (req, res) => {
  try {
    const tickers = await Ticker.find().limit(20);
    const symbols = tickers.map(t => t.symbol);

    const quotes = await Promise.all(
      symbols.map(symbol => fetchQuoteWithRetry(symbol))
    );

    const enriched = tickers.map((ticker, idx) => ({
      _id: ticker._id,
      symbol: ticker.symbol,
      name: quotes[idx]?.name || ticker.name,
      price: quotes[idx]?.price || 0,
      change: quotes[idx]?.change || 0,
      changeAbs: quotes[idx]?.changeAbs || 0,
      volume: quotes[idx]?.volume || 0,
      marketCap: quotes[idx]?.marketCap || 0,
      dayHigh: quotes[idx]?.dayHigh || 0,
      dayLow: quotes[idx]?.dayLow || 0,
      open: quotes[idx]?.open || 0,
      currency: quotes[idx]?.currency || 'USD'
    }));

    res.json({
      success: true,
      count: enriched.length,
      tickers: enriched,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickers',
      message: error.message
    });
  }
});

/**
 * GET /api/tickers/search/:query
 * Buscar tickers por nombre o símbolo
 */
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    if (!query || query.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 1 character'
      });
    }

    const regex = new RegExp(query, 'i');
    const results = await Ticker.find({
      $or: [
        { symbol: regex },
        { name: regex }
      ]
    }).limit(10);

    const quotes = await Promise.all(
      results.map(t => fetchQuoteWithRetry(t.symbol))
    );

    const enriched = results.map((ticker, idx) => ({
      _id: ticker._id,
      symbol: ticker.symbol,
      name: quotes[idx]?.name || ticker.name,
      price: quotes[idx]?.price || 0,
      change: quotes[idx]?.change || 0
    }));

    res.json({
      success: true,
      count: enriched.length,
      results: enriched
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /api/tickers/followed/:userId
 * Lista tickers seguidos por un usuario con datos de mercado actualizados
 */
router.get('/followed/:userId', async (req, res) => {
  try {
    const UserFollowTicket = require('../models/UserFollowTickets');
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId requerido' });
    }

    // 1. Obtener IDs de tickers seguidos (activos, sin unfollow)
    const follows = await UserFollowTicket.find({ userId, unfollowAt: null });
    const ticketIds = follows.map(f => f.ticketId);

    if (ticketIds.length === 0) {
      return res.json({ success: true, count: 0, tickers: [], timestamp: new Date().toISOString() });
    }

    // 2. Buscar los tickers en BD
    const tickers = await Ticker.find({ _id: { $in: ticketIds } });

    // 3. Obtener cotizaciones en tiempo real
    const quotes = await Promise.all(
      tickers.map(t => fetchQuoteWithRetry(t.symbol))
    );

    // 4. Enriquecer y devolver
    const enriched = tickers.map((ticker, idx) => ({
      _id: ticker._id,
      symbol: ticker.symbol,
      name: quotes[idx]?.name || ticker.name,
      price: quotes[idx]?.price || 0,
      change: quotes[idx]?.change || 0,
      changeAbs: quotes[idx]?.changeAbs || 0,
      volume: quotes[idx]?.volume || 0,
      marketCap: quotes[idx]?.marketCap || 0,
      dayHigh: quotes[idx]?.dayHigh || 0,
      dayLow: quotes[idx]?.dayLow || 0,
      open: quotes[idx]?.open || 0,
      currency: quotes[idx]?.currency || 'USD',
    }));

    res.json({
      success: true,
      count: enriched.length,
      tickers: enriched,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch followed tickers',
      message: error.message,
    });
  }
});

/**
 * GET /api/tickers/:id
 * Detalle completo de un ticker con gráficos e indicadores
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. FIND TICKER IN DB
    const ticker = await Ticker.findById(id);
    if (!ticker) {
      return res.status(404).json({
        success: false,
        error: 'Ticker not found'
      });
    }

    const symbol = ticker.symbol;

    // 2. FETCH QUOTE (LIVE)
    const quote = await fetchQuoteWithRetry(symbol);

    // 3. FETCH HISTORICAL DATA (1 YEAR)
    const historicalData = await fetchHistoricalData(symbol, '1y', '1d');

    // 4. CALCULATE INDICATORS
    let indicators = {
      sma20: null,
      sma50: null,
      sma200: null,
      rsi: null,
      macd: null,
      bollingerBands: null,
      atr: null
    };

    if (historicalData.length > 0) {
      indicators.sma20 = calculateSMA(historicalData, 20);
      indicators.sma50 = calculateSMA(historicalData, 50);
      indicators.sma200 = calculateSMA(historicalData, 200);
      indicators.rsi = calculateRSI(historicalData, 14);
      indicators.macd = calculateMACD(historicalData);
      indicators.bollingerBands = calculateBollingerBands(historicalData, 20, 2);
    }

    // 5. PERIOD CHANGES
    const periodChanges = calculatePeriodChanges(historicalData);

    // 6. FETCH FUNDAMENTALS (quoteSummary)
    let fundamentals = {};
    /* 
    try {
      const summary = await yahooFinance.quoteSummary(symbol, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail']
      });
      const ks = summary?.defaultKeyStatistics || {};
      const fd = summary?.financialData || {};
      fundamentals = {
        beta:            ks?.beta             ?? null,
        eps:             ks?.trailingEps      ?? null,
        forwardPE:       ks?.forwardPE        ?? null,
        priceToBook:     ks?.priceToBook      ?? null,
        bookValue:       ks?.bookValue        ?? null,
        returnOnEquity:  fd?.returnOnEquity   ?? null,
        returnOnAssets:  fd?.returnOnAssets   ?? null,
        profitMargins:   fd?.profitMargins    ?? null,
        grossMargins:    fd?.grossMargins     ?? null,
        revenueGrowth:   fd?.revenueGrowth    ?? null,
        currentRatio:    fd?.currentRatio     ?? null,
        debtToEquity:    fd?.debtToEquity     ?? null,
        totalRevenue:    fd?.totalRevenue?.raw ?? null,
        freeCashflow:    fd?.freeCashflow?.raw ?? null,
      };
    } catch (fundamentalErr) {
      console.warn(`Fundamentals not available for ${symbol}:`, fundamentalErr.message);
    }
    */

    // 7. BUILD RESPONSE
    res.json({
      success: true,
      ticker: {
        _id: ticker._id,
        symbol: symbol,
        name: quote.name,

        // PRICE DATA
        price: quote.price,
        change: quote.change,
        changeAbs: quote.changeAbs,
        currency: quote.currency,

        // MARKET DATA
        marketCap: quote.marketCap,
        volume: quote.volume,
        avgVolume: quote.avgVolume,
        volumeFormatted: formatVolume(quote.volume),

        // DAY DATA
        open: quote.open,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        previousClose: quote.previousClose,

        // 52 WEEK DATA
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,

        // FUNDAMENTALS
        pe: quote.pe,
        dividend: quote.dividend,

        // PERIOD CHANGES
        changes: {
          day: periodChanges.day,
          week: periodChanges.week,
          month: periodChanges.month,
          threeMonths: periodChanges.threeMonths,
          year: periodChanges.year
        },

        // CHART DATA
        historicalData: historicalData,

        // INDICATORS
        indicators: indicators,

        // FUNDAMENTALS
        fundamentals: fundamentals,

        // TIMESTAMP
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Ticker detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticker detail',
      message: error.message
    });
  }
});

/**
 * GET /api/tickers/:id/chart
 * Obtener datos del gráfico con rango personalizado
 */
router.get('/:id/chart', async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '1mo', interval = '1d' } = req.query;

    const ticker = await Ticker.findById(id);
    if (!ticker) {
      return res.status(404).json({
        success: false,
        error: 'Ticker not found'
      });
    }

    const historicalData = await fetchHistoricalData(ticker.symbol, range, interval);

    // Calcular indicadores para el rango específico
    const sma20 = calculateSMA(historicalData, 20);
    const sma50 = calculateSMA(historicalData, 50);
    const bollingerBands = calculateBollingerBands(historicalData);

    res.json({
      success: true,
      symbol: ticker.symbol,
      range,
      interval,
      data: historicalData,
      indicators: {
        sma20,
        sma50,
        bollingerBands
      },
      stats: {
        high: Math.max(...historicalData.map(d => d.high)),
        low: Math.min(...historicalData.map(d => d.low)),
        avgVolume: historicalData.reduce((a, b) => a + b.volume, 0) / historicalData.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chart data',
      message: error.message
    });
  }
});

/**
 * GET /api/tickers/:id/compare
 * Comparar dos tickers
 */
router.get('/:id/compare', async (req, res) => {
  try {
    const { id } = req.params;
    const { with: compareSymbol } = req.query;

    if (!compareSymbol) {
      return res.status(400).json({
        success: false,
        error: 'Compare symbol required'
      });
    }

    const ticker1 = await Ticker.findById(id);
    if (!ticker1) {
      return res.status(404).json({ success: false, error: 'Ticker not found' });
    }

    const quote1 = await fetchQuoteWithRetry(ticker1.symbol);
    const quote2 = await fetchQuoteWithRetry(compareSymbol);

    res.json({
      success: true,
      comparison: {
        ticker1: {
          symbol: ticker1.symbol,
          price: quote1.price,
          change: quote1.change,
          pe: quote1.pe,
          marketCap: quote1.marketCap
        },
        ticker2: {
          symbol: compareSymbol,
          price: quote2.price,
          change: quote2.change,
          pe: quote2.pe,
          marketCap: quote2.marketCap
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Comparison failed',
      message: error.message
    });
  }
});

module.exports = router;