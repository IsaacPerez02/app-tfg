import { StyleSheet, TouchableOpacity, View, Text } from 'react-native'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { timeAgo } from '@/utils/formatters'
import { BackendSentimentNews, parseSentimentResult } from '@/types'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface SentimentCardProps {
  article: BackendSentimentNews
  onPress?: () => void
}

export function SentimentCard({ article, onPress }: SentimentCardProps) {
  const isDark = useColorScheme() === 'dark'

  const textP  = isDark ? '#FFFFFF' : '#000000'
  const textS  = isDark ? '#8E8E93' : '#6D6D72'
  const cardBg = isDark ? '#111111' : '#FFFFFF'
  const border = isDark ? '#1C1C1E' : '#F0F0F0'
  const tagBg  = isDark ? '#1C1C1E' : '#F5F5F5'

  const sent          = parseSentimentResult(article.sentiment)
  const confidencePct = Math.round(article.sentiment.score * 100)
  const sentIcon      = sent.key === 'positive' ? 'trending-up'
                      : sent.key === 'negative' ? 'trending-down'
                      : 'minus'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
    >
      {/* Barra lateral de sentimiento */}
      <View style={[styles.sentBar, { backgroundColor: sent.color }]} />

      <View style={styles.body}>

        {/* Fuente + tiempo */}
        <View style={styles.row}>
          <Text style={[styles.source, { color: sent.color }]} numberOfLines={1}>
            {article.source}
          </Text>
          <View style={styles.rowEnd}>
            <MaterialCommunityIcons name={sentIcon as any} size={12} color={sent.color} />
            <Text style={[styles.time, { color: textS }]}>
              {timeAgo(article.date)}
            </Text>
          </View>
        </View>

        {/* Título */}
        <Text style={[styles.title, { color: textP }]} numberOfLines={2}>
          {article.title}
        </Text>

        {/* Resumen */}
        <Text style={[styles.summary, { color: textS }]} numberOfLines={2}>
          {article.summary}
        </Text>

        {/* Tickers */}
        {article.tickers.length > 0 && (
          <View style={styles.chips}>
            {article.tickers.slice(0, 4).map(t => (
              <View key={t} style={[styles.chip, { backgroundColor: '#00b4d8' + '18' }]}>
                <Text style={[styles.chipText, { color: '#00b4d8' }]}>{t}</Text>
              </View>
            ))}
            {article.tickers.length > 4 && (
              <Text style={[styles.chipMore, { color: textS }]}>+{article.tickers.length - 4}</Text>
            )}
          </View>
        )}

        {/* Sentimiento badge + barra de confianza */}
        <View style={styles.sentRow}>
          {/* Badge */}
          <View style={[styles.badge, { backgroundColor: sent.color + '22' }]}>
            <MaterialCommunityIcons name={sentIcon as any} size={11} color={sent.color} />
            <Text style={[styles.badgeText, { color: sent.color }]}>{sent.label}</Text>
          </View>

          {/* Barra de confianza */}
          <View style={styles.confRow}>
            <View style={[styles.confTrack, { backgroundColor: tagBg }]}>
              <View style={[styles.confFill, {
                width: `${confidencePct}%` as any,
                backgroundColor: sent.color,
              }]} />
            </View>
            <Text style={[styles.confPct, { color: textS }]}>{confidencePct}%</Text>
          </View>

          {/* Model tag */}
          <View style={[styles.modelTag, { backgroundColor: tagBg }]}>
            <Text style={[styles.modelText, { color: textS }]}>{article.sentiment.model}</Text>
          </View>
        </View>

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

  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  confRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  confTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  confFill:  { height: 3, borderRadius: 2 },
  confPct:   { fontSize: 10, fontWeight: '600', width: 28, textAlign: 'right' },

  modelTag:  { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  modelText: { fontSize: 10, fontWeight: '500' },
})
