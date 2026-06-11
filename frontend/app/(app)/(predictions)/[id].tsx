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
import { useSentimentDetail } from '@/hooks/use-sentiment-detail'
import { parseSentimentResult } from '@/types'
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

export default function PredictionDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const isDark  = useColorScheme() === 'dark'

  const { article, loading, error } = useSentimentDetail(id)

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
        <Text style={[styles.topTitle, { color: textP }]}>Análisis</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="loading" size={40} color="#00b4d8" />
          <Text style={[styles.nfSub, { color: textS }]}>Cargando...</Text>
        </View>
      )}

      {/* Error */}
      {!loading && error && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="brain" size={52} color={textS} />
          <Text style={[styles.nfTitle, { color: textP }]}>Análisis no disponible</Text>
          <Text style={[styles.nfSub, { color: textS }]}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contenido */}
      {!loading && article && (() => {
        const sent          = parseSentimentResult(article.sentiment)
        const confidencePct = Math.round(article.sentiment.score * 100)
        const importancePct = Math.round(article.importance_score * 100)
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
                <View style={[styles.badge, { backgroundColor: tagBg }]}>
                  <MaterialCommunityIcons name="chip" size={13} color={textS} />
                  <Text style={[styles.badgeText, { color: textS }]}>{article.sentiment.model}</Text>
                </View>
              </View>

              {/* Título */}
              <Text style={[styles.title, { color: textP }]}>{article.title}</Text>

              {/* Fuente + fecha */}
              <View style={styles.meta}>
                <Text style={[styles.source, { color: '#00b4d8' }]}>{article.source}</Text>
                <Text style={[styles.time, { color: textS }]}>{timeAgo(article.date)}</Text>
              </View>

              {/* Barra de confianza FinBERT */}
              <View style={styles.confSection}>
                <View style={styles.confHeader}>
                  <Text style={[styles.confLabel, { color: textS }]}>Confianza del modelo</Text>
                  <Text style={[styles.confValue, { color: sent.color }]}>{confidencePct}%</Text>
                </View>
                <View style={[styles.confTrack, { backgroundColor: tagBg }]}>
                  <View style={[styles.confFill, {
                    width: `${confidencePct}%` as any,
                    backgroundColor: sent.color,
                  }]} />
                </View>
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

              {article.summary ? (
                <Text style={[styles.summary, { color: textP }]}>{article.summary}</Text>
              ) : null}

              <Text style={[styles.body, { color: textS }]}>{article.text}</Text>

              {article.tickers.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Activos relacionados" color={textS} />
                  <ChipRow items={article.tickers} color="#00b4d8" bg={'#00b4d8' + '18'} />
                </View>
              )}

              {article.themes.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Temas" color={textS} />
                  <ChipRow items={article.themes} color={textP} bg={tagBg} />
                </View>
              )}

              {article.persons.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Personas" color={textS} />
                  <ChipRow items={article.persons} color={textP} bg={tagBg} />
                </View>
              )}

              {article.organizations.length > 0 && (
                <View style={styles.section}>
                  <SectionLabel label="Organizaciones" color={textS} />
                  <ChipRow items={article.organizations} color={textP} bg={tagBg} />
                </View>
              )}

              {article.url ? (
                <TouchableOpacity
                  style={[styles.urlBtn, { borderColor: '#00b4d8' }]}
                  onPress={() => Linking.openURL(article.url)}
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

  confSection: { gap: 6 },
  confHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confLabel:   { fontSize: 12, fontWeight: '500' },
  confValue:   { fontSize: 12, fontWeight: '700' },
  confTrack:   { height: 6, borderRadius: 3, overflow: 'hidden' },
  confFill:    { height: 6, borderRadius: 3 },

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
