import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Line, Text as SvgText } from 'react-native-svg'

interface OHLCData {
  timestamp: number | string
  close: number
}

interface CandleLineChartProps {
  data: OHLCData[]
  isDark?: boolean
  height?: number
  showMA?: boolean
  maWindow?: number
  accentColor?: string
}

const PAD = { top: 16, right: 8, bottom: 28, left: 52 }

function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null
    const slice = values.slice(i - window + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / window
  })
}

function buildLinePath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return ''
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  for (let i = 1; i < xs.length; i++) {
    const cpx = (xs[i - 1] + xs[i]) / 2
    d += ` C${cpx.toFixed(1)},${ys[i - 1].toFixed(1)} ${cpx.toFixed(1)},${ys[i].toFixed(1)} ${xs[i].toFixed(1)},${ys[i].toFixed(1)}`
  }
  return d
}

function buildFillPath(xs: number[], ys: number[], chartH: number): string {
  if (xs.length === 0) return ''
  const line = buildLinePath(xs, ys)
  const last = xs[xs.length - 1]
  const first = xs[0]
  return `${line} L${last.toFixed(1)},${chartH.toFixed(1)} L${first.toFixed(1)},${chartH.toFixed(1)} Z`
}

// Y-axis tick values: 4 nice ticks between min and max
function niceYTicks(min: number, max: number, count = 4): number[] {
  const range = max - min
  if (range === 0) return [min]
  const step = range / (count - 1)
  return Array.from({ length: count }, (_, i) => min + step * i)
}

function fmtPrice(v: number): string {
  if (v >= 10000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 100)   return v.toFixed(2)
  if (v >= 1)     return v.toFixed(3)
  return v.toFixed(5)
}

export function CandleLineChart({
  data,
  isDark = true,
  height = 220,
  showMA = true,
  maWindow = 20,
  accentColor = '#00b4d8',
}: CandleLineChartProps) {
  const bg      = isDark ? '#0D0D0D' : '#FFFFFF'
  const gridCol = isDark ? '#1C1C1E' : '#E5E5EA'
  const labelCol = isDark ? '#8E8E93' : '#6D6D78'
  const maColor = '#FF9500'

  const chartW = 340 // fixed logical width; Svg scales via viewBox
  const chartH = height - PAD.top - PAD.bottom
  const innerW = chartW - PAD.left - PAD.right

  const { linePath, fillPath, maPath, yTicks, isEmpty } = useMemo(() => {
    const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    if (sorted.length < 2) return { linePath: '', fillPath: '', maPath: '', yTicks: [], isEmpty: true }

    const closes = sorted.map(d => d.close)
    const minC = Math.min(...closes)
    const maxC = Math.max(...closes)
    const range = maxC - minC || 1

    const scaleX = (i: number) => PAD.left + (i / (sorted.length - 1)) * innerW
    const scaleY = (v: number) => PAD.top + (1 - (v - minC) / range) * chartH

    const xs = sorted.map((_, i) => scaleX(i))
    const ys = closes.map(v => scaleY(v))

    const lp = buildLinePath(xs, ys)
    const fp = buildFillPath(xs, ys, PAD.top + chartH)

    let mp = ''
    if (showMA && sorted.length >= maWindow) {
      const ma = movingAverage(closes, maWindow)
      const maXs: number[] = []
      const maYs: number[] = []
      ma.forEach((v, i) => {
        if (v !== null) {
          maXs.push(scaleX(i))
          maYs.push(scaleY(v))
        }
      })
      if (maXs.length >= 2) mp = buildLinePath(maXs, maYs)
    }

    const ticks = niceYTicks(minC, maxC, 4)

    return { linePath: lp, fillPath: fp, maPath: mp, yTicks: ticks.map(v => ({ v, y: scaleY(v) })), isEmpty: false }
  }, [data, height, showMA, maWindow, chartH, innerW])

  return (
    <View style={[styles.container, { backgroundColor: bg, height }]}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${chartW} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid lines + Y labels */}
        {yTicks.map(({ v, y }) => (
          <React.Fragment key={v}>
            <Line
              x1={PAD.left}
              y1={y}
              x2={chartW - PAD.right}
              y2={y}
              stroke={gridCol}
              strokeWidth={0.5}
            />
            <SvgText
              x={PAD.left - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill={labelCol}
            >
              {fmtPrice(v)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Fill under line */}
        {!isEmpty && (
          <Path d={fillPath} fill="url(#fillGrad)" />
        )}

        {/* MA line */}
        {!isEmpty && maPath !== '' && (
          <Path
            d={maPath}
            stroke={maColor}
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="4,3"
            opacity={0.85}
          />
        )}

        {/* Price line */}
        {!isEmpty && (
          <Path
            d={linePath}
            stroke={accentColor}
            strokeWidth={2}
            fill="none"
          />
        )}

        {/* Empty state */}
        {isEmpty && (
          <SvgText
            x={chartW / 2}
            y={height / 2}
            textAnchor="middle"
            fontSize={13}
            fill={labelCol}
          >
            Sin datos
          </SvgText>
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
})
