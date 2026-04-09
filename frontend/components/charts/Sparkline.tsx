import { View, StyleSheet, Dimensions } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { useColorScheme } from '@/hooks/use-color-scheme'

interface SimpleSparklineProps {
  data: number[]
  color?: string
  height?: number
}

export function SimpleSparkline({ data, color = '#0066FF', height = 60 }: SimpleSparklineProps) {
  const isDark = useColorScheme() === 'dark'
  const chartWidth = Dimensions.get('window').width - 32

  if (!data || data.length === 0) {
    return <View style={{ height }} />
  }

  // Tomar últimos 30 puntos
  const chartData = data.slice(-30).map((v, i) => ({
    x: i.toString(),
    y: v
  }))

  return (
    <View style={styles.container}>
      <LineChart
        withInnerLines={false}
        withOuterLines={false}
        data={{
          labels: [],
          datasets: [
            {
              data: chartData.map(d => d.y),
              color: () => color,
              strokeWidth: 2,
              withDots: false,
            }
          ]
        }}
        width={chartWidth - 20}
        height={height}
        chartConfig={{
          backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
          backgroundGradientFrom: isDark ? '#1F1F1F' : '#FFFFFF',
          backgroundGradientTo: isDark ? '#1F1F1F' : '#FFFFFF',
          decimalPlaces: 0,
          color: () => isDark ? '#8E8E93' : '#CCCCCC',
          labelColor: () => isDark ? '#8E8E93' : '#CCCCCC',
          style: { borderRadius: 8 },
          propsForDots: { r: '0' }
        }}
        bezier
        style={{ marginLeft: -20 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  }
})