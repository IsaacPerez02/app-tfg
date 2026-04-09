import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface TickerCardProProps {
  symbol: string
  name: string
  price: number
  change: number
  changeAbs: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap: number
  onPress?: () => void
}

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
  onPress
}: TickerCardProProps) {
  const isDark = useColorScheme() === 'dark'

  const isPositive = change >= 0
  const changeColor = isPositive ? '#00CC66' : '#FF3333'
  const bgCard = isDark ? '#1F1F1F' : '#FFFFFF'
  const bgMuted = isDark ? '#2A2A2E' : '#F5F5F5'
  const textPrimary = isDark ? '#FFFFFF' : '#000000'
  const textSecondary = isDark ? '#CCCCCC' : '#666666'

  const formattedVolume = volume >= 1e9 
    ? `$${(volume / 1e9).toFixed(2)}B`
    : volume >= 1e6 
    ? `$${(volume / 1e6).toFixed(2)}M`
    : `$${(volume / 1e3).toFixed(2)}K`

  const formattedCap = marketCap >= 1e9
    ? `$${(marketCap / 1e9).toFixed(2)}B`
    : `$${(marketCap / 1e6).toFixed(2)}M`

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, { backgroundColor: bgCard }]}>
        {/* Header: Symbol + Price */}
        <View style={styles.header}>
          <View style={styles.symbolSection}>
            <View style={[styles.symbolBadge, { backgroundColor: bgMuted }]}>
              <Text style={[styles.symbolText, { color: textPrimary }]}>
                {symbol.substring(0, 2)}
              </Text>
            </View>
            <View style={styles.nameSection}>
              <Text style={[styles.symbol, { color: textPrimary }]}>
                {symbol}
              </Text>
              <Text style={[styles.name, { color: textSecondary }]}>
                {name}
              </Text>
            </View>
          </View>

          <View style={styles.priceSection}>
            <Text style={[styles.price, { color: textPrimary }]}>
              ${price.toFixed(2)}
            </Text>
            <View style={[styles.changeTag, { backgroundColor: changeColor }]}>
              <MaterialCommunityIcons
                name={isPositive ? 'arrow-top-right' : 'arrow-bottom-left'}
                size={12}
                color="#FFFFFF"
              />
              <Text style={styles.changeText}>
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>
              High
            </Text>
            <Text style={[styles.statValue, { color: textPrimary }]}>
              ${dayHigh.toFixed(2)}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>
              Low
            </Text>
            <Text style={[styles.statValue, { color: textPrimary }]}>
              ${dayLow.toFixed(2)}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>
              Volume
            </Text>
            <Text style={[styles.statValue, { color: textPrimary }]}>
              {formattedVolume}
            </Text>
          </View>
        </View>

        {/* Market Cap */}
        <View style={[styles.capRow, { borderTopColor: isDark ? '#2A2A2E' : '#EEEEEE' }]}>
          <Text style={[styles.capLabel, { color: textSecondary }]}>
            Market Cap
          </Text>
          <Text style={[styles.capValue, { color: textPrimary }]}>
            {formattedCap}
          </Text>
        </View>

        {/* Arrow Indicator */}
        <View style={styles.arrowIndicator}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={isDark ? '#666666' : '#CCCCCC'}
          />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  symbolSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  symbolBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolText: {
    fontWeight: '700',
    fontSize: 14,
  },
  nameSection: {
    flex: 1,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    fontSize: 13,
    marginTop: 2,
  },
  priceSection: {
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
  },
  changeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E5EA',
  },
  capRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  capLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  capValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  arrowIndicator: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -10,
  },
})