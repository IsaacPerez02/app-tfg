import React, { useState, useMemo } from 'react'
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { LineChart, BarChart } from 'react-native-chart-kit'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface ChartData {
  date: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface IndicatorData {
  sma20: (number | null)[]
  sma50: (number | null)[]
  sma200: (number | null)[]
  rsi: (number | null)[]
  macd: {
    macdLine: (number | null)[]
    signalLine: (number | null)[]
  }
  bollingerBands: {
    upper: (number | null)[]
    middle: (number | null)[]
    lower: (number | null)[]
  }
}

interface AdvancedChartProps {
  data: ChartData[]
  indicators: IndicatorData
  symbol: string
  price: number
  change: number
}

type Timeframe = '1h' | '4h' | '1d' | '1w' | '1mo'

export function AdvancedChart({
  data,
  indicators,
  symbol,
  price,
  change,
}: AdvancedChartProps) {
  const isDark = useColorScheme() === 'dark'
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1d')
  const [activeIndicator, setActiveIndicator] = useState<'price' | 'rsi' | 'macd'>('price')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const screenWidth = Dimensions.get('window').width - 32

  const bgChart = isDark ? '#1F1F1F' : '#FFFFFF'
  const bgMain = isDark ? '#000000' : '#F7F8FA'
  const textP = isDark ? '#FFFFFF' : '#000000'
  const textS = isDark ? '#8E8E93' : '#6D6D72'
  const upColor = '#00CC66'
  const downColor = '#FF3333'

  const timeframes: { label: string; value: Timeframe }[] = [
    { label: '1H', value: '1h' },
    { label: '4H', value: '4h' },
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1mo' },
  ]

  // Generar datos del gráfico de precios
  const priceChartData = useMemo(() => {
    const closes = data.map(d => d.close)
    const sma20Filtered = indicators.sma20.filter(v => v !== null) as number[]
    const sma50Filtered = indicators.sma50.filter(v => v !== null) as number[]

    const labels = data
      .filter((_, i) => i % Math.ceil(data.length / 10) === 0)
      .map(d => d.date.slice(5)) // MM-DD format

    return {
      labels,
      datasets: [
        {
          data: closes.slice(-50),
          color: () => change >= 0 ? upColor : downColor,
          strokeWidth: 2,
          withDots: false,
        },
        {
          data: sma20Filtered.slice(-50),
          color: () => '#FFA500',
          strokeWidth: 1.5,
          withDots: false,
          withInnerLines: false,
        },
        {
          data: sma50Filtered.slice(-50),
          color: () => '#0066FF',
          strokeWidth: 1.5,
          withDots: false,
          withInnerLines: false,
        },
      ]
    }
  }, [data, indicators, change])

  // Generar datos del gráfico de RSI
  const rsiChartData = useMemo(() => {
    const rsiValues = indicators.rsi.filter(v => v !== null) as number[]

    return {
      labels: [],
      datasets: [
        {
          data: rsiValues.slice(-50),
          color: () => '#7C3AED',
          strokeWidth: 2,
          withDots: false,
        }
      ]
    }
  }, [indicators.rsi])

  // Generar datos del gráfico de volumen
  const volumeChartData = useMemo(() => {
    const volumes = data.map(d => d.volume)
    const colors = data.map(d => d.close >= d.open ? upColor : downColor)

    return {
      labels: [],
      datasets: [
        {
          data: volumes.slice(-50),
          colors: colors.slice(-50),
        }
      ]
    }
  }, [data, upColor, downColor])

  // Stats del hovered candle
  const hoveredCandle = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <View style={[styles.container, { backgroundColor: bgMain }]}>
      {/* Chart Info */}
      <View style={[styles.infoBar, { backgroundColor: bgChart }]}>
        <View>
          <Text style={[styles.infoLabel, { color: textS }]}>
            {symbol}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: textP }]}>
              ${price.toFixed(2)}
            </Text>
            <Text style={[styles.change, { color: change >= 0 ? upColor : downColor }]}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
            </Text>
          </View>
        </View>

        {hoveredCandle && (
          <View style={styles.hoverInfo}>
            <Text style={[styles.hoverLabel, { color: textS }]}>O: ${hoveredCandle.open.toFixed(2)}</Text>
            <Text style={[styles.hoverLabel, { color: textS }]}>H: ${hoveredCandle.high.toFixed(2)}</Text>
            <Text style={[styles.hoverLabel, { color: textS }]}>L: ${hoveredCandle.low.toFixed(2)}</Text>
            <Text style={[styles.hoverLabel, { color: textS }]}>C: ${hoveredCandle.close.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Timeframe Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeframeScroll}
      >
        {timeframes.map(tf => (
          <TouchableOpacity
            key={tf.value}
            onPress={() => setActiveTimeframe(tf.value)}
            style={[
              styles.timeframeBtn,
              {
                backgroundColor: activeTimeframe === tf.value ? '#0066FF' : bgChart,
                borderColor: activeTimeframe === tf.value ? '#0066FF' : '#E5E5EA',
              }
            ]}
          >
            <Text
              style={[
                styles.timeframeText,
                {
                  color: activeTimeframe === tf.value ? '#FFFFFF' : textP,
                  fontWeight: activeTimeframe === tf.value ? '700' : '500',
                }
              ]}
            >
              {tf.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main Chart */}
      <View style={[styles.chartSection, { backgroundColor: bgChart }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: textP }]}>
            {symbol}/USD
          </Text>
          <View style={styles.chartControls}>
            <TouchableOpacity style={styles.controlBtn}>
              <MaterialCommunityIcons name="plus" size={20} color="#0066FF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn}>
              <MaterialCommunityIcons name="minus" size={20} color="#0066FF" />
            </TouchableOpacity>
          </View>
        </View>

        <LineChart
          data={priceChartData}
          width={screenWidth}
          height={280}
          chartConfig={{
            backgroundColor: bgChart,
            backgroundGradientFrom: bgChart,
            backgroundGradientTo: bgChart,
            decimalPlaces: 2,
            color: () => textS,
            labelColor: () => textS,
            style: { borderRadius: 8 },
            propsForDots: { r: '0' }
          }}
          bezier
          onDataPointClick={({ index }) => setHoveredIndex(index)}
        />
      </View>

      {/* Indicator Selector */}
      <View style={styles.indicatorSelector}>
        {(['price', 'rsi', 'macd'] as const).map(indicator => (
          <TouchableOpacity
            key={indicator}
            onPress={() => setActiveIndicator(indicator)}
            style={[
              styles.indicatorBtn,
              {
                backgroundColor: activeIndicator === indicator ? '#0066FF' : bgChart,
                borderColor: activeIndicator === indicator ? '#0066FF' : '#E5E5EA',
              }
            ]}
          >
            <Text
              style={[
                styles.indicatorText,
                {
                  color: activeIndicator === indicator ? '#FFFFFF' : textP,
                  fontWeight: activeIndicator === indicator ? '700' : '500',
                }
              ]}
            >
              {indicator.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Secondary Indicators */}
      {activeIndicator === 'rsi' && (
        <View style={[styles.secondaryChart, { backgroundColor: bgChart }]}>
          <Text style={[styles.secondaryTitle, { color: textP }]}>RSI (14)</Text>
          <LineChart
            data={rsiChartData}
            width={screenWidth}
            height={180}
            chartConfig={{
              backgroundColor: bgChart,
              backgroundGradientFrom: bgChart,
              backgroundGradientTo: bgChart,
              decimalPlaces: 0,
              color: () => textS,
              labelColor: () => textS,
            }}
            bezier
          />
          {/* RSI Reference Lines */}
          <View style={styles.rsiReferences}>
            <Text style={[styles.rsiRef, { color: '#FF3333' }]}>Overbought: 70</Text>
            <Text style={[styles.rsiRef, { color: '#00CC66' }]}>Oversold: 30</Text>
          </View>
        </View>
      )}

      {activeIndicator === 'macd' && (
        <View style={[styles.secondaryChart, { backgroundColor: bgChart }]}>
          <Text style={[styles.secondaryTitle, { color: textP }]}>MACD</Text>
          <LineChart
            data={priceChartData}
            width={screenWidth}
            height={180}
            chartConfig={{
              backgroundColor: bgChart,
              backgroundGradientFrom: bgChart,
              backgroundGradientTo: bgChart,
              decimalPlaces: 0,
              color: () => textS,
              labelColor: () => textS,
            }}
            bezier
          />
        </View>
      )}

      {/* Volume Chart */}
      {activeIndicator === 'price' && (
        <View style={[styles.volumeChart, { backgroundColor: bgChart }]}>
          <Text style={[styles.volumeTitle, { color: textP }]}>Volume</Text>
          {/* Volume visualization aquí */}
        </View>
      )}

      {/* Technical Summary */}
      <View style={[styles.technicalSummary, { backgroundColor: bgChart }]}>
        <TechnicalLevel label="Resistencia" value="$45,890" />
        <TechnicalLevel label="Soporte" value="$43,567" />
        <TechnicalLevel label="Pivot" value="$44,728" />
      </View>
    </View>
  )
}

function TechnicalLevel({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.technicalLevel}>
      <Text style={styles.technicalLabel}>{label}</Text>
      <Text style={styles.technicalValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  hoverInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  hoverLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeframeScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  timeframeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  timeframeText: {
    fontSize: 13,
  },
  chartSection: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  indicatorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  indicatorText: {
    fontSize: 13,
  },
  secondaryChart: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  rsiReferences: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 16,
  },
  rsiRef: {
    fontSize: 12,
    fontWeight: '600',
  },
  volumeChart: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
    height: 140,
  },
  volumeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  technicalSummary: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  technicalLevel: {
    alignItems: 'center',
  },
  technicalLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.7,
  },
  technicalValue: {
    fontSize: 14,
    fontWeight: '700',
  },
})