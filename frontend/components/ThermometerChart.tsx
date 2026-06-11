import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ThermometerValue } from '@/types'

interface ThermometerChartProps {
  data: ThermometerValue[]
  isDark: boolean
}

type Period = '1M' | '3M' | '6M' | '1Y' | 'MAX'

export function ThermometerChart({ data, isDark }: ThermometerChartProps) {
  const [period, setPeriod] = useState<Period>('3M')

  const PERIODS: { label: string; value: Period; days: number }[] = [
    { label: '1M', value: '1M', days: 30 },
    { label: '3M', value: '3M', days: 90 },
    { label: '6M', value: '6M', days: 180 },
    { label: '1Y', value: '1Y', days: 365 },
    { label: 'MAX', value: 'MAX', days: 99999 },
  ]

  const filteredData = useMemo(() => {
    if (!data.length) return []
    const periodConfig = PERIODS.find(p => p.value === period)
    if (!periodConfig) return data

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - periodConfig.days)

    return data.filter(d => new Date(d.timestamp) >= cutoffDate)
  }, [data, period])

  if (filteredData.length === 0) {
    const textS = isDark ? '#8E8E93' : '#6D6D72'
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: textS }]}>No hay datos disponibles</Text>
      </View>
    )
  }

  // Sample every Nth point if too many (max 20 points for readability)
  const step = Math.max(1, Math.floor(filteredData.length / 20))
  const chartData = filteredData.filter((_, i) => i % step === 0)

  // Format chart data
  const chartLabels = chartData.map(d => {
    const date = new Date(d.timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })

  const chartValues = chartData.map(d => d.thermometer_indicator)

  const bgGauge = isDark ? '#1C1C1E' : '#F0F0F0'
  const border = isDark ? '#1C1C1E' : '#E8E8E8'
  const textP = isDark ? '#FFFFFF' : '#000000'
  const textS = isDark ? '#8E8E93' : '#6D6D72'

  const chartConfig = {
    backgroundColor: isDark ? '#111111' : '#FFFFFF',
    backgroundGradientFrom: isDark ? '#111111' : '#FFFFFF',
    backgroundGradientTo: isDark ? '#1C1C1E' : '#F9FAFB',
    color: () => '#00B4D8',
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  }

  return (
    <View style={styles.container}>
      {/* Period selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodRow}
      >
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPeriod(p.value)}
            style={[
              styles.periodBtn,
              period === p.value
                ? { backgroundColor: '#00B4D8' }
                : { backgroundColor: bgGauge },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === p.value ? { color: '#FFFFFF' } : { color: textS },
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      <View style={[styles.chartWrapper, { backgroundColor: isDark ? '#111111' : '#FFFFFF' }]}>
        <LineChart
          data={{
            labels: chartLabels,
            datasets: [
              {
                data: chartValues.length > 0 ? chartValues : [0.5],
                color: () => '#00B4D8',
                strokeWidth: 2,
              },
            ],
          }}
          width={350}
          height={220}
          chartConfig={chartConfig}
          bezier
          withVerticalLines
          withHorizontalLines
          withShadow={false}
          withInnerLines
          style={styles.chart}
        />
      </View>

      {/* Threshold lines legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendColor,
              { backgroundColor: '#22C55E' },
            ]}
          />
          <Text style={[styles.legendText, { color: textS }]}>≥0.70 MUY ALTO</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendColor,
              { backgroundColor: '#EAB308' },
            ]}
          />
          <Text style={[styles.legendText, { color: textS }]}>0.45-0.70 NEUTRAL</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendColor,
              { backgroundColor: '#EF4444' },
            ]}
          />
          <Text style={[styles.legendText, { color: textS }]}>
            {'<'} 0.30 MUY BAJO
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },

  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 0,
  },

  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },

  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  chartWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 8,
  },

  chart: {
    marginVertical: 0,
    marginLeft: -16,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },

  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },

  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
  },
})
