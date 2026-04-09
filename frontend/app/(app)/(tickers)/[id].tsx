import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { TradingViewChart } from '@/components/charts/TradingViewChart'

const { width: SCREEN_W } = Dimensions.get('window')
const API_URL = process.env.EXPO_PUBLIC_API

// ─── Types ───────────────────────────────────────────────────────────────────

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
  sma20: (number | null)[]
  sma50: (number | null)[]
  sma200: (number | null)[]
  rsi: (number | null)[]
  macd: { macdLine: (number | null)[]; signalLine: (number | null)[] }
  bollingerBands: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
}

interface Fundamentals {
  beta?: number | null
  eps?: number | null
  forwardPE?: number | null
  priceToBook?: number | null
  returnOnEquity?: number | null
  profitMargins?: number | null
  debtToEquity?: number | null
  freeCashflow?: number | null
}

interface TickerDetail {
  symbol: string
  name: string
  price: number
  change: number
  changeAbs: number
  currency: string
  marketCap: number
  volume: number
  avgVolume: number
  open: number
  dayHigh: number
  dayLow: number
  previousClose: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  pe: number | null
  dividend: number
  changes: { day: number; week: number; month: number; threeMonths: number; year: number }
  historicalData: OHLCData[]
  indicators: Indicators
  fundamentals?: Fundamentals
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  if (!n || isNaN(n)) return 'N/A'
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtLarge(n: number) {
  if (!n || isNaN(n)) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function lastValidRSI(rsi: (number | null)[]) {
  for (let i = rsi.length - 1; i >= 0; i--) {
    if (rsi[i] !== null) return rsi[i] as number
  }
  return null
}

function rsiLabel(rsi: number) {
  if (rsi >= 70) return { label: 'Sobrecompra', color: '#FF3333' }
  if (rsi <= 30) return { label: 'Sobreventa', color: '#00CC66' }
  return { label: 'Neutral', color: '#FF9500' }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, valueColor, bg, textP, textS
}: {
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

// ─── Performance Row ──────────────────────────────────────────────────────────

function PerfRow({
  label, value, textP, textS
}: {
  label: string; value: number | undefined
  textP: string; textS: string
}) {
  const pct = value ?? 0
  const isPos = pct >= 0
  const color = isPos ? '#00CC66' : '#FF3333'
  const barW = Math.min(Math.abs(pct) * 4, 80)

  return (
    <View style={styles.perfRow}>
      <Text style={[styles.perfLabel, { color: textS }]}>{label}</Text>
      <View style={styles.perfBarContainer}>
        {!isPos && <View style={[styles.perfBar, { width: barW, backgroundColor: color, marginLeft: 'auto' as any }]} />}
        {isPos && <View style={[styles.perfBar, { width: barW, backgroundColor: color }]} />}
      </View>
      <Text style={[styles.perfValue, { color, width: 70, textAlign: 'right' }]}>{fmtPct(pct)}</Text>
    </View>
  )
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, textP }: { title: string; textP: string }) {
  return <Text style={[styles.sectionHeader, { color: textP }]}>{title}</Text>
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TickerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'

  const [ticker, setTicker] = useState<TickerDetail | null>(null)
  const [chartData, setChartData] = useState<OHLCData[]>([])
  const [chartIndicators, setChartIndicators] = useState<Partial<Indicators>>({})
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeRange, setActiveRange] = useState<RangeKey>('1y')

  // ─ Theme
  const bg       = isDark ? '#0A0A0A' : '#F2F2F7'
  const surface  = isDark ? '#1C1C1E' : '#FFFFFF'
  const surface2 = isDark ? '#2C2C2E' : '#F5F5F5'
  const textP    = isDark ? '#FFFFFF' : '#000000'
  const textS    = isDark ? '#8E8E93' : '#6D6D78'
  const border   = isDark ? '#2C2C2E' : '#E5E5EA'
  const accent   = '#00b4d8'
  const upColor  = '#00CC66'
  const downColor = '#FF3333'

  // ─ Fetch full ticker
  const fetchTicker = useCallback(async () => {
    try {
      setRefreshing(true)
      const res  = await fetch(`${API_URL}/tickers/${id}`)
      const json = await res.json()
      if (json?.success && json?.ticker) {
        const t: TickerDetail = json.ticker
        setTicker(t)
        setChartData(t.historicalData)
        setChartIndicators({
          sma20: t.indicators?.sma20,
          sma50: t.indicators?.sma50,
        })
      } else {
        throw new Error('Invalid response')
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el activo')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  // ─ Fetch chart by range
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
        setChartIndicators({
          sma20: json.indicators?.sma20,
          sma50: json.indicators?.sma50,
        })
      }
    } catch (err) {
      console.warn('Range fetch error:', err)
    } finally {
      setChartLoading(false)
    }
  }, [id, ticker])

  useEffect(() => { if (id) fetchTicker() }, [id, fetchTicker])

  const handleRangeChange = (range: RangeKey) => {
    setActiveRange(range)
    fetchChartRange(range)
  }

  // ─── Loading ───
  if (loading || !ticker) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={[styles.loadingText, { color: textS }]}>Cargando activo...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isPositive = ticker.change >= 0
  const changeColor = isPositive ? upColor : downColor
  const rsiVal  = lastValidRSI(ticker.indicators?.rsi || [])
  const rsiInfo = rsiVal !== null ? rsiLabel(rsiVal) : null

  // 52W range position for price
  const w52Range = ticker.fiftyTwoWeekHigh - ticker.fiftyTwoWeekLow
  const pricePos = w52Range > 0 ? ((ticker.price - ticker.fiftyTwoWeekLow) / w52Range) : 0.5

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={accent} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerSymbol, { color: textP }]}>{ticker.symbol}</Text>
          <Text style={[styles.headerName, { color: textS }]} numberOfLines={1}>{ticker.name}</Text>
        </View>
        <TouchableOpacity onPress={fetchTicker} style={styles.headerBtn} disabled={refreshing}>
          <MaterialCommunityIcons
            name={refreshing ? 'loading' : 'refresh'}
            size={22}
            color={accent}
          />
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
            {ticker.currency === 'USD' ? '$' : ''}{fmt(ticker.price)}
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={[styles.changeBadge, { backgroundColor: changeColor + '22' }]}>
              <MaterialCommunityIcons
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={14}
                color={changeColor}
              />
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
              <Text style={[styles.quickVal, { color: (val ?? 0) >= 0 ? upColor : downColor }]}>
                {fmtPct(val ?? 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── CHART ── */}
        <View style={[styles.chartWrapper, { backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF' }]}>
          <TradingViewChart
            data={chartData}
            sma20={chartIndicators.sma20}
            sma50={chartIndicators.sma50}
            isDark={isDark}
            height={370}
          />
          {chartLoading && (
            <View style={styles.chartOverlay}>
              <ActivityIndicator size="small" color={accent} />
            </View>
          )}
        </View>

        {/* ── RANGE SELECTOR ── */}
        <View style={[styles.rangeRow, { backgroundColor: surface }]}>
          {RANGES.map(r => {
            const isActive = activeRange === r.value
            return (
              <TouchableOpacity
                key={r.value}
                onPress={() => handleRangeChange(r.value)}
                style={[
                  styles.rangeBtn,
                  isActive && { backgroundColor: accent },
                ]}
              >
                <Text style={[
                  styles.rangeBtnText,
                  { color: isActive ? '#FFFFFF' : textS },
                  isActive && { fontWeight: '700' },
                ]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── TECHNICAL INDICATORS ── */}
        {rsiInfo && (
          <View style={[styles.section, { backgroundColor: surface }]}>
            <SectionHeader title="📊 Indicadores Técnicos" textP={textP} />

            {/* RSI */}
            <View style={[styles.techRow, { borderBottomColor: border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.techLabel, { color: textS }]}>RSI (14)</Text>
                <Text style={[styles.techValue, { color: rsiInfo.color }]}>
                  {rsiVal?.toFixed(1)} · {rsiInfo.label}
                </Text>
              </View>
              <View style={styles.rsiBar}>
                <View style={[styles.rsiTrack, { backgroundColor: surface2 }]}>
                  <View style={[
                    styles.rsiThumb,
                    { left: `${Math.min(rsiVal!, 100)}%` as any, backgroundColor: rsiInfo.color }
                  ]} />
                </View>
                <View style={styles.rsiLabels}>
                  <Text style={[styles.rsiRef, { color: textS }]}>30</Text>
                  <Text style={[styles.rsiRef, { color: textS }]}>70</Text>
                </View>
              </View>
            </View>

            {/* MACD */}
            {ticker.indicators?.macd && (() => {
              const ml = ticker.indicators.macd.macdLine
              const sl = ticker.indicators.macd.signalLine
              const lastMacd = ml[ml.length - 1]
              const lastSignal = sl[sl.length - 1]
              if (lastMacd == null || lastSignal == null) return null
              const isBull = lastMacd > lastSignal
              return (
                <View style={[styles.techRow, { borderBottomColor: border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.techLabel, { color: textS }]}>MACD</Text>
                    <Text style={[styles.techValue, { color: isBull ? upColor : downColor }]}>
                      {isBull ? '↑ Señal alcista' : '↓ Señal bajista'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.techValueSmall, { color: textS }]}>
                      MACD: {lastMacd.toFixed(2)}
                    </Text>
                    <Text style={[styles.techValueSmall, { color: textS }]}>
                      Señal: {lastSignal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )
            })()}

            {/* Bollinger Bands */}
            {ticker.indicators?.bollingerBands && (() => {
              const bb = ticker.indicators.bollingerBands
              const lastUpper = bb.upper[bb.upper.length - 1]
              const lastLower = bb.lower[bb.lower.length - 1]
              if (lastUpper == null || lastLower == null) return null
              const bbRange = lastUpper - lastLower
              const pos = bbRange > 0 ? ((ticker.price - lastLower) / bbRange) * 100 : 50
              return (
                <View style={[styles.techRow, { borderBottomColor: 'transparent' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.techLabel, { color: textS }]}>Bollinger Bands</Text>
                    <Text style={[styles.techValue, { color: textP }]}>
                      Posición: {pos.toFixed(0)}% del rango
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.techValueSmall, { color: upColor }]}>↑ {fmt(lastUpper)}</Text>
                    <Text style={[styles.techValueSmall, { color: downColor }]}>↓ {fmt(lastLower)}</Text>
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
            <StatCard label="Apertura"      value={`$${fmt(ticker.open)}`}             bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Cierre Previo" value={`$${fmt(ticker.previousClose)}`}    bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Máx. Diario"   value={`$${fmt(ticker.dayHigh)}`}          bg={surface2} textP={textP} textS={textS} valueColor={upColor} />
            <StatCard label="Mín. Diario"   value={`$${fmt(ticker.dayLow)}`}           bg={surface2} textP={textP} textS={textS} valueColor={downColor} />
            <StatCard label="Volumen"        value={fmtLarge(ticker.volume)}            bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Vol. Promedio"  value={fmtLarge(ticker.avgVolume)}         bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Cap. Bursátil"  value={fmtLarge(ticker.marketCap)}         bg={surface2} textP={textP} textS={textS} />
            <StatCard label="P/E Ratio"      value={ticker.pe ? fmt(ticker.pe, 1) : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Dividendo"      value={ticker.dividend ? `${(ticker.dividend * 100).toFixed(2)}%` : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="Beta"           value={ticker.fundamentals?.beta ? fmt(ticker.fundamentals.beta) : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="EPS"            value={ticker.fundamentals?.eps ? `$${fmt(ticker.fundamentals.eps)}` : 'N/A'} bg={surface2} textP={textP} textS={textS} />
            <StatCard label="P/B Ratio"      value={ticker.fundamentals?.priceToBook ? fmt(ticker.fundamentals.priceToBook, 1) : 'N/A'} bg={surface2} textP={textP} textS={textS} />
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
              <LinearGradient
                colors={[downColor, '#FF9500', upColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.w52Fill}
              />
              <View style={[styles.w52Thumb, {
                left: `${Math.max(4, Math.min(pricePos * 100, 96))}%` as any,
                backgroundColor: surface,
                borderColor: accent,
              }]} />
            </View>
            <View style={styles.w52Labels}>
              <Text style={[styles.rsiRef, { color: downColor }]}>${fmt(ticker.fiftyTwoWeekLow)}</Text>
              <Text style={[styles.rsiRef, { color: textS }]}>${fmt(ticker.price)}</Text>
              <Text style={[styles.rsiRef, { color: upColor }]}>${fmt(ticker.fiftyTwoWeekHigh)}</Text>
            </View>
          </View>
        </View>

        {/* ── FUNDAMENTALS ── */}
        {ticker.fundamentals && (
          ticker.fundamentals.returnOnEquity != null ||
          ticker.fundamentals.profitMargins != null
        ) && (
          <View style={[styles.section, { backgroundColor: surface }]}>
            <SectionHeader title="🏦 Fundamentales" textP={textP} />
            <View style={styles.statsGrid}>
              {ticker.fundamentals?.returnOnEquity != null && (
                <StatCard
                  label="ROE"
                  value={`${((ticker.fundamentals.returnOnEquity) * 100).toFixed(1)}%`}
                  bg={surface2} textP={textP} textS={textS}
                  valueColor={(ticker.fundamentals.returnOnEquity) > 0 ? upColor : downColor}
                />
              )}
              {ticker.fundamentals?.profitMargins != null && (
                <StatCard
                  label="Margen Neto"
                  value={`${((ticker.fundamentals.profitMargins) * 100).toFixed(1)}%`}
                  bg={surface2} textP={textP} textS={textS}
                  valueColor={(ticker.fundamentals.profitMargins) > 0 ? upColor : downColor}
                />
              )}
              {ticker.fundamentals?.debtToEquity != null && (
                <StatCard
                  label="Deuda/Capital"
                  value={fmt(ticker.fundamentals.debtToEquity, 1)}
                  bg={surface2} textP={textP} textS={textS}
                />
              )}
              {ticker.fundamentals?.freeCashflow != null && (
                <StatCard
                  label="Free Cash Flow"
                  value={fmtLarge(ticker.fundamentals.freeCashflow)}
                  bg={surface2} textP={textP} textS={textS}
                />
              )}
            </View>
          </View>
        )}

        {/* ── PERFORMANCE ── */}
        <View style={[styles.section, { backgroundColor: surface }]}>
          <SectionHeader title="💹 Rendimiento" textP={textP} />
          <PerfRow label="1 Día"   value={ticker.changes?.day}         textP={textP} textS={textS} />
          <PerfRow label="1 Semana" value={ticker.changes?.week}       textP={textP} textS={textS} />
          <PerfRow label="1 Mes"   value={ticker.changes?.month}       textP={textP} textS={textS} />
          <PerfRow label="3 Meses" value={ticker.changes?.threeMonths} textP={textP} textS={textS} />
          <PerfRow label="1 Año"   value={ticker.changes?.year}        textP={textP} textS={textS} />
        </View>

        {/* ── SMA SNAPSHOT ── */}
        <View style={[styles.section, { backgroundColor: surface, marginBottom: 100 }]}>
          <SectionHeader title="📉 Medias Móviles" textP={textP} />
          {[
            { label: 'SMA 20', data: ticker.indicators?.sma20 },
            { label: 'SMA 50', data: ticker.indicators?.sma50 },
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
                <View style={[
                  styles.smaBadge,
                  { backgroundColor: (isAbove ? upColor : downColor) + '22' }
                ]}>
                  <Text style={[styles.smaBadgeText, { color: isAbove ? upColor : downColor }]}>
                    {isAbove ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, fontWeight: '500' },
  scrollContent: {},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, alignItems: 'center',
  },
  headerSymbol: { fontSize: 17, fontWeight: '700' },
  headerName: { fontSize: 12, marginTop: 1 },

  // Price hero
  priceHero: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heroPrice: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeBadgeText: { fontSize: 14, fontWeight: '600' },
  heroMeta: { fontSize: 13 },

  // Quick strip
  quickStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 2,
  },
  quickItem: { alignItems: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '500', marginBottom: 3 },
  quickVal: { fontSize: 13, fontWeight: '700' },

  // Chart
  chartWrapper: {
    width: '100%',
    position: 'relative',
  },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // Range
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  rangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rangeBtnText: { fontSize: 13, fontWeight: '500' },

  // Section
  section: {
    marginHorizontal: 0,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: (SCREEN_W - 48) / 2 - 4,
    padding: 12,
    borderRadius: 12,
  },
  statCardLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  statCardValue: { fontSize: 15, fontWeight: '700' },

  // Technical
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  techLabel: { fontSize: 12, fontWeight: '500', marginBottom: 3 },
  techValue: { fontSize: 14, fontWeight: '600' },
  techValueSmall: { fontSize: 12, fontWeight: '500' },

  rsiBar: { flex: 1, marginLeft: 12 },
  rsiTrack: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
    marginBottom: 4,
  },
  rsiThumb: {
    position: 'absolute',
    width: 10, height: 10,
    borderRadius: 5,
    top: -2,
    marginLeft: -5,
  },
  rsiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rsiRef: { fontSize: 10 },

  // 52W
  w52Container: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  w52Header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  w52Track: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  w52Fill: {
    height: 6,
    borderRadius: 3,
  },
  w52Thumb: {
    position: 'absolute',
    width: 14, height: 14,
    borderRadius: 7,
    top: -4,
    marginLeft: -7,
    borderWidth: 2,
  },
  w52Labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  // Performance
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  perfLabel: { fontSize: 13, fontWeight: '500', width: 70 },
  perfBarContainer: {
    flex: 1,
    height: 5,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  perfBar: { height: 5, borderRadius: 3 },
  perfValue: { fontSize: 13, fontWeight: '600' },

  // SMA
  smaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  smaLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  smaValue: { fontSize: 14, fontWeight: '600', marginRight: 8 },
  smaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smaBadgeText: { fontSize: 12, fontWeight: '600' },
})