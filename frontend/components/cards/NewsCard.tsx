import { StyleSheet, TouchableOpacity, View, Text } from 'react-native'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { timeAgo } from '@/utils/formatters'
import { News } from '@/types'

interface NewsCardProps {
  news: News
  onPress?: () => void
}

const SENTIMENT_COLOR = {
  positive: '#05B169',
  neutral:  '#F0B90B',
  negative: '#F6465D',
}

export function NewsCard({ news, onPress }: NewsCardProps) {
  const isDark = useColorScheme() === 'dark'

  const textPrimary   = isDark ? '#FFFFFF' : '#000000'
  const textSecondary = isDark ? '#8E8E93' : '#6D6D72'
  const cardBg        = isDark ? '#111111' : '#FFFFFF'
  const borderColor   = isDark ? '#1C1C1E' : '#F0F0F0'
  const sentColor     = SENTIMENT_COLOR[news.sentiment]

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
    >
      {/* Sentiment dot */}
      <View style={[styles.dot, { backgroundColor: sentColor }]} />

      <View style={styles.body}>
        <Text style={[styles.title, { color: textPrimary }]} numberOfLines={2}>
          {news.title}
        </Text>
        <Text style={[styles.desc, { color: textSecondary }]} numberOfLines={2}>
          {news.description}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.meta, { color: textSecondary }]}>
            {news.source}
          </Text>
          <Text style={[styles.meta, { color: textSecondary }]}>
            {timeAgo(new Date(news.timestamp))}
          </Text>
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
  dot: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  body: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
  },
})
