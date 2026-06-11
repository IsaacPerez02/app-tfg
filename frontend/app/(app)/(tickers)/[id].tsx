import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNewsByTicker } from '@/hooks/use-news-by-ticker'
import { useTickersList } from '@/hooks/use-tickers-list'
import { useSnapshot } from '@/hooks/use-snapshot'
import { parseSentiment, CandleTimeframe, MarketCandle, TickerFundamentals } from '@/types'
import { timeAgo } from '@/utils/formatters'
import { LinearGradient } from 'expo-linear-gradient'
import { TradingViewChart } from '@/components/charts/TradingViewChart'
import { IndicatorsTable } from '@/components/indicators/IndicatorsTable'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width: SCREEN_W } = Dimensions.get('window')
const API_URL = process.env.EXPO_PUBLIC_API

// ─── Types (Stock backend) ────────────────────────────────────────────────────

interface OHLCData {
  date: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Indicators {
  sma20:  (number | null)[]
  sma50:  (number | null)[]
  sma200: (number | null)[]
  rsi:    (number | null)[]
  macd:   { macdLine: (number | null)[]; signalLine: (number | null)[] }
  bollingerBands: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
}

interface Fundamentals {
  beta?:            number | null
  eps?:             number | null
  forwardPE?:       number | null
  priceToBook?:     number | null
  returnOnEquity?:  number | null
  profitMargins?:   number | null
  debtToEquity?:    number | null
  freeCashflow?:    number | null
}

interface TickerDetail {
  symbol:            string
  name:              string
  price:             number
  change:            number
  changeAbs:         number
  currency:          string
  marketCap:         number
  volume:            number
  avgVolume:         number
  open:              number
  dayHigh:           number
  dayLow:            number
  previousClose:     number
  fiftyTwoWeekHigh:  number
  fiftyTwoWeekLow:   number
  pe:                number | null
  dividend:          number
  changes:           { day: number; week: number; month: number; threeMonths: number; year: number }
  historicalData:    OHLCData[]
  indicators:        Indicators
  fundamentals?:     Fundamentals
}

type RangeKey = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y'

const RANGES: { label: string; value: RangeKey; interval: string }[] = [
  { label: '1D',  value: '1d',  interval: '1h' },
  { label: '5D',  value: '5d',  interval: '1h' },
  { label: '1M',  value: '1mo', interval: '1d' },
  { label: '3M',  value: '3mo', interval: '1d' },
  { label: '6M',  value: '6mo', interval: '1d' },
  { label: '1A',  value: '1y',  interval: '1d' },
  { label: '5A',  value: '5y',  interval: '1wk' },
]

const CRYPTO_TIMEFRAMES: { label: string; value: CandleTimeframe }[] = [
  { label: '1m',  value: '1m'  },
  { label: '5m',  value: '5m'  },
  { label: '15m', value: '15m' },
  { label: '1h',  value: '1h'  },
  { label: '4h',  value: '4h'  },
  { label: '1d',  value: '1d'  },
]

// ─── Colors ───────────────────────────────────────────────────────────────────

const UP   = '#00c896'
const DOWN = '#ff4d6d'
const ACCENT = '#00b4d8'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return 'N/A'
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtLarge(n: number | null | undefined): string {
  if (!n || isNaN(n)) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtPctRaw(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A'
  return `${(n * 100).toFixed(1)}%`
}

function lastValid(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null) return arr[i] as number
  }
  return null
}

// ─── Trend signal from indicators ────────────────────────────────────────────



// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, valueColor, bg, textP, textS }: {
  label: string; value: string; valueColor?: string
  bg: string; textP: string; textS: string
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statCardLabel, { color: textS }]}>{label}</Text>
      <Text style={[styles.statCardValue, { color: valueColor || textP }]}>{value}</Text>
    </View>
  )
}

function PerfRow({ label, value, textP, textS }: {
  label: string; value: number | undefined; textP: string; textS: string
}) {
  const pct = value ?? 0
  const isPos = pct >= 0
  const color = isPos ? UP : DOWN
  const barW = Math.min(Math.abs(pct) * 4, 80)
  return (
    <View style={styles.perfRow}>
      <Text style={[styles.perfLabel, { color: textS }]}>{label}</Text>
      <View style={styles.perfBarContainer}>
        {!isPos && <View style={[styles.perfBar, { width: barW, backgroundColor: color, marginLeft: 'auto' as any }]} />}
        {isPos  && <View style={[styles.perfBar, { width: barW, backgroundColor: color }]} />}
      </View>
      <Text style={[styles.perfValue, { color, width: 70, textAlign: 'right' }]}>{fmtPct(pct)}</Text>
    </View>
  )
}

function SectionHeader({ title, textP }: { title: string; textP: string }) {
  return <Text style={[styles.sectionHeader, { color: textP }]}>{title}</Text>
}

// ─── Fundamentals panel ───────────────────────────────────────────────────────

function FundamentalsPanel({
  funds, price, surface, surface2, textP, textS, border,
}: {
  funds: TickerFundamentals
  price: number
  surface: string; surface2: string; textP: string; textS: string; border: string
}) {
  const w52Range  = (funds.fiftyTwoWeekHigh ?? 0) - (funds.fiftyTwoWeekLow ?? 0)
  const pricePos  = w52Range > 0 ? ((price - (funds.fiftyTwoWeekLow ?? 0)) / w52Range) : 0.5

  return (
    <>
      {/* Key Stats */}
      <View style={[styles.section, { backgroundColor: surface }]}>
        <SectionHeader title="📊 Key Stats" textP={textP} />
        <View style={styles.statsGrid}>
          <StatCard label="Market Cap"    value={fmtLarge(funds.marketCap)}              bg={surface2} textP={textP} textS={textS} />
          <StatCard label="P/E Trailing"  value={funds.trailingPE  != null ? fmt(funds.trailingPE, 1)  : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          <StatCard label="P/E Forward"   value={funds.forwardPE   != null ? fmt(funds.forwardPE, 1)   : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          <StatCard label="EPS (TTM)"     value={funds.trailingEps != null ? `$${fmt(funds.trailingEps)}` : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          <StatCard label="EPS Fwd"       value={funds.forwardEps  != null ? `$${fmt(funds.forwardEps)}`  : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          <StatCard label="Beta"          value={funds.beta        != null ? fmt(funds.beta)             : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          <StatCard label="Div. Yield"    value={funds.dividendYield != null ? `${(funds.dividendYield * 100).toFixed(2)}%` : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          <StatCard label="Analyst Target" value={funds.targetMeanPrice != null ? `$${fmt(funds.targetMeanPrice)}` : 'N/A'} bg={surface2} textP={textP} textS={textS} valueColor={ACCENT} />
        </View>

        {/* 52W Range */}
        {funds.fiftyTwoWeekHigh && funds.fiftyTwoWeekLow ? (
          <View style={[styles.w52Container, { borderTopColor: border }]}>
            <View style={styles.w52Header}>
              <Text style={[styles.techLabel, { color: textS }]}>52 Semanas</Text>
              <Text style={[styles.techValueSmall, { color: textP }]}>
                ${fmt(funds.fiftyTwoWeekLow)} – ${fmt(funds.fiftyTwoWeekHigh)}
              </Text>
            </View>
            <View style={[styles.w52Track, { backgroundColor: surface2 }]}>
              <LinearGradient
                colors={[DOWN, '#FF9500', UP]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.w52Fill}
              />
              <View style={[styles.w52Thumb, {
                left: `${Math.max(4, Math.min(pricePos * 100, 96))}%` as any,
                backgroundColor: surface, borderColor: ACCENT,
              }]} />
            </View>
            <View style={styles.w52Labels}>
              <Text style={[styles.rsiRef, { color: DOWN }]}>${fmt(funds.fiftyTwoWeekLow)}</Text>
              <Text style={[styles.rsiRef, { color: textS }]}>${fmt(price)}</Text>
              <Text style={[styles.rsiRef, { color: UP }]}>${fmt(funds.fiftyTwoWeekHigh)}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Financials */}
      {(funds.grossMargins != null || funds.returnOnEquity != null) && (
        <View style={[styles.section, { backgroundColor: surface }]}>
          <SectionHeader title="🏦 Financials" textP={textP} />
          <View style={styles.statsGrid}>
            {funds.grossMargins     != null && <StatCard label="Gross Margin"   value={fmtPctRaw(funds.grossMargins)}    bg={surface2} textP={textP} textS={textS} valueColor={funds.grossMargins > 0 ? UP : DOWN} />}
            {funds.operatingMargins != null && <StatCard label="Op. Margin"     value={fmtPctRaw(funds.operatingMargins)} bg={surface2} textP={textP} textS={textS} valueColor={funds.operatingMargins > 0 ? UP : DOWN} />}
            {funds.profitMargins    != null && <StatCard label="Net Margin"     value={fmtPctRaw(funds.profitMargins)}   bg={surface2} textP={textP} textS={textS} valueColor={funds.profitMargins > 0 ? UP : DOWN} />}
            {funds.returnOnEquity   != null && <StatCard label="ROE"            value={fmtPctRaw(funds.returnOnEquity)}  bg={surface2} textP={textP} textS={textS} valueColor={funds.returnOnEquity > 0 ? UP : DOWN} />}
            {funds.returnOnAssets   != null && <StatCard label="ROA"            value={fmtPctRaw(funds.returnOnAssets)}  bg={surface2} textP={textP} textS={textS} valueColor={funds.returnOnAssets > 0 ? UP : DOWN} />}
            {funds.debtToEquity     != null && <StatCard label="Debt/Equity"    value={fmt(funds.debtToEquity, 1)}       bg={surface2} textP={textP} textS={textS} />}
            {funds.currentRatio     != null && <StatCard label="Current Ratio"  value={fmt(funds.currentRatio, 2)}       bg={surface2} textP={textP} textS={textS} />}
            {funds.totalRevenue     != null && <StatCard label="Revenue TTM"    value={fmtLarge(funds.totalRevenue)}     bg={surface2} textP={textP} textS={textS} />}
          </View>
        </View>
      )}
    </>
  )
}

// ─── Indicators panel ─────────────────────────────────────────────────────────

// ─── CryptoDetailScreen ───────────────────────────────────────────────────────

function CryptoDetailScreen({ ticker }: { ticker: string }) {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'

  const {
    candles, indicators, latestIndicator, fundamentals,
    loading, error, timeframe, setTimeframe, refresh,
  } = useSnapshot(ticker, '1h')

  const { news: tickerNews, loading: newsLoading } = useNewsByTicker(ticker)

  const bg       = isDark ? '#0A0A0A' : '#F2F2F7'
  const surface  = isDark ? '#1C1C1E' : '#FFFFFF'
  const surface2 = isDark ? '#2C2C2E' : '#F5F5F5'
  const textP    = isDark ? '#FFFFFF' : '#000000'
  const textS    = isDark ? '#8E8E93' : '#6D6D78'
  const border   = isDark ? '#2C2C2E' : '#E5E5EA'

  const latest   = candles.length > 0 ? candles[candles.length - 1] : null
  const price    = latest?.close ?? 0
  const firstDay = candles.find(c => c.timeframe === '1d') ?? candles[0]
  const change   = (firstDay && firstDay.open > 0)
    ? ((price - firstDay.open) / firstDay.open) * 100
    : 0
  const isPositive  = change >= 0
  const changeColor = isPositive ? UP : DOWN

  if (loading && candles.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={ACCENT} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={[styles.headerSymbol, { color: textP }]}>{ticker}</Text>
            <Text style={[styles.headerName, { color: textS }]}>Cargando...</Text>
          </View>
          <TouchableOpacity onPress={refresh} style={styles.headerBtn}>
            <MaterialCommunityIcons name="refresh" size={22} color={ACCENT} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={ACCENT} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerSymbol, { color: textP }]}>{ticker}</Text>
          <Text style={[styles.headerName, { color: textS }]} numberOfLines={1}>
            {fundamentals?.shortName ?? fundamentals?.longName ?? ticker}
          </Text>
        </View>
        <TouchableOpacity onPress={refresh} style={styles.headerBtn} disabled={loading}>
          <MaterialCommunityIcons name={loading ? 'loading' : 'refresh'} size={22} color={ACCENT} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* ── PRICE HERO ── */}
        <LinearGradient
          colors={isDark ? ['#0A1628', '#0D0D0D'] : ['#EBF7FB', '#F2F2F7']}
          style={styles.priceHero}
        >
          <Text style={[styles.heroPrice, { color: textP }]}>
            ${price > 0 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 }) : '—'}
          </Text>
          <View style={styles.heroBadgeRow}>
            {price > 0 && (
              <View style={[styles.changeBadge, { backgroundColor: changeColor + '22' }]}>
                <MaterialCommunityIcons
                  name={isPositive ? 'trending-up' : 'trending-down'}
                  size={14} color={changeColor}
                />
                <Text style={[styles.changeBadgeText, { color: changeColor }]}>
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </Text>
              </View>
            )}
            {fundamentals?.sector ? (
              <Text style={[styles.heroMeta, { color: textS }]}>
                {fundamentals.sector} · {fundamentals.industry ?? ''}
              </Text>
            ) : (
              <Text style={[styles.heroMeta, { color: textS }]}>
                {ticker} · {timeframe.toUpperCase()} · {candles.length} velas
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* ── ERROR BANNER ── */}
        {error && (
          <View style={[styles.cryptoErrorBanner, { backgroundColor: DOWN + '22', borderColor: DOWN }]}>
            <MaterialCommunityIcons name="wifi-off" size={16} color={DOWN} />
            <Text style={[styles.cryptoErrorText, { color: DOWN }]}>{error}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={[styles.cryptoErrorRetry, { color: ACCENT }]}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CHART ── */}
        <View style={[styles.chartWrapper, { backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF' }]}>
          <TradingViewChart
            candles={candles}
            indicators={indicators}
            isDark={isDark}
            height={460}
          />
          {loading && candles.length > 0 && (
            <View style={styles.chartOverlay}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          )}
        </View>

        {/* ── TIMEFRAME SELECTOR ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.rangeScroll, { backgroundColor: surface }]}
          contentContainerStyle={styles.rangeScrollContent}
        >
          {CRYPTO_TIMEFRAMES.map(tf => {
            const isActive = timeframe === tf.value
            return (
              <TouchableOpacity
                key={tf.value}
                onPress={() => setTimeframe(tf.value)}
                style={[styles.rangeBtn, isActive && { backgroundColor: ACCENT }]}
              >
                <Text style={[
                  styles.rangeBtnText,
                  { color: isActive ? '#FFFFFF' : textS },
                  isActive && { fontWeight: '700' },
                ]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* ── OHLCV STATS ── */}
        {latest && (
          <View style={[styles.section, { backgroundColor: surface }]}>
            <SectionHeader title="📊 Último candle" textP={textP} />
            <View style={styles.statsGrid}>
              <StatCard label="Apertura"  value={`$${fmt(latest.open)}`}  bg={surface2} textP={textP} textS={textS} />
              <StatCard label="Máximo"    value={`$${fmt(latest.high)}`}  bg={surface2} textP={textP} textS={textS} valueColor={UP} />
              <StatCard label="Mínimo"    value={`$${fmt(latest.low)}`}   bg={surface2} textP={textP} textS={textS} valueColor={DOWN} />
              <StatCard label="Cierre"    value={`$${fmt(latest.close)}`} bg={surface2} textP={textP} textS={textS} />
              <StatCard label="Volumen"   value={fmtLarge(latest.volume)} bg={surface2} textP={textP} textS={textS} />
              <StatCard label="Timeframe" value={latest.timeframe.toUpperCase()} bg={surface2} textP={textP} textS={textS} valueColor={ACCENT} />
            </View>
          </View>
        )}

        {/* ── INDICATORS TABLE ── */}
        <IndicatorsTable
          indicator={latestIndicator}
          timeframe={timeframe}
          loading={loading && candles.length > 0}
          surface={surface} surface2={surface2} textP={textP} textS={textS} border={border}
        />

        {/* ── FUNDAMENTALS PANEL ── */}
        {fundamentals && (
          <FundamentalsPanel
            funds={fundamentals}
            price={price}
            surface={surface} surface2={surface2} textP={textP} textS={textS} border={border}
          />
        )}

        {/* ── NOTICIAS ── */}
        <View style={[styles.section, { backgroundColor: surface, marginBottom: 100 }]}>
          <SectionHeader title="📰 Noticias relevantes" textP={textP} />
          {newsLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
          ) : tickerNews.length === 0 ? (
            <Text style={[styles.techLabel, { color: textS }]}>
              Sin noticias recientes para {ticker}
            </Text>
          ) : (
            tickerNews.map(item => {
              const sent = parseSentiment(item.sentiment)
              const sentIcon = sent.key === 'positive' ? 'trending-up' : sent.key === 'negative' ? 'trending-down' : 'minus'
              return (
                <Pressable
                  key={item._id}
                  onPress={() => router.push(`/(app)/(news)/${item._id}` as any)}
                  style={({ pressed }) => [
                    styles.newsItem, { borderColor: border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={styles.newsItemHeader}>
                    <View style={[styles.sentBadge, { backgroundColor: sent.color + '22' }]}>
                      <MaterialCommunityIcons name={sentIcon as any} size={11} color={sent.color} />
                      <Text style={[styles.sentText, { color: sent.color }]}>{sent.label}</Text>
                    </View>
                    <Text style={[styles.newsTime, { color: textS }]}>{timeAgo(item.date)}</Text>
                  </View>
                  <Text style={[styles.newsTitle, { color: textP }]} numberOfLines={2}>{item.title}</Text>
                  {item.summary ? (
                    <Text style={[styles.newsSummary, { color: textS }]} numberOfLines={2}>{item.summary}</Text>
                  ) : null}
                </Pressable>
              )
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── StockDetailScreen (Express backend) ─────────────────────────────────────

function StockDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'

  const [ticker,      setTicker]   = useState<TickerDetail | null>(null)
  const [chartData,   setChartData]  = useState<OHLCData[]>([])
  const [loading,     setLoading]    = useState(true)
  const [chartLoading,     setChartLoading]     = useState(false)
  const [refreshing,       setRefreshing]       = useState(false)
  const [activeRange,      setActiveRange]      = useState<RangeKey>('1y')
  const [isFollowing,      setIsFollowing]      = useState(false)
  const [followLoading,    setFollowLoading]    = useState(false)

  const { news: tickerNews, loading: newsLoading } = useNewsByTicker(ticker?.symbol ?? '')

  const bg       = isDark ? '#0A0A0A' : '#F2F2F7'
  const surface  = isDark ? '#1C1C1E' : '#FFFFFF'
  const surface2 = isDark ? '#2C2C2E' : '#F5F5F5'
  const textP    = isDark ? '#FFFFFF' : '#000000'
  const textS    = isDark ? '#8E8E93' : '#6D6D78'
  const border   = isDark ? '#2C2C2E' : '#E5E5EA'

  const fetchTicker = useCallback(async () => {
    try {
      setRefreshing(true)
      const res  = await fetch(`${API_URL}/tickers/${id}`)
      const json = await res.json()
      if (json?.success && json?.ticker) {
        const t: TickerDetail = json.ticker
        setTicker(t)
        setChartData(t.historicalData)
      } else {
        throw new Error('Invalid response')
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el activo')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  const fetchChartRange = useCallback(async (range: RangeKey) => {
    if (!ticker) return
    try {
      setChartLoading(true)
      const rangeInfo = RANGES.find(r => r.value === range)
      const interval  = rangeInfo?.interval || '1d'
      const res  = await fetch(`${API_URL}/tickers/${id}/chart?range=${range}&interval=${interval}`)
      const json = await res.json()
      if (json?.success && json?.data) {
        setChartData(json.data)
      }
    } catch (err) {
      console.warn('Range fetch error:', err)
    } finally {
      setChartLoading(false)
    }
  }, [id, ticker])

  const checkFollowStatus = useCallback(async () => {
    try {
      const userIdStr = await AsyncStorage.getItem('userId')
      if (!userIdStr) return
      let userId = userIdStr
      if (userId.startsWith('"') && userId.endsWith('"')) userId = userId.slice(1, -1)
      const res  = await fetch(`${API_URL}/followTickets/check/${userId}/${id}`)
      if (!res.ok) return
      const json = await res.json()
      setIsFollowing(json.isFollowing)
    } catch { /* silencioso */ }
  }, [id])

  useEffect(() => {
    if (id) { fetchTicker(); checkFollowStatus() }
  }, [id, fetchTicker, checkFollowStatus])

  const toggleFollow = async () => {
    if (followLoading) return
    try {
      setFollowLoading(true)
      const userIdStr = await AsyncStorage.getItem('userId')
      if (!userIdStr) { Alert.alert('Error', 'No has iniciado sesión'); return }
      let userId = userIdStr
      if (userId.startsWith('"') && userId.endsWith('"')) userId = userId.slice(1, -1)
      if (isFollowing) {
        await fetch(`${API_URL}/followTickets/unfollow`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ticketId: id }),
        })
        setIsFollowing(false)
      } else {
        await fetch(`${API_URL}/followTickets/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ticketId: id }),
        })
        setIsFollowing(true)
      }
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado de seguimiento')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleRangeChange = (range: RangeKey) => {
    setActiveRange(range)
    fetchChartRange(range)
  }

  if (loading || !ticker) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={[styles.loadingText, { color: textS }]}>Cargando activo...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isPositive  = ticker.change >= 0
  const changeColor = isPositive ? UP : DOWN
  const rsiVal      = lastValid(ticker.indicators?.rsi || [])
  const rsiColor    = rsiVal != null ? (rsiVal >= 70 ? DOWN : rsiVal <= 30 ? UP : '#FF9500') : textP
  const rsiLabel    = rsiVal != null ? (rsiVal >= 70 ? 'Sobrecompra' : rsiVal <= 30 ? 'Sobreventa' : 'Neutral') : ''
  const w52Range    = ticker.fiftyTwoWeekHigh - ticker.fiftyTwoWeekLow
  const pricePos    = w52Range > 0 ? ((ticker.price - ticker.fiftyTwoWeekLow) / w52Range) : 0.5

  // Convert OHLCData to MarketCandle shape for AdvancedCandleChart
  const chartCandles: MarketCandle[] = chartData.map(d => ({
    ticker: ticker.symbol,
    timestamp: typeof d.timestamp === 'number' ? new Date(d.timestamp).toISOString() : d.date,
    timeframe: activeRange === '1d' || activeRange === '5d' ? '1h' : '1d',
    open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
    source: 'express', created_at: null,
  }))

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={ACCENT} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerSymbol, { color: textP }]}>{ticker.symbol}</Text>
          <Text style={[styles.headerName, { color: textS }]} numberOfLines={1}>{ticker.name}</Text>
        </View>
        <TouchableOpacity onPress={toggleFollow} style={styles.headerBtn} disabled={followLoading}>
          {followLoading ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <MaterialCommunityIcons
              name={isFollowing ? 'star' : 'star-outline'}
              size={24} color={isFollowing ? '#FFD700' : textS}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={fetchTicker} style={styles.headerBtn} disabled={refreshing}>
          <MaterialCommunityIcons name={refreshing ? 'loading' : 'refresh'} size={22} color={ACCENT} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false} nestedScrollEnabled>

        {/* ── PRICE HERO ── */}
        <LinearGradient
          colors={isDark ? ['#0A1628', '#0D0D0D'] : ['#EBF7FB', '#F2F2F7']}
          style={styles.priceHero}
        >
          <Text style={[styles.heroPrice, { color: textP }]}>
            {ticker.currency === 'USD' ? '$' : ''}{fmt(ticker.price)}
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={[styles.changeBadge, { backgroundColor: changeColor + '22' }]}>
              <MaterialCommunityIcons name={isPositive ? 'trending-up' : 'trending-down'} size={14} color={changeColor} />
              <Text style={[styles.changeBadgeText, { color: changeColor }]}>
                {isPositive ? '+' : ''}{fmt(ticker.changeAbs)} ({fmtPct(ticker.change)})
              </Text>
            </View>
            <Text style={[styles.heroMeta, { color: textS }]}>
              {ticker.currency} · Vol {fmtLarge(ticker.volume)}
            </Text>
          </View>
        </LinearGradient>

        {/* ── QUICK PERFORMANCE STRIP ── */}
        <View style={[styles.quickStrip, { backgroundColor: surface }]}>
          {[
            { label: '1D', val: ticker.changes?.day },
            { label: '1S', val: ticker.changes?.week },
            { label: '1M', val: ticker.changes?.month },
            { label: '3M', val: ticker.changes?.threeMonths },
            { label: '1A', val: ticker.changes?.year },
          ].map(({ label, val }) => (
            <View key={label} style={styles.quickItem}>
              <Text style={[styles.quickLabel, { color: textS }]}>{label}</Text>
              <Text style={[styles.quickVal, { color: (val ?? 0) >= 0 ? UP : DOWN }]}>
                {fmtPct(val ?? 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── CHART ── */}
        <View style={[styles.chartWrapper, { backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF' }]}>
          <TradingViewChart
            candles={chartCandles}
            indicators={[]}
            isDark={isDark}
            height={380}
          />
          {chartLoading && (
            <View style={styles.chartOverlay}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          )}
        </View>

        {/* ── RANGE SELECTOR ── */}
        <View style={[styles.rangeRow, { backgroundColor: surface }]}>
          {RANGES.map(r => {
            const isActive = activeRange === r.value
            return (
              <TouchableOpacity key={r.value} onPress={() => handleRangeChange(r.value)}
                style={[styles.rangeBtn, isActive && { backgroundColor: ACCENT }]}
              >
                <Text style={[styles.rangeBtnText, { color: isActive ? '#FFFFFF' : textS }, isActive && { fontWeight: '700' }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── TECHNICAL INDICATORS (from Express backend data) ── */}
        {rsiVal != null && (
          <View style={[styles.section, { backgroundColor: surface }]}>
            <SectionHeader title="📊 Indicadores Técnicos" textP={textP} />
            <View style={[styles.techRow, { borderBottomColor: border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.techLabel, { color: textS }]}>RSI (14)</Text>
                <Text style={[styles.techValue, { color: rsiColor }]}>{rsiVal?.toFixed(1)} · {rsiLabel}</Text>
              </View>
              <View style={styles.rsiBar}>
                <View style={[styles.rsiTrack, { backgroundColor: surface2 }]}>
                  <View style={[styles.rsiThumb, { left: `${Math.min(rsiVal!, 100)}%` as any, backgroundColor: rsiColor }]} />
                </View>
                <View style={styles.rsiLabels}>
                  <Text style={[styles.rsiRef, { color: textS }]}>30</Text>
                  <Text style={[styles.rsiRef, { color: textS }]}>70</Text>
                </View>
              </View>
            </View>
            {ticker.indicators?.macd && (() => {
              const ml = ticker.indicators.macd.macdLine
              const sl = ticker.indicators.macd.signalLine
              const lastMacd   = ml[ml.length - 1]
              const lastSignal = sl[sl.length - 1]
              if (lastMacd == null || lastSignal == null) return null
              const isBull = lastMacd > lastSignal
              return (
                <View style={[styles.techRow, { borderBottomColor: border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.techLabel, { color: textS }]}>MACD</Text>
                    <Text style={[styles.techValue, { color: isBull ? UP : DOWN }]}>
                      {isBull ? '↑ Señal alcista' : '↓ Señal bajista'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.techValueSmall, { color: textS }]}>MACD: {lastMacd.toFixed(2)}</Text>
                    <Text style={[styles.techValueSmall, { color: textS }]}>Señal: {lastSignal.toFixed(2)}</Text>
                  </View>
                </View>
              )
            })()}
            {ticker.indicators?.bollingerBands && (() => {
              const bb       = ticker.indicators.bollingerBands
              const lastUpper = bb.upper[bb.upper.length - 1]
              const lastLower = bb.lower[bb.lower.length - 1]
              if (lastUpper == null || lastLower == null) return null
              const bbRange = lastUpper - lastLower
              const pos = bbRange > 0 ? ((ticker.price - lastLower) / bbRange) * 100 : 50
              return (
                <View style={[styles.techRow, { borderBottomColor: 'transparent' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.techLabel, { color: textS }]}>Bollinger Bands</Text>
                    <Text style={[styles.techValue, { color: textP }]}>Pos: {pos.toFixed(0)}% del rango</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.techValueSmall, { color: UP }]}>↑ {fmt(lastUpper)}</Text>
                    <Text style={[styles.techValueSmall, { color: DOWN }]}>↓ {fmt(lastLower)}</Text>
                  </View>
                </View>
              )
            })()}
          </View>
        )}

        {/* ── MARKET DATA ── */}
        <View style={[styles.section, { backgroundColor: surface }]}>
          <SectionHeader title="📈 Datos de Mercado" textP={textP} />
          <View style={styles.statsGrid}>
            <StatCard label="Apertura"     value={`$${fmt(ticker.open)}`}             bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Cierre Prev." value={`$${fmt(ticker.previousClose)}`}    bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Máx. Diario"  value={`$${fmt(ticker.dayHigh)}`}          bg={surface2} textP={textP} textS={textS} valueColor={UP} />
            <StatCard label="Mín. Diario"  value={`$${fmt(ticker.dayLow)}`}           bg={surface2} textP={textP} textS={textS} valueColor={DOWN} />
            <StatCard label="Volumen"       value={fmtLarge(ticker.volume)}            bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Vol. Promedio" value={fmtLarge(ticker.avgVolume)}         bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Cap. Bursátil" value={fmtLarge(ticker.marketCap)}         bg={surface2} textP={textP} textS={textS} />
            <StatCard label="P/E Ratio"     value={ticker.pe ? fmt(ticker.pe, 1) : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Dividendo"     value={ticker.dividend ? `${(ticker.dividend * 100).toFixed(2)}%` : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Beta"          value={ticker.fundamentals?.beta ? fmt(ticker.fundamentals.beta) : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="EPS"           value={ticker.fundamentals?.eps ? `$${fmt(ticker.fundamentals.eps)}` : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="P/B Ratio"     value={ticker.fundamentals?.priceToBook ? fmt(ticker.fundamentals.priceToBook, 1) : 'N/A'} bg={surface2} textP={textP} textS={textS} />
          </View>
          {/* 52W Range */}
          <View style={[styles.w52Container, { borderTopColor: border }]}>
            <View style={styles.w52Header}>
              <Text style={[styles.techLabel, { color: textS }]}>52 Semanas</Text>
              <Text style={[styles.techValueSmall, { color: textP }]}>
                ${fmt(ticker.fiftyTwoWeekLow)} – ${fmt(ticker.fiftyTwoWeekHigh)}
              </Text>
            </View>
            <View style={[styles.w52Track, { backgroundColor: surface2 }]}>
              <LinearGradient colors={[DOWN, '#FF9500', UP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.w52Fill} />
              <View style={[styles.w52Thumb, { left: `${Math.max(4, Math.min(pricePos * 100, 96))}%` as any, backgroundColor: surface, borderColor: ACCENT }]} />
            </View>
            <View style={styles.w52Labels}>
              <Text style={[styles.rsiRef, { color: DOWN }]}>${fmt(ticker.fiftyTwoWeekLow)}</Text>
              <Text style={[styles.rsiRef, { color: textS }]}>${fmt(ticker.price)}</Text>
              <Text style={[styles.rsiRef, { color: UP }]}>${fmt(ticker.fiftyTwoWeekHigh)}</Text>
            </View>
          </View>
        </View>

        {/* ── FUNDAMENTALS ── */}
        {ticker.fundamentals && (ticker.fundamentals.returnOnEquity != null || ticker.fundamentals.profitMargins != null) && (
          <View style={[styles.section, { backgroundColor: surface }]}>
            <SectionHeader title="🏦 Fundamentales" textP={textP} />
            <View style={styles.statsGrid}>
              {ticker.fundamentals?.returnOnEquity != null && (
                <StatCard label="ROE" value={`${((ticker.fundamentals.returnOnEquity) * 100).toFixed(1)}%`}
                  bg={surface2} textP={textP} textS={textS} valueColor={ticker.fundamentals.returnOnEquity > 0 ? UP : DOWN} />
              )}
              {ticker.fundamentals?.profitMargins != null && (
                <StatCard label="Margen Neto" value={`${((ticker.fundamentals.profitMargins) * 100).toFixed(1)}%`}
                  bg={surface2} textP={textP} textS={textS} valueColor={ticker.fundamentals.profitMargins > 0 ? UP : DOWN} />
              )}
              {ticker.fundamentals?.debtToEquity != null && (
                <StatCard label="Deuda/Capital" value={fmt(ticker.fundamentals.debtToEquity, 1)}
                  bg={surface2} textP={textP} textS={textS} />
              )}
              {ticker.fundamentals?.freeCashflow != null && (
                <StatCard label="Free Cash Flow" value={fmtLarge(ticker.fundamentals.freeCashflow)}
                  bg={surface2} textP={textP} textS={textS} />
              )}
            </View>
          </View>
        )}

        {/* ── PERFORMANCE ── */}
        <View style={[styles.section, { backgroundColor: surface }]}>
          <SectionHeader title="💹 Rendimiento" textP={textP} />
          <PerfRow label="1 Día"    value={ticker.changes?.day}          textP={textP} textS={textS} />
          <PerfRow label="1 Semana" value={ticker.changes?.week}         textP={textP} textS={textS} />
          <PerfRow label="1 Mes"    value={ticker.changes?.month}        textP={textP} textS={textS} />
          <PerfRow label="3 Meses"  value={ticker.changes?.threeMonths}  textP={textP} textS={textS} />
          <PerfRow label="1 Año"    value={ticker.changes?.year}         textP={textP} textS={textS} />
        </View>

        {/* ── SMA SNAPSHOT ── */}
        <View style={[styles.section, { backgroundColor: surface }]}>
          <SectionHeader title="📉 Medias Móviles" textP={textP} />
          {[
            { label: 'SMA 20',  data: ticker.indicators?.sma20 },
            { label: 'SMA 50',  data: ticker.indicators?.sma50 },
            { label: 'SMA 200', data: ticker.indicators?.sma200 },
          ].map(({ label, data }) => {
            if (!data) return null
            const last = data.filter(v => v !== null).pop() as number | undefined
            if (!last) return null
            const diff = ((ticker.price - last) / last) * 100
            const isAbove = ticker.price >= last
            return (
              <View key={label} style={[styles.smaRow, { borderBottomColor: border }]}>
                <Text style={[styles.smaLabel, { color: textS }]}>{label}</Text>
                <Text style={[styles.smaValue, { color: textP }]}>${fmt(last)}</Text>
                <View style={[styles.smaBadge, { backgroundColor: (isAbove ? UP : DOWN) + '22' }]}>
                  <Text style={[styles.smaBadgeText, { color: isAbove ? UP : DOWN }]}>
                    {isAbove ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* ── NOTICIAS ── */}
        <View style={[styles.section, { backgroundColor: surface, marginBottom: 100 }]}>
          <SectionHeader title="📰 Noticias relevantes" textP={textP} />
          {newsLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
          ) : tickerNews.length === 0 ? (
            <Text style={[styles.techLabel, { color: textS }]}>Sin noticias recientes para {id}</Text>
          ) : (
            tickerNews.map(item => {
              const sent     = parseSentiment(item.sentiment)
              const sentIcon = sent.key === 'positive' ? 'trending-up' : sent.key === 'negative' ? 'trending-down' : 'minus'
              return (
                <Pressable
                  key={item._id}
                  onPress={() => router.push(`/(app)/(news)/${item._id}` as any)}
                  style={({ pressed }) => [styles.newsItem, { borderColor: border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.newsItemHeader}>
                    <View style={[styles.sentBadge, { backgroundColor: sent.color + '22' }]}>
                      <MaterialCommunityIcons name={sentIcon as any} size={11} color={sent.color} />
                      <Text style={[styles.sentText, { color: sent.color }]}>{sent.label}</Text>
                    </View>
                    <Text style={[styles.newsTime, { color: textS }]}>{timeAgo(item.date)}</Text>
                  </View>
                  <Text style={[styles.newsTitle, { color: textP }]} numberOfLines={2}>{item.title}</Text>
                  {item.summary ? (
                    <Text style={[styles.newsSummary, { color: textS }]} numberOfLines={2}>{item.summary}</Text>
                  ) : null}
                </Pressable>
              )
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Router shell ─────────────────────────────────────────────────────────────

export default function TickerDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>()
  const { trackedSymbols, loading } = useTickersList()
  const isDark   = useColorScheme() === 'dark'
  const bg       = isDark ? '#0A0A0A' : '#F2F2F7'

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    )
  }

  if (id && trackedSymbols.has(id)) return <CryptoDetailScreen ticker={id} />
  return <StockDetailScreen id={id ?? ''} />
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, fontWeight: '500' },
  scrollContent: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn:    { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { flex: 1, alignItems: 'center' },
  headerSymbol: { fontSize: 17, fontWeight: '700' },
  headerName:   { fontSize: 12, marginTop: 1 },

  priceHero: { paddingHorizontal: 20, paddingVertical: 20 },
  heroPrice:  { fontSize: 38, fontWeight: '700', letterSpacing: -1 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  changeBadgeText: { fontSize: 14, fontWeight: '600' },
  heroMeta:        { fontSize: 13 },

  quickStrip:   { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, marginBottom: 2 },
  quickItem:    { alignItems: 'center' },
  quickLabel:   { fontSize: 11, fontWeight: '500', marginBottom: 3 },
  quickVal:     { fontSize: 13, fontWeight: '700' },

  chartWrapper: { width: '100%', position: 'relative' },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  rangeRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 8, marginBottom: 8 },
  rangeScroll: { marginBottom: 8 },
  rangeScrollContent: { paddingHorizontal: 8, paddingVertical: 10, gap: 6 },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rangeBtnText: { fontSize: 13, fontWeight: '500' },

  section: { marginHorizontal: 0, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionHeader: { fontSize: 16, fontWeight: '700', marginBottom: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard:  { width: (SCREEN_W - 48) / 2 - 4, padding: 12, borderRadius: 12 },
  statCardLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  statCardValue: { fontSize: 15, fontWeight: '700' },

  techRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  techLabel:      { fontSize: 12, fontWeight: '500', marginBottom: 3 },
  techValue:      { fontSize: 14, fontWeight: '600' },
  techValueSmall: { fontSize: 12, fontWeight: '500' },

  rsiBar:    { flex: 1, marginLeft: 12 },
  rsiTrack:  { height: 6, borderRadius: 3, position: 'relative', marginBottom: 4 },
  rsiThumb:  { position: 'absolute', width: 10, height: 10, borderRadius: 5, top: -2, marginLeft: -5 },
  rsiLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rsiRef:    { fontSize: 10 },

  w52Container: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  w52Header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  w52Track:     { height: 6, borderRadius: 3, position: 'relative', overflow: 'visible' },
  w52Fill:      { height: 6, borderRadius: 3 },
  w52Thumb: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    top: -4, marginLeft: -7, borderWidth: 2,
  },
  w52Labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  perfRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  perfLabel:       { fontSize: 13, fontWeight: '500', width: 70 },
  perfBarContainer:{ flex: 1, height: 5, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  perfBar:         { height: 5, borderRadius: 3 },
  perfValue:       { fontSize: 13, fontWeight: '600' },

  smaRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  smaLabel:   { flex: 1, fontSize: 13, fontWeight: '500' },
  smaValue:   { fontSize: 14, fontWeight: '600', marginRight: 8 },
  smaBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  smaBadgeText: { fontSize: 12, fontWeight: '600' },
  emaColorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },

  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12,
  },
  trendLabel:   { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  trendReasons: { flex: 1, fontSize: 11, lineHeight: 15 },

  newsItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 10, gap: 6 },
  newsItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sentText:    { fontSize: 11, fontWeight: '600' },
  newsTime:    { fontSize: 11 },
  newsTitle:   { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  newsSummary: { fontSize: 12, lineHeight: 18 },

  cryptoErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  cryptoErrorText:  { flex: 1, fontSize: 13, fontWeight: '500' },
  cryptoErrorRetry: { fontSize: 13, fontWeight: '700' },
})
