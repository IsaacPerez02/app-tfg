import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useNewsDetail } from '@/hooks/use-news-detail'
import { parseSentiment } from '@/types'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { timeAgo } from '@/utils/formatters'

// ── Chips ─────────────────────────────────────────────────────────────────────

function ChipRow({ items, color, bg }: { items: string[]; color: string; bg: string }) {
  if (!items.length) return null
  return (
    <View style={chip.row}>
      {items.map(item => (
        <View key={item} style={[chip.wrap, { backgroundColor: bg }]}>
          <Text style={[chip.text, { color }]}>{item}</Text>
        </View>
      ))}
    </View>
  )
}
const chip = StyleSheet.create({
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wrap: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  text: { fontSize: 12, fontWeight: '700' },
})

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
      {label}
    </Text>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NewsDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const isDark  = useColorScheme() === 'dark'

  const { news, loading, error } = useNewsDetail(id)

  const bg      = isDark ? '#000000' : '#F7F8FA'
  const surface = isDark ? '#111111' : '#FFFFFF'
  const textP   = isDark ? '#FFFFFF' : '#000000'
  const textS   = isDark ? '#8E8E93' : '#6D6D72'
  const border  = isDark ? '#1C1C1E' : '#E8E8E8'
  const tagBg   = isDark ? '#1C1C1E' : '#F0F0F0'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      {/* Barra superior */}
      <View style={[styles.topBar, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#00b4d8" />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: textP }]}>Noticia</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="loading" size={40} color="#00b4d8" />
          <Text style={[styles.nfSub, { color: textS }]}>Cargando...</Text>
        </View>
      )}

      {/* Error / no encontrada */}
      {!loading && error && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="newspaper-remove-outline" size={52} color={textS} />
          <Text style={[styles.nfTitle, { color: textP }]}>Noticia no disponible</Text>
          <Text style={[styles.nfSub, { color: textS }]}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contenido */}
      {!loading && news && (() => {
        const sent          = parseSentiment(news.sentiment)
        const importancePct = Math.round(news.importance_score * 100)
        const sentIcon      = sent.key === 'positive' ? 'trending-up'
                            : sent.key === 'negative' ? 'trending-down'
                            : 'minus'

        return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <View style={[styles.article, { backgroundColor: surface, borderColor: border }]}>

              {/* Badges */}
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: sent.color + '22' }]}>
                  <MaterialCommunityIcons name={sentIcon as any} size={13} color={sent.color} />
                  <Text style={[styles.badgeText, { color: sent.color }]}>{sent.label}</Text>
                </View>
                {importancePct > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#00b4d8' + '22' }]}>
                    <MaterialCommunityIcons name="fire" size={13} color="#00b4d8" />
                    <Text style={[styles.badgeText, { color: '#00b4d8' }]}>
                      {importancePct}% relevancia
                    </Text>
                  </View>
                )}
              </View>

              {/* Título */}
              <Text style={[styles.title, { color: textP }]}>{news.title}</Text>

              {/* Fuente + fecha */}
              <View style={styles.meta}>
                <Text style={[styles.source, { color: '#00b4d8' }]}>{news.source}</Text>
                <Text style={[styles.time, { color: textS }]}>
                  {timeAgo(news.date)}
                </Text>
              </View>

              {/* Barra de importancia */}
              {importancePct > 0 && (
                <View style={[styles.importanceTrack, { backgroundColor: tagBg }]}>
                  <View style={[styles.importanceFill, {
                    width: `${importancePct}%` as any,
                    backgroundColor: sent.color,
                  }]} />
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: border }]} />

              {/* Resumen */}
              {news.summary ? (
                <Text style={[styles.summary, { color: textP }]}>{news.summary}</Text>
              ) : null}

              {/* Texto completo */}
              <Text style={[styles.body, { color: textS }]}>{news.text}</Text>

              {/* Tickers */}
              {news.tickers.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Activos relacionados" color={textS} />
                  <ChipRow items={news.tickers} color="#00b4d8" bg={'#00b4d8' + '18'} />
                </View>
              )}

              {/* Temas */}
              {news.themes.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Temas" color={textS} />
                  <ChipRow items={news.themes} color={textP} bg={tagBg} />
                </View>
              )}

              {/* Personas */}
              {news.persons.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Personas" color={textS} />
                  <ChipRow items={news.persons} color={textP} bg={tagBg} />
                </View>
              )}

              {/* Organizaciones */}
              {news.organizations.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Organizaciones" color={textS} />
                  <ChipRow items={news.organizations} color={textP} bg={tagBg} />
                </View>
              )}

              {/* Enlace original */}
              {news.url ? (
                <TouchableOpacity
                  style={[styles.urlBtn, { borderColor: '#00b4d8' }]}
                  onPress={() => Linking.openURL(news.url)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="open-in-new" size={16} color="#00b4d8" />
                  <Text style={styles.urlText}>Ver artículo original</Text>
                </TouchableOpacity>
              ) : null}

            </View>
          </ScrollView>
        )
      })()}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontSize: 17, fontWeight: '700' },
  iconBtn:  { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  article: {
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },

  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  title:  { fontSize: 22, fontWeight: '700', lineHeight: 30 },

  meta:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  source: { fontSize: 14, fontWeight: '600' },
  time:   { fontSize: 13 },

  importanceTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  importanceFill:  { height: 4, borderRadius: 2 },

  divider: { height: StyleSheet.hairlineWidth },

  summary: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body:    { fontSize: 15, lineHeight: 24 },

  section: { gap: 8 },

  urlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  urlText: { color: '#00b4d8', fontWeight: '700', fontSize: 14 },

  nfTitle:     { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  nfSub:       { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtn:     { backgroundColor: '#00b4d8', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
})
