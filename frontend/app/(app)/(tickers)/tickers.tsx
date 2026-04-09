import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { TickerCardPro } from '@/components/cards/TickedCardPro'

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

export default function TickersScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'

  const [search, setSearch] = useState('')
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bgMain = isDark ? '#000000' : '#F7F8FA'
  const bgSurface = isDark ? '#1F1F1F' : '#FFFFFF'
  const textPrimary = isDark ? '#FFFFFF' : '#000000'
  const textSecondary = isDark ? '#8E8E93' : '#6D6D72'
  const inputBg = isDark ? '#2A2A2E' : '#EFEFEF'
  const placeholder = isDark ? '#636366' : '#8E8E93'

  const fetchTickers = async () => {
    try {
      setError(null)
      const res = await fetch(API_URL + '/tickers')
      const json = await res.json()

      if (json.success && json.tickers) {
        setTickers(json.tickers)
      }
    } catch (err) {
      console.error(err)
      setError('Error cargando tickers')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTickers()
    const interval = setInterval(fetchTickers, 30000) // Cada 30 segundos
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchTickers()
  }

  const filtered = tickers.filter(t => {
    const q = search.toUpperCase()
    if (!q) return true
    return t.symbol.includes(q) || t.name.toUpperCase().includes(q)
  })

  const onPressTicker = (id: string, symbol: string) => {
    router.push({
      pathname: '/(app)/(tickers)/[id]',
      params: { id, symbol }
    })
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bgMain }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066FF" />
          <Text style={[styles.loadingText, { color: textSecondary }]}>
            Cargando tickers...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgMain }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: bgSurface }]}>
        <View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>
            Activos
          </Text>
          <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
            {filtered.length} activos
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
          <MaterialCommunityIcons
            name="refresh"
            size={24}
            color="#0066FF"
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={placeholder}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: textPrimary }]}
          placeholder="Buscar símbolo o nombre..."
          placeholderTextColor={placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons
              name="close-circle"
              size={20}
              color={placeholder}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error State */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: '#FF3333' }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.errorAction}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tickers List */}
      <FlatList
        data={filtered}
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
            onPress={() => onPressTicker(item._id, item.symbol)}
          />
        )}
        style={[styles.list, { backgroundColor: bgMain }]}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0066FF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="magnify"
              size={48}
              color={textSecondary}
            />
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Sin resultados
            </Text>
          </View>
        }
      />
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  errorAction: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  list: { flex: 1 },
  listContent: {
    paddingVertical: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
})