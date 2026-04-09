import { View, StyleSheet, FlatList, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useNewsData } from '@/hooks/use-news-data'
import { NewsCard } from '@/components/cards/NewsCard'

type NewsCategory = 'all' | 'crypto' | 'forex' | 'stocks' | 'economy' | 'general'

const PILLS: { label: string; value: NewsCategory }[] = [
  { label: 'Todas',    value: 'all'      },
  { label: 'Crypto',   value: 'crypto'   },
  { label: 'Stocks',   value: 'stocks'   },
  { label: 'Economía', value: 'economy'  },
  { label: 'Forex',    value: 'forex'    },
  { label: 'General',  value: 'general'  },
]

export default function NewsScreen() {
  const router  = useRouter()
  const isDark  = useColorScheme() === 'dark'
  const [category, setCategory] = useState<NewsCategory>('all')

  const { news } = useNewsData(category === 'all' ? undefined : category)

  const bg      = isDark ? '#000000' : '#F7F8FA'
  const textP   = isDark ? '#FFFFFF' : '#000000'
  const textS   = isDark ? '#8E8E93' : '#6D6D72'
  const border  = isDark ? '#1C1C1E' : '#E8E8E8'
  const inactivePillBg = isDark ? '#1C1C1E' : '#EFEFEF'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      <View style={[styles.header, { borderBottomColor: border }]}>
        <Text style={[styles.title, { color: textP }]}>Noticias</Text>
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}
        style={styles.pillsScroll}
      >
        {PILLS.map(p => {
          const active = category === p.value
          return (
            <TouchableOpacity
              key={p.value}
              onPress={() => setCategory(p.value)}
              style={[styles.pill, { backgroundColor: active ? '#00b4d8' : inactivePillBg }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, { color: active ? '#FFFFFF' : textS }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* News list */}
      <FlatList
        data={news}
        keyExtractor={n => n.id}
        renderItem={({ item }) => (
          <NewsCard
            news={item}
            onPress={() => router.push(`/(app)/(news)/${item.id}` as any)}
          />
        )}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: textS }}>Sin noticias para esta categoría</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 28, fontWeight: '700' },
  pillsScroll: { flexGrow: 0 },
  pillsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
})
