import React, { useState, useMemo } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  GestureResponderEvent,
} from 'react-native'
import { useColorScheme } from '@/hooks/use-color-scheme'

interface CandleData {
  date: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandlestickChartProps {
  data: CandleData[]
  sma20?: (number | null)[]
  sma50?: (number | null)[]
  bollingerBands?: {
    upper: (number | null)[]
    middle: (number | null)[]
    lower: (number | null)[]
  }
  height?: number
  showVolume?: boolean
  showIndicators?: boolean
}

export function CandlestickChart({
  data,
  sma20,
  sma50,
  bollingerBands,
  height = 400,
  showVolume = true,
  showIndicators = true
}: CandlestickChartProps) {
  const isDark = useColorScheme() === 'dark'
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const screenWidth = Dimensions.get('window').width - 32
  const candleWidth = Math.max(2, Math.floor(screenWidth / Math.min(data.length, 50)))
  const maxPrice = Math.max(...data.map(d => d.high))
  const minPrice = Math.min(...data.map(d => d.low))
  const priceRange = maxPrice - minPrice
  const maxVolume = Math.max(...data.map(d => d.volume))

  const bgChart = isDark ? '#1F1F1F' : '#FFFFFF'
  const textP = isDark ? '#FFFFFF' : '#000000'
  const textS = isDark ? '#8E8E93' : '#6D6D72'
  const gridColor = isDark ? '#2A2A2E' : '#E5E5EA'
  const upColor = '#00CC66'
  const downColor = '#FF3333'

  // Renderizar velas individuales
  const renderCandles = () => {
    return data.map((candle, idx) => {
      const isUp = candle.close >= candle.open
      const color = isUp ? upColor : downColor

      // Normalizar alturas
      const topY = height * 0.1 // Margen superior
      const bottomY = height * 0.7 // Margen inferior (para volume)
      const chartHeight = bottomY - topY

      const highY = topY + ((maxPrice - candle.high) / priceRange) * chartHeight
      const lowY = topY + ((maxPrice - candle.low) / priceRange) * chartHeight
      const openY = topY + ((maxPrice - candle.open) / priceRange) * chartHeight
      const closeY = topY + ((maxPrice - candle.close) / priceRange) * chartHeight

      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.abs(closeY - openY) || 1
      const wickX = idx * candleWidth + candleWidth / 2

      return (
        <View key={idx} style={{ position: 'absolute' }}>
          {/* Wick (Mecha) */}
          <View
            style={{
              position: 'absolute',
              left: wickX - 0.5,
              top: highY,
              width: 1,
              height: lowY - highY,
              backgroundColor: color,
              opacity: 0.6,
            }}
          />

          {/* Body (Cuerpo) */}
          <View
            style={{
              position: 'absolute',
              left: wickX - candleWidth / 3,
              top: bodyTop,
              width: (candleWidth / 3) * 2,
              height: Math.max(bodyHeight, 1),
              backgroundColor: color,
              borderColor: color,
              borderWidth: 1,
            }}
          />
        </View>
      )
    })
  }

  // Renderizar volumen
  const renderVolume = () => {
    return data.map((candle, idx) => {
      const isUp = candle.close >= candle.open
      const color = isUp ? upColor : downColor
      const volumeHeight = (candle.volume / maxVolume) * 50 // Max 50px
      const volumeX = idx * candleWidth + candleWidth / 2

      return (
        <View
          key={`vol-${idx}`}
          style={{
            position: 'absolute',
            left: volumeX - candleWidth / 3,
            top: height * 0.75 - volumeHeight,
            width: (candleWidth / 3) * 2,
            height: volumeHeight,
            backgroundColor: color,
            opacity: 0.3,
          }}
        />
      )
    })
  }

  // Renderizar SMA 20
  const renderSMA = (smaData: (number | null)[], color: string) => {
    if (!smaData) return null

    const points = smaData
      .map((value, idx) => {
        if (value === null) return null
        const topY = height * 0.1
        const bottomY = height * 0.7
        const chartHeight = bottomY - topY
        const y = topY + ((maxPrice - value) / priceRange) * chartHeight
        const x = idx * candleWidth + candleWidth / 2
        return { x, y }
      })
      .filter(p => p !== null)

    return (
      <svg
        key="sma-path"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: screenWidth,
          height: height * 0.7,
          pointerEvents: 'none',
        }}
      >
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          stroke={color}
          strokeWidth="2"
          fill="none"
          opacity="0.8"
        />
      </svg>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: bgChart }]}>
      {/* Chart Container */}
      <View
        style={[
          styles.chartContainer,
          {
            height: height,
            backgroundColor: bgChart,
            borderColor: gridColor,
          },
        ]}
      >
        {/* Grid Lines */}
        <View style={styles.gridContainer}>
          {[0.25, 0.5, 0.75].map((percent, idx) => (
            <View
              key={`grid-h-${idx}`}
              style={{
                position: 'absolute',
                left: 0,
                top: `${percent * 100}%`,
                right: 0,
                height: 1,
                backgroundColor: gridColor,
              }}
            />
          ))}
        </View>

        {/* Candlesticks */}
        <View style={{ position: 'relative', width: screenWidth, height: height * 0.7 }}>
          {renderCandles()}
          {sma20 && renderSMA(sma20, '#FFA500')}
          {sma50 && renderSMA(sma50, '#0066FF')}
        </View>

        {/* Volume */}
        {showVolume && (
          <View
            style={{
              position: 'relative',
              width: screenWidth,
              height: height * 0.2,
              borderTopWidth: 1,
              borderTopColor: gridColor,
            }}
          >
            {renderVolume()}
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: bgChart }]}>
        <LegendItem label="SMA 20" color="#FFA500" />
        <LegendItem label="SMA 50" color="#0066FF" />
        <LegendItem label="Bullish" color={upColor} />
        <LegendItem label="Bearish" color={downColor} />
      </View>
    </View>
  )
}

function LegendItem({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 0,
    overflow: 'hidden',
  },
  chartContainer: {
    borderWidth: 1,
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    gap: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
})