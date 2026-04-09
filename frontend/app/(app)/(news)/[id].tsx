import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MOCK_NEWS } from '@/utils/mock-data'
import { timeAgo } from '@/utils/formatters'

const SENTIMENT_COLOR = {
  positive: '#05B169',
  neutral:  '#F0B90B',
  negative: '#F6465D',
}

const SENTIMENT_LABEL = {
  positive: 'Positivo',
  neutral:  'Neutral',
  negative: 'Negativo',
}

const CATEGORY_LABEL: Record<string, string> = {
  crypto:  'Crypto',
  forex:   'Forex',
  stocks:  'Stocks',
  economy: 'Economía',
  general: 'General',
}

export default function NewsDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const isDark  = useColorScheme() === 'dark'

  const news = MOCK_NEWS.find(n => n.id === id)

  const bg      = isDark ? '#000000' : '#F7F8FA'
  const surface = isDark ? '#111111' : '#FFFFFF'
  const textP   = isDark ? '#FFFFFF' : '#000000'
  const textS   = isDark ? '#8E8E93' : '#6D6D72'
  const border  = isDark ? '#1C1C1E' : '#E8E8E8'

  if (!news) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={{ color: textS, fontSize: 16 }}>Noticia no encontrada</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Text style={{ color: '#00b4d8', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const sentColor = SENTIMENT_COLOR[news.sentiment]
  const sentLabel = SENTIMENT_LABEL[news.sentiment]
  const catLabel  = CATEGORY_LABEL[news.category] ?? news.category

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={{ color: '#00b4d8', fontSize: 16 }}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: textP }]}>Noticia</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Article card */}
        <View style={[styles.articleCard, { backgroundColor: surface, borderColor: border }]}>

          {/* Badges */}
          <View style={styles.badges}>
            <View style={[styles.catBadge, { backgroundColor: '#00b4d8' + '20' }]}>
              <Text style={[styles.badgeText, { color: '#00b4d8' }]}>{catLabel}</Text>
            </View>
            <View style={[styles.catBadge, { backgroundColor: sentColor + '20' }]}>
              <View style={[styles.sentDot, { backgroundColor: sentColor }]} />
              <Text style={[styles.badgeText, { color: sentColor }]}>{sentLabel}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textP }]}>{news.title}</Text>

          {/* Meta */}
          <View style={styles.meta}>
            <Text style={[styles.source, { color: '#00b4d8' }]}>{news.source}</Text>
            <Text style={[styles.time,   { color: textS }]}>
              {timeAgo(new Date(news.timestamp))}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: border }]} />

          {/* Description */}
          <Text style={[styles.description, { color: textP }]}>{news.description}</Text>

          {/* Content */}
          <Text style={[styles.content, { color: textS }]}>{news.content}</Text>

          {/* Related tickers */}
          {news.relatedTickers && news.relatedTickers.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={[styles.relatedLabel, { color: textS }]}>Activos relacionados</Text>
              <View style={styles.relatedTickers}>
                {news.relatedTickers.map(t => (
                  <View key={t} style={[styles.tickerChip, { backgroundColor: '#00b4d8' + '15' }]}>
                    <Text style={{ color: '#00b4d8', fontWeight: '700', fontSize: 13 }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
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

  articleCard: {
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },

  badges: { flexDirection: 'row', gap: 8 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  sentDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  title: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },

  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  source: { fontSize: 14, fontWeight: '600' },
  time:   { fontSize: 13 },

  divider: { height: StyleSheet.hairlineWidth },

  description: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  content: {
    fontSize: 15,
    lineHeight: 23,
  },

  relatedSection: { gap: 10 },
  relatedLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  relatedTickers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
})
