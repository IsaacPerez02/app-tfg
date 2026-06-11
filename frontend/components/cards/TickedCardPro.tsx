import { StyleSheet, TouchableOpacity, View, Text } from 'react-native'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'

// ── Mini sparkline (puro SVG, sin dependencias extra) ─────────────────────────

function Sparkline({ data, color, width = 80, height = 32 }: {
  data: number[]
  color: string
  width?: number
  height?: number
}) {
  if (!data || data.length < 2) return <View style={{ width, height }} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const scaleX = (i: number) => (i / (data.length - 1)) * width
  const scaleY = (v: number) => height - 2 - ((v - min) / range) * (height - 4)
  const pts = data.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`)
  const linePath = 'M' + pts.join(' L')
  const fillPath = `${linePath} L${scaleX(data.length - 1).toFixed(1)},${height} L0,${height} Z`

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill={`url(#sg-${color.replace('#', '')})`} />
      <Path d={linePath} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TickerCardProProps {
  symbol:         string
  name:           string
  price:          number
  change:         number
  changeAbs:      number
  dayHigh:        number
  dayLow:         number
  volume:         number
  marketCap?:     number
  sparklineData?: number[]
  isFollowed?:    boolean
  onToggleFollow?: () => void
  onPress?:       () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TickerCardPro({
  symbol,
  name,
  price,
  change,
  changeAbs,
  dayHigh,
  dayLow,
  volume,
  marketCap,
  sparklineData,
  isFollowed,
  onToggleFollow,
  onPress
}: TickerCardProProps) {
  const isDark = useColorScheme() === 'dark'

  const isPositive  = change >= 0
  const changeColor = isPositive ? '#00c896' : '#ff4d6d'
  const bgCard      = isDark ? '#1C1C1E' : '#FFFFFF'
  const bgMuted     = isDark ? '#2A2A2E' : '#F5F5F5'
  const textPrimary = isDark ? '#FFFFFF' : '#000000'
  const textSecondary = isDark ? '#8E8E93' : '#6D6D78'
  const borderColor = isDark ? '#2C2C2E' : '#E5E5EA'

  const formattedPrice = price >= 1000
    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toFixed(price < 1 ? 4 : 2)

  const formattedVolume = volume >= 1e9
    ? `${(volume / 1e9).toFixed(2)}B`
    : volume >= 1e6
    ? `${(volume / 1e6).toFixed(2)}M`
    : `${(volume / 1e3).toFixed(1)}K`

  const formattedCap = !marketCap
    ? null
    : marketCap >= 1e12
    ? `$${(marketCap / 1e12).toFixed(2)}T`
    : marketCap >= 1e9
    ? `$${(marketCap / 1e9).toFixed(2)}B`
    : `$${(marketCap / 1e6).toFixed(2)}M`

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>

        {/* ── Row 1: Symbol + Sparkline + Price ── */}
        <View style={styles.header}>
          {/* Left: badge + names */}
          <View style={styles.symbolSection}>
            <View style={[styles.symbolBadge, { backgroundColor: bgMuted }]}>
              <Text style={[styles.symbolText, { color: textPrimary }]}>
                {symbol.substring(0, 2)}
              </Text>
            </View>
            <View style={styles.nameSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.symbol, { color: textPrimary }]}>{symbol}</Text>
                {isFollowed !== undefined && (
                  <TouchableOpacity
                    onPress={e => { e.stopPropagation(); onToggleFollow?.() }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons
                      name={isFollowed ? 'star' : 'star-outline'}
                      size={15}
                      color={isFollowed ? '#FFD700' : textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.name, { color: textSecondary }]} numberOfLines={1}>{name}</Text>
            </View>
          </View>

          {/* Center: sparkline */}
          {sparklineData && sparklineData.length >= 2 && (
            <View style={styles.sparklineWrap}>
              <Sparkline data={sparklineData} color={changeColor} width={72} height={30} />
            </View>
          )}

          {/* Right: price + change */}
          <View style={styles.priceSection}>
            <Text style={[styles.price, { color: textPrimary }]}>${formattedPrice}</Text>
            <View style={[styles.changeTag, { backgroundColor: changeColor + '22' }]}>
              <MaterialCommunityIcons
                name={isPositive ? 'arrow-top-right' : 'arrow-bottom-left'}
                size={11}
                color={changeColor}
              />
              <Text style={[styles.changeText, { color: changeColor }]}>
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ── Row 2: Stats ── */}
        <View style={[styles.statsRow, { borderTopColor: borderColor }]}>
          <StatCell label="High"   value={`$${dayHigh.toFixed(2)}`}  color={textPrimary}  secondary={textSecondary} />
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <StatCell label="Low"    value={`$${dayLow.toFixed(2)}`}   color={textPrimary}  secondary={textSecondary} />
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <StatCell label="Vol"    value={formattedVolume}           color={textPrimary}  secondary={textSecondary} />
          {formattedCap && (
            <>
              <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
              <StatCell label="MCap" value={formattedCap} color={textPrimary} secondary={textSecondary} />
            </>
          )}
          <MaterialCommunityIcons name="chevron-right" size={16} color={textSecondary} style={styles.arrow} />
        </View>

      </View>
    </TouchableOpacity>
  )
}

function StatCell({ label, value, color, secondary }: {
  label: string; value: string; color: string; secondary: string
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: secondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  symbolSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  symbolBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolText: {
    fontWeight: '700',
    fontSize: 13,
  },
  nameSection: {
    flex: 1,
  },
  symbol: {
    fontSize: 15,
    fontWeight: '700',
  },
  name: {
    fontSize: 12,
    marginTop: 1,
  },
  sparklineWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginHorizontal: 4,
  },
  arrow: {
    marginLeft: 4,
  },
})
