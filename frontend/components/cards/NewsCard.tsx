import { StyleSheet, TouchableOpacity, View, Text } from 'react-native'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { timeAgo } from '@/utils/formatters'
import { BackendNews, parseSentiment } from '@/types'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface NewsCardProps {
  news: BackendNews
  onPress?: () => void
}

export function NewsCard({ news, onPress }: NewsCardProps) {
  const isDark = useColorScheme() === 'dark'

  const textP    = isDark ? '#FFFFFF' : '#000000'
  const textS    = isDark ? '#8E8E93' : '#6D6D72'
  const cardBg   = isDark ? '#111111' : '#FFFFFF'
  const border   = isDark ? '#1C1C1E' : '#F0F0F0'
  const tagBg    = isDark ? '#1C1C1E' : '#F5F5F5'

  const sent          = parseSentiment(news.sentiment)
  const importancePct = Math.round(news.importance_score * 100)

  const sentIcon = sent.key === 'positive'
    ? 'trending-up' : sent.key === 'negative'
    ? 'trending-down' : 'minus'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
    >
      {/* Barra de sentimiento lateral */}
      <View style={[styles.sentBar, { backgroundColor: sent.color }]} />

      <View style={styles.body}>

        {/* Fuente + tiempo */}
        <View style={styles.row}>
          <Text style={[styles.source, { color: sent.color }]} numberOfLines={1}>
            {news.source}
          </Text>
          <View style={styles.rowEnd}>
            <MaterialCommunityIcons name={sentIcon as any} size={12} color={sent.color} />
            <Text style={[styles.time, { color: textS }]}>
              {timeAgo(news.date)}
            </Text>
          </View>
        </View>

        {/* Título */}
        <Text style={[styles.title, { color: textP }]} numberOfLines={2}>
          {news.title}
        </Text>

        {/* Resumen (summary del backend) */}
        <Text style={[styles.summary, { color: textS }]} numberOfLines={2}>
          {news.summary}
        </Text>

        {/* Tickers */}
        {news.tickers.length > 0 && (
          <View style={styles.chips}>
            {news.tickers.slice(0, 4).map(t => (
              <View key={t} style={[styles.chip, { backgroundColor: '#00b4d8' + '18' }]}>
                <Text style={[styles.chipText, { color: '#00b4d8' }]}>{t}</Text>
              </View>
            ))}
            {news.tickers.length > 4 && (
              <Text style={[styles.chipMore, { color: textS }]}>+{news.tickers.length - 4}</Text>
            )}
          </View>
        )}

        {/* Barra de importancia */}
        {importancePct > 0 && (
          <View style={styles.importanceRow}>
            <View style={[styles.track, { backgroundColor: tagBg }]}>
              <View style={[styles.fill, {
                width: `${importancePct}%` as any,
                backgroundColor: sent.color,
              }]} />
            </View>
            <Text style={[styles.importancePct, { color: textS }]}>
              {importancePct}%
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sentBar: { width: 4 },
  body: { flex: 1, padding: 14, gap: 7 },

  row:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: { fontSize: 12, fontWeight: '700', flex: 1 },
  time:   { fontSize: 11 },

  title:   { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  summary: { fontSize: 13, lineHeight: 18 },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  chip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipMore: { fontSize: 11, fontWeight: '600' },

  importanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: 3, borderRadius: 2 },
  importancePct: { fontSize: 10, fontWeight: '600', width: 28, textAlign: 'right' },
})
