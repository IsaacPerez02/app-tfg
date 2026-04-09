import { StyleSheet, TouchableOpacity, View, Text } from 'react-native'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { formatPrice } from '@/utils/formatters'
import { AIRecommendation } from '@/types'

interface Props {
  recommendation: AIRecommendation
  onPress?: () => void
}

const ACTION_COLOR = { BUY: '#05B169', SELL: '#F6465D', HOLD: '#F0B90B' }
const RISK_COLOR   = { low: '#05B169', medium: '#F0B90B', high: '#F6465D' }

export function AIRecommendationCard({ recommendation: r, onPress }: Props) {
  const isDark = useColorScheme() === 'dark'

  const textPrimary   = isDark ? '#FFFFFF' : '#000000'
  const textSecondary = isDark ? '#8E8E93' : '#6D6D72'
  const cardBg        = isDark ? '#111111' : '#FFFFFF'
  const borderColor   = isDark ? '#1C1C1E' : '#F0F0F0'
  const trackBg       = isDark ? '#2C2C2E' : '#E8E8E8'

  const actionColor = ACTION_COLOR[r.action]
  const riskColor   = RISK_COLOR[r.risk]

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.ticker, { color: textPrimary }]}>{r.ticker}</Text>
          <Text style={[styles.tickerName, { color: textSecondary }]}>{r.tickerName}</Text>
        </View>
        <View style={[styles.actionBadge, { backgroundColor: actionColor + '20' }]}>
          <Text style={[styles.actionText, { color: actionColor }]}>{r.action}</Text>
        </View>
      </View>

      {/* Confidence bar */}
      <View style={styles.confRow}>
        <View style={[styles.track, { backgroundColor: trackBg }]}>
          <View style={[styles.fill, { width: `${r.confidence}%`, backgroundColor: actionColor }]} />
        </View>
        <Text style={[styles.confLabel, { color: textSecondary }]}>{r.confidence}%</Text>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Target</Text>
          <Text style={[styles.statVal, { color: '#05B169' }]}>{formatPrice(r.targetPrice)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Stop Loss</Text>
          <Text style={[styles.statVal, { color: '#F6465D' }]}>{formatPrice(r.stopLoss)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Riesgo</Text>
          <Text style={[styles.statVal, { color: riskColor }]}>{r.risk.toUpperCase()}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Tiempo</Text>
          <Text style={[styles.statVal, { color: textPrimary }]}>{r.timeframe}</Text>
        </View>
      </View>

      {/* Analysis preview */}
      <Text style={[styles.analysis, { color: textSecondary }]} numberOfLines={2}>
        {r.analysis}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticker: {
    fontSize: 18,
    fontWeight: '700',
  },
  tickerName: {
    fontSize: 13,
    marginTop: 2,
  },
  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  confLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 34,
    textAlign: 'right',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 3,
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  analysis: {
    fontSize: 13,
    lineHeight: 18,
  },
})
