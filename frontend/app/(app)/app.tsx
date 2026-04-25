import { ScrollView, View, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useMarketData } from '@/hooks/use-market-data'
import { useNewsFeed } from '@/hooks/use-news-data'
import { TickerCard } from '@/components/cards/TickerCard'
import { NewsCard } from '@/components/cards/NewsCard'
import { formatPrice, formatPercent } from '@/utils/formatters'

export default function HomeScreen() {
  const router  = useRouter()
  const isDark  = useColorScheme() === 'dark'
  const { tickers } = useMarketData()
  const { news }    = useNewsFeed('latest')

  const bg        = isDark ? '#000000' : '#F7F8FA'
  const surface   = isDark ? '#111111' : '#FFFFFF'
  const textP     = isDark ? '#FFFFFF' : '#000000'
  const textS     = isDark ? '#8E8E93' : '#6D6D72'
  const border    = isDark ? '#1C1C1E' : '#E8E8E8'

  const portfolioValue  = 45234.50
  const portfolioChange = 2.34
  const portfolioDelta  = (portfolioValue * portfolioChange) / 100

  const topGainer = tickers.length
    ? tickers.reduce((p, c) => c.change24h > p.change24h ? c : p)
    : null

  const topLoser = tickers.length
    ? tickers.reduce((p, c) => c.change24h < p.change24h ? c : p)
    : null

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        {/* ── Portfolio header ── */}
        <View style={[styles.portfolioSection, { backgroundColor: surface, borderBottomColor: border }]}>
          <Text style={[styles.portfolioLabel, { color: textS }]}>Tu portafolio</Text>
          <Text style={[styles.portfolioValue, { color: textP }]}>
            {formatPrice(portfolioValue)}
          </Text>
          <Text style={[
            styles.portfolioDelta,
            { color: portfolioChange >= 0 ? '#05B169' : '#F6465D' }
          ]}>
            {portfolioChange >= 0 ? '+' : ''}{formatPrice(Math.abs(portfolioDelta), 2)}
            {' '}({formatPercent(portfolioChange)}) hoy
          </Text>
        </View>

        {/* ── Quick stats ── */}
        {topGainer && topLoser && (
          <View style={[styles.statsRow, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: textS }]}>Mejor 24h</Text>
              <Text style={[styles.statSym,   { color: textP }]}>{topGainer.symbol}</Text>
              <Text style={{ color: '#05B169', fontSize: 13, fontWeight: '600' }}>
                {formatPercent(topGainer.change24h)}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: textS }]}>Peor 24h</Text>
              <Text style={[styles.statSym,   { color: textP }]}>{topLoser.symbol}</Text>
              <Text style={{ color: '#F6465D', fontSize: 13, fontWeight: '600' }}>
                {formatPercent(topLoser.change24h)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Top activos ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textP }]}>Top Activos</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/(tickers)/tickers')}>
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.listCard, { backgroundColor: surface, borderColor: border }]}>
            {tickers.slice(0, 5).map(t => (
              <TickerCard
                key={t.id}
                ticker={t}
                onPress={() => router.push(`/(app)/(tickers)/${t.symbol}` as any)}
              />
            ))}
          </View>
        </View>

        {/* ── Noticias ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textP }]}>Noticias</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/(news)/news')}>
              <Text style={styles.sectionLink}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {news.slice(0, 3).map(n => (
            <NewsCard
              key={n._id}
              news={n}
              onPress={() => router.push(`/(app)/(news)/${n._id}` as any)}
            />
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  portfolioSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  portfolioLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  portfolioValue: { fontSize: 36, fontWeight: '700', marginBottom: 4 },
  portfolioDelta: { fontSize: 15, fontWeight: '500' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 12 },
  statSym:   { fontSize: 16, fontWeight: '700' },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionLink:  { fontSize: 14, color: '#00b4d8', fontWeight: '600' },

  listCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
})
