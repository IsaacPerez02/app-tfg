import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { TickerCardPro } from '@/components/cards/TickedCardPro'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_URL = process.env.EXPO_PUBLIC_API

interface Ticker {
  _id: string
  symbol: string
  name: string
  price: number
  change: number
  changeAbs: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap: number
}

type PerformanceFilter = 'all' | 'winners' | 'losers' | 'followed'
type SortOption =
  | 'default'
  | 'change_desc'
  | 'change_asc'
  | 'marketcap_desc'
  | 'volume_desc'
  | 'az'
  | 'za'

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'default',       label: 'Por defecto',           icon: 'format-list-bulleted' },
  { key: 'change_desc',   label: 'Mayor subida %',         icon: 'trending-up' },
  { key: 'change_asc',    label: 'Mayor bajada %',         icon: 'trending-down' },
  { key: 'marketcap_desc',label: 'Mayor capitalización',   icon: 'bank-outline' },
  { key: 'volume_desc',   label: 'Mayor volumen',          icon: 'chart-bar' },
  { key: 'az',            label: 'A → Z',                  icon: 'sort-alphabetical-ascending' },
  { key: 'za',            label: 'Z → A',                  icon: 'sort-alphabetical-descending' },
]

const PERF_CHIPS: {
  key: PerformanceFilter
  label: string
  icon: string
  color: string
}[] = [
  { key: 'all',      label: 'Todos',       icon: 'view-grid-outline', color: '#0066FF' },
  { key: 'winners',  label: 'Ganadores',   icon: 'trending-up',       color: '#00CC66' },
  { key: 'losers',   label: 'Perdedores',  icon: 'trending-down',     color: '#FF3333' },
  { key: 'followed', label: 'Seguidos',    icon: 'star',              color: '#FFD700' },
]

export default function TickersScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'

  // ─── Data ───────────────────────────────────────────────────────────────────
  const [tickers,    setTickers]    = useState<Ticker[]>([])
  const [followedIds,setFollowedIds]= useState<Set<string>>(new Set())
  const [userId,     setUserId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ─── Filters ─────────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('')
  const [perfFilter,    setPerfFilter]    = useState<PerformanceFilter>('all')
  const [sortOption,    setSortOption]    = useState<SortOption>('default')
  const [showSortModal, setShowSortModal] = useState(false)
  const [showRange,     setShowRange]     = useState(false)
  const [minChange,     setMinChange]     = useState('')
  const [maxChange,     setMaxChange]     = useState('')

  // ─── Theme ───────────────────────────────────────────────────────────────────
  const bgMain      = isDark ? '#000000' : '#F7F8FA'
  const bgSurface   = isDark ? '#1F1F1F' : '#FFFFFF'
  const bgModal     = isDark ? '#1C1C1E' : '#FFFFFF'
  const textPrimary = isDark ? '#FFFFFF' : '#000000'
  const textSec     = isDark ? '#8E8E93' : '#6D6D72'
  const inputBg     = isDark ? '#2A2A2E' : '#EFEFEF'
  const placeholder = isDark ? '#636366' : '#8E8E93'
  const borderColor = isDark ? '#2A2A2E' : '#E5E5EA'

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => {
      if (id) {
        let cleanId = id
        if (cleanId.startsWith('"') && cleanId.endsWith('"')) {
          cleanId = cleanId.slice(1, -1)
        }
        setUserId(cleanId)
      }
    })
  }, [])

  const fetchTickers = async () => {
    try {
      setError(null)
      const res  = await fetch(`${API_URL}/tickers`)
      const json = await res.json()
      if (json.success && json.tickers) setTickers(json.tickers)
    } catch (err) {
      console.error(err)
      setError('Error cargando activos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchFollowedIds = async (uid: string) => {
    try {
      const res  = await fetch(`${API_URL}/followTickets/all/${uid}`)
      const json = await res.json()
      if (Array.isArray(json)) {
        setFollowedIds(new Set(json.map((f: any) => String(f.ticketId))))
      }
    } catch (err) {
      console.error('Error fetching follows:', err)
    }
  }

  useEffect(() => {
    fetchTickers()
    const interval = setInterval(fetchTickers, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (userId) fetchFollowedIds(userId)
  }, [userId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchTickers()
    if (userId) fetchFollowedIds(userId)
  }

  const toggleFollow = async (ticketId: string) => {
    if (!userId) return
    const isFollowing = followedIds.has(ticketId)
    
    // UI update optimista
    const newFollowed = new Set(followedIds)
    if (isFollowing) {
      newFollowed.delete(ticketId)
    } else {
      newFollowed.add(ticketId)
    }
    setFollowedIds(newFollowed)

    try {
      if (isFollowing) {
        await fetch(`${API_URL}/followTickets/unfollow`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ticketId })
        })
      } else {
        await fetch(`${API_URL}/followTickets/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ticketId })
        })
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
      fetchFollowedIds(userId) // revert
    }
  }

  const resetAllFilters = () => {
    setSearch('')
    setPerfFilter('all')
    setSortOption('default')
    setMinChange('')
    setMaxChange('')
    setShowRange(false)
  }

  // ─── Filtering + Sorting pipeline ────────────────────────────────────────────
  const processed = (() => {
    let list = [...tickers]

    // 1. Search
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter(
        t => t.symbol.includes(q) || t.name.toUpperCase().includes(q)
      )
    }

    // 2. Performance filter
    switch (perfFilter) {
      case 'winners':  list = list.filter(t => t.change > 0);  break
      case 'losers':   list = list.filter(t => t.change < 0);  break
      case 'followed': list = list.filter(t => followedIds.has(String(t._id))); break
    }

    // 3. Range filter (% change)
    const minVal = parseFloat(minChange)
    const maxVal = parseFloat(maxChange)
    if (!isNaN(minVal)) list = list.filter(t => t.change >= minVal)
    if (!isNaN(maxVal)) list = list.filter(t => t.change <= maxVal)

    // 4. Sort
    switch (sortOption) {
      case 'change_desc':    list.sort((a, b) => b.change - a.change);                   break
      case 'change_asc':     list.sort((a, b) => a.change - b.change);                   break
      case 'marketcap_desc': list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)); break
      case 'volume_desc':    list.sort((a, b) => (b.volume || 0) - (a.volume || 0));     break
      case 'az':             list.sort((a, b) => a.symbol.localeCompare(b.symbol));      break
      case 'za':             list.sort((a, b) => b.symbol.localeCompare(a.symbol));      break
    }

    return list
  })()

  const activeFiltersCount = [
    perfFilter !== 'all',
    sortOption !== 'default',
    minChange !== '' || maxChange !== '',
    search.trim() !== '',
  ].filter(Boolean).length

  const currentSort = SORT_OPTIONS.find(s => s.key === sortOption)

  // ─── Loading State ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bgMain }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066FF" />
          <Text style={[styles.loadingText, { color: textSec }]}>Cargando activos...</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgMain }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: bgSurface, borderBottomColor: borderColor }]}>
        <View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Activos</Text>
          <Text style={[styles.headerSubtitle, { color: textSec }]}>
            {processed.length} de {tickers.length} activos
          </Text>
        </View>
        <View style={styles.headerRight}>
          {activeFiltersCount > 0 ? (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{activeFiltersCount}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={handleRefresh} style={styles.iconBtn}>
            <MaterialCommunityIcons name="refresh" size={22} color="#0066FF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={placeholder} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: textPrimary }]}
          placeholder="Buscar símbolo o nombre..."
          placeholderTextColor={placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={20} color={placeholder} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Performance Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {PERF_CHIPS.map(chip => {
          const active = perfFilter === chip.key
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setPerfFilter(chip.key)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: chip.color, borderColor: chip.color }
                  : { backgroundColor: inputBg, borderColor: borderColor },
              ]}
            >
              <MaterialCommunityIcons
                name={chip.icon as any}
                size={14}
                color={chip.key === 'followed' && active ? '#FFFFFF' : chip.key === 'followed' ? '#FFD700' : active ? '#FFFFFF' : textSec}
              />
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : textSec }]}>
                {chip.label}
              </Text>
              {(chip.key === 'followed' && followedIds.size > 0) ? (
                <View style={[styles.chipCount, { backgroundColor: active ? 'rgba(255,255,255,0.3)' : borderColor }]}>
                  <Text style={[styles.chipCountText, { color: active ? '#FFFFFF' : textSec }]}>
                    {followedIds.size}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Toolbar: Sort + Range + Clear ── */}
      <View style={[styles.toolbar, { borderBottomColor: borderColor }]}>
        {/* Sort button */}
        <TouchableOpacity
          style={[
            styles.toolbarBtn,
            { backgroundColor: sortOption !== 'default' ? '#0066FF18' : inputBg },
          ]}
          onPress={() => setShowSortModal(true)}
        >
          <MaterialCommunityIcons
            name="sort"
            size={15}
            color={sortOption !== 'default' ? '#0066FF' : textSec}
          />
          <Text
            style={[styles.toolbarBtnText, { color: sortOption !== 'default' ? '#0066FF' : textSec }]}
            numberOfLines={1}
          >
            {sortOption !== 'default' ? currentSort?.label : 'Ordenar'}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={13}
            color={sortOption !== 'default' ? '#0066FF' : textSec}
          />
        </TouchableOpacity>

        {/* Range button */}
        <TouchableOpacity
          style={[
            styles.toolbarBtn,
            { backgroundColor: (minChange || maxChange) ? '#0066FF18' : inputBg },
          ]}
          onPress={() => setShowRange(v => !v)}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={15}
            color={(minChange || maxChange) ? '#0066FF' : textSec}
          />
          <Text style={[styles.toolbarBtnText, { color: (minChange || maxChange) ? '#0066FF' : textSec }]}>
            {minChange || maxChange
              ? `${minChange || '−∞'}% → ${maxChange || '+∞'}%`
              : 'Rango %'}
          </Text>
          {(minChange || maxChange) ? (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => { setMinChange(''); setMaxChange('') }}
            >
              <MaterialCommunityIcons name="close-circle" size={14} color="#0066FF" />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>

        {/* Clear all */}
        {activeFiltersCount > 0 ? (
          <TouchableOpacity
            style={[styles.toolbarBtnSmall, { backgroundColor: '#FF333318' }]}
            onPress={resetAllFilters}
          >
            <MaterialCommunityIcons name="close" size={15} color="#FF3333" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Range Panel ── */}
      {showRange ? (
        <View style={[styles.rangePanel, { backgroundColor: bgSurface, borderBottomColor: borderColor }]}>
          <Text style={[styles.rangePanelTitle, { color: textSec }]}>
            Filtrar por cambio % del día
          </Text>
          <View style={styles.rangeRow}>
            <View style={[styles.rangeField, { backgroundColor: inputBg }]}>
              <Text style={[styles.rangeFieldLabel, { color: textSec }]}>Mínimo %</Text>
              <TextInput
                style={[styles.rangeFieldInput, { color: textPrimary }]}
                placeholder="-100"
                placeholderTextColor={placeholder}
                value={minChange}
                onChangeText={setMinChange}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={[styles.rangeDash, { backgroundColor: borderColor }]} />
            <View style={[styles.rangeField, { backgroundColor: inputBg }]}>
              <Text style={[styles.rangeFieldLabel, { color: textSec }]}>Máximo %</Text>
              <TextInput
                style={[styles.rangeFieldInput, { color: textPrimary }]}
                placeholder="100"
                placeholderTextColor={placeholder}
                value={maxChange}
                onChangeText={setMaxChange}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* ── Error Banner ── */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.errorAction}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Tickers List ── */}
      <FlatList
        data={processed}
        keyExtractor={t => t._id}
        renderItem={({ item }) => (
          <TickerCardPro
            symbol={item.symbol}
            name={item.name}
            price={item.price}
            change={item.change}
            changeAbs={item.changeAbs}
            dayHigh={item.dayHigh}
            dayLow={item.dayLow}
            volume={item.volume}
            marketCap={item.marketCap}
            isFollowed={followedIds.has(String(item._id))}
            onToggleFollow={() => toggleFollow(String(item._id))}
            onPress={() => router.push({ pathname: '/(app)/(tickers)/[id]', params: { id: item._id, symbol: item.symbol } })}
          />
        )}
        style={{ backgroundColor: bgMain }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0066FF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={perfFilter === 'followed' ? 'star-off-outline' : 'filter-remove-outline'}
              size={56}
              color={textSec}
            />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
              {perfFilter === 'followed' ? 'Sin seguidos' : 'Sin resultados'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: textSec }]}>
              {perfFilter === 'followed'
                ? 'Sigue activos para verlos aquí'
                : 'Prueba con otros filtros o búsqueda'}
            </Text>
            {activeFiltersCount > 0 ? (
              <TouchableOpacity style={styles.emptyReset} onPress={resetAllFilters}>
                <Text style={styles.emptyResetText}>Limpiar filtros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      {/* ── Sort Modal ── */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: bgModal }]}>
            <View style={[styles.modalHandle, { backgroundColor: borderColor }]} />
            <Text style={[styles.modalTitle, { color: textPrimary }]}>Ordenar por</Text>

            {SORT_OPTIONS.map((opt, i) => {
              const active = sortOption === opt.key
              const isLast = i === SORT_OPTIONS.length - 1
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.sortRow,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                  ]}
                  onPress={() => { setSortOption(opt.key); setShowSortModal(false) }}
                >
                  <View style={[styles.sortIconWrap, { backgroundColor: active ? '#0066FF' : inputBg }]}>
                    <MaterialCommunityIcons
                      name={opt.icon as any}
                      size={17}
                      color={active ? '#FFFFFF' : textSec}
                    />
                  </View>
                  <Text style={[styles.sortRowLabel, { color: active ? '#0066FF' : textPrimary }]}>
                    {opt.label}
                  </Text>
                  {active ? (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#0066FF" />
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    minWidth: 20, height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  activeBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // ── Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '400' },

  // ── Chips
  chipsScroll: { flexGrow: 0, marginTop: 10, minHeight: 45, maxHeight: 45 },
  chipsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 10, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipCount: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chipCountText: { fontSize: 10, fontWeight: '700' },

  // ── Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    flex: 1,
    maxWidth: 200,
  },
  toolbarBtnText: { fontSize: 13, fontWeight: '500', flex: 1 },
  toolbarBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Range Panel
  rangePanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangePanelTitle: { fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeField: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rangeFieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  rangeFieldInput: { fontSize: 16, fontWeight: '600' },
  rangeDash: { width: 20, height: 2, borderRadius: 1 },

  // ── Error
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF3333',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorText:   { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  errorAction: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  // ── List
  listContent: { paddingVertical: 8, paddingBottom: 110 },

  // ── Empty
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  emptySubtitle:  { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyReset: {
    marginTop: 20,
    backgroundColor: '#0066FF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyResetText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  // ── Loading
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:     { marginTop: 12, fontSize: 16, fontWeight: '500' },

  // ── Sort Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHandle: {
    width: 38, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
  },
  sortIconWrap: {
    width: 36, height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortRowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
})