import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MOCK_RECOMMENDATIONS } from '@/utils/mock-data'
import { formatPrice, formatPercent } from '@/utils/formatters'

const ACTION_COLOR = { BUY: '#05B169', SELL: '#F6465D', HOLD: '#F0B90B' }
const ACTION_LABEL = { BUY: 'COMPRAR', SELL: 'VENDER', HOLD: 'MANTENER' }
const RISK_COLOR   = { low: '#05B169', medium: '#F0B90B', high: '#F6465D' }
const RISK_LABEL   = { low: 'Bajo', medium: 'Medio', high: 'Alto' }

export default function PredictionDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const isDark  = useColorScheme() === 'dark'

  const rec = MOCK_RECOMMENDATIONS.find(r => r.id === id)

  const bg      = isDark ? '#000000' : '#F7F8FA'
  const surface = isDark ? '#111111' : '#FFFFFF'
  const textP   = isDark ? '#FFFFFF' : '#000000'
  const textS   = isDark ? '#8E8E93' : '#6D6D72'
  const border  = isDark ? '#1C1C1E' : '#E8E8E8'
  const track   = isDark ? '#2C2C2E' : '#E8E8E8'

  if (!rec) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={{ color: textS, fontSize: 16 }}>Señal no encontrada</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Text style={{ color: '#00b4d8', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const actionColor  = ACTION_COLOR[rec.action]
  const actionLabel  = ACTION_LABEL[rec.action]
  const riskColor    = RISK_COLOR[rec.risk]
  const riskLabel    = RISK_LABEL[rec.risk]

  const potentialPct = rec.entryPrice
    ? ((rec.targetPrice - rec.entryPrice) / rec.entryPrice) * 100
    : 0

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={{ color: '#00b4d8', fontSize: 16 }}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: textP }]}>IA Insight</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.heroRow}>
            <View>
              <Text style={[styles.ticker, { color: textP }]}>{rec.ticker}</Text>
              <Text style={[styles.tickerName, { color: textS }]}>{rec.tickerName}</Text>
            </View>
            <View style={[styles.actionBadge, { backgroundColor: actionColor }]}>
              <Text style={styles.actionText}>{actionLabel}</Text>
            </View>
          </View>

          {/* Confidence */}
          <View style={styles.confSection}>
            <View style={styles.confHeader}>
              <Text style={[styles.confLabel, { color: textS }]}>Confianza de la señal</Text>
              <Text style={[styles.confPct, { color: actionColor }]}>{rec.confidence}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: track }]}>
              <View style={[styles.fill, { width: `${rec.confidence}%`, backgroundColor: actionColor }]} />
            </View>
          </View>

          {/* Price targets */}
          <View style={[styles.priceGrid, { borderTopColor: border }]}>
            {rec.entryPrice && (
              <View style={styles.priceCell}>
                <Text style={[styles.priceLabel, { color: textS }]}>Entrada</Text>
                <Text style={[styles.priceVal, { color: textP }]}>{formatPrice(rec.entryPrice)}</Text>
              </View>
            )}
            <View style={styles.priceSep} />
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: textS }]}>Objetivo</Text>
              <Text style={[styles.priceVal, { color: '#05B169' }]}>{formatPrice(rec.targetPrice)}</Text>
            </View>
            <View style={styles.priceSep} />
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: textS }]}>Stop Loss</Text>
              <Text style={[styles.priceVal, { color: '#F6465D' }]}>{formatPrice(rec.stopLoss)}</Text>
            </View>
          </View>

          {/* Meta chips */}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: riskColor + '20' }]}>
              <Text style={[styles.chipText, { color: riskColor }]}>Riesgo: {riskLabel}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: '#00b4d8' + '20' }]}>
              <Text style={[styles.chipText, { color: '#00b4d8' }]}>Timeframe: {rec.timeframe}</Text>
            </View>
            {rec.entryPrice && (
              <View style={[styles.chip, { backgroundColor: actionColor + '20' }]}>
                <Text style={[styles.chipText, { color: actionColor }]}>
                  Potencial: {formatPercent(potentialPct)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Analysis */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: textS }]}>Análisis</Text>
          <Text style={[styles.sectionBody, { color: textP }]}>{rec.analysis}</Text>
        </View>

        {/* Technical indicators */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: textS }]}>Indicadores técnicos</Text>

          {([
            { label: 'RSI',         value: rec.indicators.rsi.toString(), sub: rec.indicators.rsi > 70 ? 'Sobrecompra' : rec.indicators.rsi < 30 ? 'Sobreventa' : 'Neutral' },
            { label: 'MACD',        value: rec.indicators.macd },
            { label: 'Media 50',    value: formatPrice(rec.indicators.movingAverage50) },
            { label: 'Bollinger',   value: rec.indicators.bollinger },
          ] as { label: string; value: string; sub?: string }[]).map((ind, i, arr) => (
            <View
              key={ind.label}
              style={[
                styles.indRow,
                { borderBottomColor: border, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0 }
              ]}
            >
              <Text style={[styles.indLabel, { color: textS }]}>{ind.label}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.indVal, { color: textP }]}>{ind.value}</Text>
                {ind.sub && <Text style={{ color: textS, fontSize: 11, marginTop: 1 }}>{ind.sub}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* Model info */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: textS }]}>Generado por</Text>
          <Text style={[styles.modelName, { color: '#00b4d8' }]}>{rec.aiModel}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontSize: 17, fontWeight: '700' },

  hero: {
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticker:     { fontSize: 28, fontWeight: '700' },
  tickerName: { fontSize: 14, marginTop: 2 },
  actionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  confSection: { gap: 8 },
  confHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  confLabel: { fontSize: 13 },
  confPct:   { fontSize: 13, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },

  priceGrid: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  priceCell:  { flex: 1, alignItems: 'center', gap: 4 },
  priceSep:   { width: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E' },
  priceLabel: { fontSize: 12 },
  priceVal:   { fontSize: 15, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600' },

  section: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBody:  { fontSize: 15, lineHeight: 22 },
  modelName:    { fontSize: 15, fontWeight: '600' },

  indRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  indLabel: { fontSize: 14 },
  indVal:   { fontSize: 14, fontWeight: '600' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
})
