import React from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { MarketIndicators } from '@/types'

// ── Colors ────────────────────────────────────────────────────────────────────

const SIG_COLORS: Record<string, string> = {
  'Buy':        '#00c896',
  'Strong Buy': '#00c896',
  'Sell':       '#ff4d6d',
  'Strong Sell':'#ff4d6d',
  'Neutral':    '#6b7280',
  'Overbought': '#f59e0b',
  'Oversold':   '#60a5fa',
}

function sigColor(s: string | undefined): string {
  return SIG_COLORS[s ?? 'Neutral'] ?? '#6b7280'
}

// ── Gauge ─────────────────────────────────────────────────────────────────────

const GAUGE_ORDER = ['Strong Sell', 'Sell', 'Neutral', 'Buy', 'Strong Buy']

function Gauge({ summary, textS }: { summary: string; textS: string }) {
  const idx = GAUGE_ORDER.indexOf(summary)
  const col = sigColor(summary)
  return (
    <View style={styles.gaugeWrap}>
      <View style={styles.gaugeTrack}>
        {GAUGE_ORDER.map((_, i) => (
          <View
            key={i}
            style={[
              styles.gaugeSegment,
              { backgroundColor: i === idx ? col : col + '30' },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.gaugeSummary, { color: col }]}>{summary}</Text>
    </View>
  )
}

// ── Table row ─────────────────────────────────────────────────────────────────

function IndRow({
  name, value, signal, border, textP, textS,
}: {
  name: string; value: string | null; signal: string | undefined
  border: string; textP: string; textS: string
}) {
  const col = sigColor(signal)
  return (
    <View style={[styles.row, { borderBottomColor: border }]}>
      <Text style={[styles.rowName, { color: textS }]}>{name}</Text>
      <Text style={[styles.rowValue, { color: textP }]}>{value ?? '—'}</Text>
      <View style={[styles.sigBadge, { backgroundColor: col + '22' }]}>
        <Text style={[styles.sigText, { color: col }]}>{signal ?? 'Neutral'}</Text>
      </View>
    </View>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  indicator:  MarketIndicators | null
  timeframe:  string
  loading?:   boolean
  surface:    string
  surface2:   string
  textP:      string
  textS:      string
  border:     string
}

function fmt(v: number | null | undefined, d = 2): string | null {
  if (v == null || isNaN(v as number)) return null
  return (v as number).toFixed(d)
}

export function IndicatorsTable({
  indicator, timeframe, loading, surface, surface2, textP, textS, border,
}: Props) {
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: surface }]}>
        <ActivityIndicator color="#00b4d8" style={{ marginVertical: 24 }} />
      </View>
    )
  }

  if (!indicator) {
    return (
      <View style={[styles.container, { backgroundColor: surface }]}>
        <Text style={[styles.empty, { color: textS }]}>
          Sin datos de indicadores para {timeframe.toUpperCase()}
        </Text>
      </View>
    )
  }

  const os = indicator.oscillator_signals ?? {}
  const ms = indicator.ma_signals ?? {}
  const oSum = indicator.oscillators_summary ?? 'Neutral'
  const mSum = indicator.ma_summary ?? 'Neutral'
  const gSum = indicator.global_summary ?? 'Neutral'
  const close = indicator.close ?? 0

  // Oscillators rows
  const oscillatorRows: { name: string; value: string | null; sig: string }[] = [
    { name: 'RSI (14)',         value: fmt(indicator.rsi_14, 1),     sig: os['rsi_14']     ?? 'Neutral' },
    { name: 'Stoch %K (14)',    value: fmt(indicator.stoch_k, 1),    sig: os['stoch_k']    ?? 'Neutral' },
    { name: 'StochRSI (14)',    value: fmt(indicator.stochrsi_k, 1), sig: os['stochrsi_k'] ?? 'Neutral' },
    { name: 'MACD (12,26,9)',   value: fmt(indicator.macd, 4),       sig: os['macd']       ?? 'Neutral' },
    { name: 'CCI (20)',         value: fmt(indicator.cci_20, 1),     sig: os['cci_20']     ?? 'Neutral' },
    { name: "Williams %R",      value: fmt(indicator.willr_14, 1),   sig: os['willr_14']   ?? 'Neutral' },
    { name: 'Ult. Oscillator',  value: fmt(indicator.uo, 1),         sig: os['uo']         ?? 'Neutral' },
    { name: 'ROC (9)',          value: fmt(indicator.roc_9, 2),      sig: os['roc_9']      ?? 'Neutral' },
    { name: 'Awesome Osc.',     value: fmt(indicator.ao, 4),         sig: os['ao']         ?? 'Neutral' },
    { name: 'Momentum (10)',    value: fmt(indicator.mom_10, 3),     sig: os['mom_10']     ?? 'Neutral' },
    { name: 'Bull Power',       value: fmt(indicator.bull_power, 3), sig: os['bull_power'] ?? 'Neutral' },
    { name: 'Bear Power',       value: fmt(indicator.bear_power, 3), sig: os['bear_power'] ?? 'Neutral' },
  ].filter(r => r.value !== null)

  // MA rows
  const maRows: { name: string; value: string | null; sig: string }[] = [
    { name: 'EMA (5)',   value: fmt(indicator.ema_5),   sig: ms['ema_5']   ?? 'Neutral' },
    { name: 'SMA (5)',   value: fmt(indicator.sma_5),   sig: ms['sma_5']   ?? 'Neutral' },
    { name: 'EMA (9)',   value: fmt(indicator.ema_9),   sig: ms['ema_9']   ?? 'Neutral' },
    { name: 'SMA (10)',  value: fmt(indicator.sma_10),  sig: ms['sma_10']  ?? 'Neutral' },
    { name: 'EMA (10)',  value: fmt(indicator.ema_10),  sig: ms['ema_10']  ?? 'Neutral' },
    { name: 'EMA (20)',  value: fmt(indicator.ema_20),  sig: ms['ema_20']  ?? 'Neutral' },
    { name: 'SMA (20)',  value: fmt(indicator.sma_20),  sig: ms['sma_20']  ?? 'Neutral' },
    { name: 'EMA (21)',  value: fmt(indicator.ema_21),  sig: ms['ema_21']  ?? 'Neutral' },
    { name: 'WMA (20)',  value: fmt(indicator.wma_20),  sig: ms['wma_20']  ?? 'Neutral' },
    { name: 'EMA (50)',  value: fmt(indicator.ema_50),  sig: ms['ema_50']  ?? 'Neutral' },
    { name: 'SMA (50)',  value: fmt(indicator.sma_50),  sig: ms['sma_50']  ?? 'Neutral' },
    { name: 'EMA (100)', value: fmt(indicator.ema_100), sig: ms['ema_100'] ?? 'Neutral' },
    { name: 'SMA (100)', value: fmt(indicator.sma_100), sig: ms['sma_100'] ?? 'Neutral' },
    { name: 'HMA (9)',   value: fmt(indicator.hma_9),   sig: ms['hma_9']   ?? 'Neutral' },
    { name: 'VWMA (20)', value: fmt(indicator.vwma_20), sig: ms['vwma_20'] ?? 'Neutral' },
    { name: 'EMA (200)', value: fmt(indicator.ema_200), sig: ms['ema_200'] ?? 'Neutral' },
    { name: 'SMA (200)', value: fmt(indicator.sma_200), sig: ms['sma_200'] ?? 'Neutral' },
  ].filter(r => r.value !== null)

  return (
    <View style={{ backgroundColor: surface }}>
      {/* Header row */}
      <View style={[styles.tableHeader, { borderBottomColor: border }]}>
        <Text style={[styles.tableHeaderText, { color: '#00b4d8' }]}>
          Technical Indicators — {timeframe.toUpperCase()}
        </Text>
      </View>

      {/* Global gauge */}
      <View style={[styles.globalGaugeRow, { borderBottomColor: border }]}>
        <Text style={[styles.gaugeLbl, { color: textS }]}>Overall</Text>
        <Gauge summary={gSum} textS={textS} />
      </View>

      {/* Oscillators table */}
      <View style={[styles.sectionTitle, { backgroundColor: surface2 }]}>
        <Text style={[styles.sectionTitleText, { color: textS }]}>Oscillators</Text>
        <View style={[styles.summaryBadge, { backgroundColor: sigColor(oSum) + '22' }]}>
          <Text style={[styles.summaryText, { color: sigColor(oSum) }]}>{oSum}</Text>
        </View>
      </View>
      <View style={[styles.colHeader, { borderBottomColor: border }]}>
        <Text style={[styles.colName, { color: textS }]}>Name</Text>
        <Text style={[styles.colVal,  { color: textS }]}>Value</Text>
        <Text style={[styles.colSig,  { color: textS }]}>Action</Text>
      </View>
      {oscillatorRows.map(r => (
        <IndRow key={r.name} name={r.name} value={r.value} signal={r.sig} border={border} textP={textP} textS={textS} />
      ))}

      {/* MA table */}
      <View style={[styles.sectionTitle, { backgroundColor: surface2 }]}>
        <Text style={[styles.sectionTitleText, { color: textS }]}>Moving Averages</Text>
        <View style={[styles.summaryBadge, { backgroundColor: sigColor(mSum) + '22' }]}>
          <Text style={[styles.summaryText, { color: sigColor(mSum) }]}>{mSum}</Text>
        </View>
      </View>
      <View style={[styles.colHeader, { borderBottomColor: border }]}>
        <Text style={[styles.colName, { color: textS }]}>Name</Text>
        <Text style={[styles.colVal,  { color: textS }]}>Value</Text>
        <Text style={[styles.colSig,  { color: textS }]}>Action</Text>
      </View>
      {maRows.map(r => (
        <IndRow key={r.name} name={r.name} value={r.value} signal={r.sig} border={border} textP={textP} textS={textS} />
      ))}

      {/* Extra stats */}
      {(indicator.adx_14 != null || indicator.atr_14 != null || indicator.vwap != null || indicator.mfi_14 != null) && (
        <>
          <View style={[styles.sectionTitle, { backgroundColor: surface2 }]}>
            <Text style={[styles.sectionTitleText, { color: textS }]}>Other</Text>
          </View>
          {indicator.adx_14  != null && <IndRow name="ADX (14)"  value={fmt(indicator.adx_14, 1)}  signal="Neutral" border={border} textP={textP} textS={textS} />}
          {indicator.atr_14  != null && <IndRow name="ATR (14)"  value={fmt(indicator.atr_14)}      signal="Neutral" border={border} textP={textP} textS={textS} />}
          {indicator.vwap    != null && <IndRow name="VWAP"      value={fmt(indicator.vwap)}         signal={close > (indicator.vwap ?? 0) ? 'Buy' : 'Sell'} border={border} textP={textP} textS={textS} />}
          {indicator.mfi_14  != null && <IndRow name="MFI (14)"  value={fmt(indicator.mfi_14, 1)}   signal={indicator.mfi_14 > 80 ? 'Overbought' : indicator.mfi_14 < 20 ? 'Oversold' : 'Neutral'} border={border} textP={textP} textS={textS} />}
          {indicator.cmf_20  != null && <IndRow name="CMF (20)"  value={fmt(indicator.cmf_20, 3)}   signal={indicator.cmf_20 > 0 ? 'Buy' : 'Sell'} border={border} textP={textP} textS={textS} />}
        </>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 20 },
  empty:     { fontSize: 13, marginVertical: 20 },

  tableHeader: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  globalGaugeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  gaugeLbl:   { fontSize: 12, fontWeight: '600', width: 50 },
  gaugeWrap:  { flex: 1, gap: 4 },
  gaugeTrack: { flexDirection: 'row', gap: 3, height: 6 },
  gaugeSegment: { flex: 1, borderRadius: 3 },
  gaugeSummary: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  sectionTitle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 7,
  },
  sectionTitleText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  summaryText:  { fontSize: 11, fontWeight: '700' },

  colHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colName: { flex: 1.5, fontSize: 10, fontWeight: '600' },
  colVal:  { flex: 1,   fontSize: 10, fontWeight: '600', textAlign: 'right' },
  colSig:  { width: 80, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName:  { flex: 1.5, fontSize: 12 },
  rowValue: { flex: 1, fontSize: 12, fontWeight: '500', textAlign: 'right', fontVariant: ['tabular-nums'] },
  sigBadge: { width: 80, paddingVertical: 3, borderRadius: 5, alignItems: 'center' },
  sigText:  { fontSize: 11, fontWeight: '600' },
})
