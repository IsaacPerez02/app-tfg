import { View, StyleSheet, FlatList, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAIRecommendations } from '@/hooks/use-ai-recommendations'
import { AIRecommendationCard } from '@/components/cards/AIRecommendationCard'

type Filter = 'ALL' | 'BUY' | 'SELL' | 'HOLD'

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'Todas',    value: 'ALL'  },
  { label: 'Comprar',  value: 'BUY'  },
  { label: 'Vender',   value: 'SELL' },
  { label: 'Mantener', value: 'HOLD' },
]

const FILTER_COLOR: Record<Filter, string> = {
  ALL:  '#00b4d8',
  BUY:  '#05B169',
  SELL: '#F6465D',
  HOLD: '#F0B90B',
}

export default function PredictionsScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const [filter, setFilter] = useState<Filter>('ALL')

  const { recommendations } = useAIRecommendations(
    filter === 'ALL' ? undefined : (filter as 'BUY' | 'SELL' | 'HOLD')
  )

  const bg      = isDark ? '#000000' : '#F7F8FA'
  const textP   = isDark ? '#FFFFFF' : '#000000'
  const textS   = isDark ? '#8E8E93' : '#6D6D72'
  const border  = isDark ? '#1C1C1E' : '#E8E8E8'
  const inactiveBg = isDark ? '#1C1C1E' : '#EFEFEF'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      <View style={[styles.header, { borderBottomColor: border }]}>
        <Text style={[styles.title, { color: textP }]}>IA Insights</Text>
        <Text style={[styles.subtitle, { color: textS }]}>
          Ordenado por confianza
        </Text>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.value
          const color  = FILTER_COLOR[f.value]
          return (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[
                styles.pill,
                { backgroundColor: active ? color : inactiveBg, flex: 1 }
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.pillText,
                { color: active ? '#FFFFFF' : textS }
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={recommendations}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <AIRecommendationCard
            recommendation={item}
            onPress={() => router.push(`/(app)/(predictions)/${item.id}` as any)}
          />
        )}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: textS }}>Sin señales para este filtro</Text>
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
    marginBottom: 4,
  },
  title:    { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  pill: {
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', marginTop: 60 },
})
