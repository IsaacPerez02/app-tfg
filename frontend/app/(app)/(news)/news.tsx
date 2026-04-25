import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useNewsFeed } from '@/hooks/use-news-data'
import { NewsCard } from '@/components/cards/NewsCard'
import { NewsFeedMode } from '@/types'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const MODES: { label: string; value: NewsFeedMode; icon: string }[] = [
  { label: 'Recientes',  value: 'latest', icon: 'clock-outline' },
  { label: 'Destacadas', value: 'top',    icon: 'fire'          },
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ isDark }: { isDark: boolean }) {
  const bg     = isDark ? '#1C1C1E' : '#E8E8E8'
  const cardBg = isDark ? '#111111' : '#FFFFFF'
  const border = isDark ? '#1C1C1E' : '#F0F0F0'
  return (
    <View style={[skStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[skStyles.bar, { backgroundColor: bg }]} />
      <View style={skStyles.body}>
        {([['35%', 10], ['92%', 14], ['75%', 14], ['55%', 11]] as const).map(([w, h], i) => (
          <View key={i} style={{ width: w, height: h, borderRadius: 5, backgroundColor: bg }} />
        ))}
      </View>
    </View>
  )
}

const skStyles = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, overflow: 'hidden', height: 115 },
  bar:  { width: 4 },
  body: { flex: 1, padding: 14, gap: 11, justifyContent: 'center' },
})

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NewsScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'

  const {
    news, loading, loadingMore, error,
    hasMore, refresh, loadMore, mode, setMode,
  } = useNewsFeed('latest')

  const bg         = isDark ? '#000000' : '#F7F8FA'
  const textP      = isDark ? '#FFFFFF' : '#000000'
  const textS      = isDark ? '#8E8E93' : '#6D6D72'
  const border     = isDark ? '#1C1C1E' : '#E8E8E8'
  const inactiveBg = isDark ? '#1C1C1E' : '#EFEFEF'
  const surface    = isDark ? '#111111' : '#FFFFFF'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: border }]}>
        <View>
          <Text style={[styles.title, { color: textP }]}>Noticias</Text>
          <Text style={[styles.subtitle, { color: textS }]}>
            {loading ? 'Cargando...' : `${news.length} artículos`}
          </Text>
        </View>
        <TouchableOpacity onPress={refresh} style={styles.iconBtn} disabled={loading}>
          <MaterialCommunityIcons name="refresh" size={22} color="#00b4d8" />
        </TouchableOpacity>
      </View>

      {/* Toggle modo */}
      <View style={[styles.modeRow, { borderBottomColor: border }]}>
        {MODES.map(m => {
          const active = mode === m.value
          return (
            <TouchableOpacity
              key={m.value}
              onPress={() => setMode(m.value)}
              style={[styles.modeBtn, { backgroundColor: active ? '#00b4d8' : inactiveBg }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={m.icon as any} size={14} color={active ? '#FFFFFF' : textS} />
              <Text style={[styles.modeBtnText, { color: active ? '#FFFFFF' : textS }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Error */}
      {error && !loading && (
        <View style={[styles.errorBanner, { backgroundColor: surface, borderColor: border }]}>
          <MaterialCommunityIcons name="wifi-off" size={20} color="#F6465D" />
          <Text style={[styles.errorText, { color: textP }]}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.errorAction}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Skeleton inicial */}
      {loading && (
        <View style={{ flex: 1, paddingTop: 10 }}>
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} isDark={isDark} />)}
        </View>
      )}

      {/* Lista */}
      {!loading && (
        <FlatList
          data={news}
          keyExtractor={n => n._id}
          renderItem={({ item }) => (
            <NewsCard
              news={item}
              onPress={() => router.push(`/(app)/(news)/${item._id}` as any)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Infinite scroll
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          // Footer: spinner mientras carga más / fin de lista
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#00b4d8" style={styles.footer} />
            ) : !hasMore && news.length > 0 ? (
              <Text style={[styles.footerEnd, { color: textS }]}>— Fin del feed —</Text>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor="#00b4d8" />
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="newspaper-variant-outline" size={52} color={textS} />
                <Text style={[styles.emptyTitle, { color: textP }]}>Sin noticias</Text>
                <Text style={[styles.emptySub, { color: textS }]}>
                  No hay artículos disponibles en este momento
                </Text>
              </View>
            ) : null
          }
        />
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title:    { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  iconBtn:  { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },

  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeBtnText: { fontSize: 13, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  errorText:   { flex: 1, fontSize: 14, fontWeight: '500' },
  errorAction: { color: '#00b4d8', fontWeight: '700', fontSize: 13 },

  listContent: { paddingTop: 10, paddingBottom: 100 },

  footer:    { marginVertical: 20 },
  footerEnd: { textAlign: 'center', fontSize: 13, marginVertical: 24 },

  empty:     { alignItems: 'center', marginTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
