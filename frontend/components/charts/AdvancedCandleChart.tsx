/**
 * AdvancedCandleChart — gráfico profesional de velas/línea con subgráficos.
 *
 * Renderizado puro con react-native-svg (sin dependencias extra).
 *
 * Subgráficos:
 *   • Gráfico principal: velas japonesas (OHLC) o línea de precio
 *   • Overlay EMA 20/50/200, Bollinger Bands (toggleables)
 *   • Sub-chart: Volumen (barras verde/rojo)
 *   • Sub-chart: RSI 14 con líneas 70/30
 *   • Sub-chart: MACD (línea + señal + histograma) — toggleable
 *
 * Touch: crosshair + tooltip al hacer tap/drag.
 */

import React, { useMemo, useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, PanResponder } from 'react-native'
import Svg, {
  Rect, Line, Path, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop, Circle
} from 'react-native-svg'
import { MarketCandle, MarketIndicators } from '@/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width
const PAD = { top: 8, right: 8, bottom: 24, left: 56 }

// Sub-chart heights as fractions of total
const VOL_H_RATIO  = 0.15  // volume bar chart height
const RSI_H_RATIO  = 0.18  // RSI chart height
const MACD_H_RATIO = 0.18  // MACD chart height

// Colors
const C = {
  up:         '#00c896',
  down:       '#ff4d6d',
  ema20:      '#00b4d8',
  ema50:      '#FF9500',
  ema200:     '#FF3333',
  bb:         '#9B59B6',
  rsiLine:    '#FFD700',
  macdLine:   '#00b4d8',
  macdSignal: '#FF9500',
  macdHist:   '#4CAF50',
  grid:       '#1C1C1E',
  label:      '#8E8E93',
  crosshair:  '#FFFFFF44',
  volUp:      '#00c89640',
  volDown:    '#ff4d6d40',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface OverlayToggles {
  ema20:   boolean
  ema50:   boolean
  ema200:  boolean
  bb:      boolean
  macd:    boolean
}

interface Props {
  candles:    MarketCandle[]
  indicators: MarketIndicators[]
  isDark?:    boolean
  height?:    number
}

interface TooltipData {
  x:     number
  idx:   number
  candle: MarketCandle
  ind?:   MarketIndicators
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function niceYTicks(min: number, max: number, count = 4): number[] {
  const range = max - min
  if (range === 0) return [min]
  const step = range / (count - 1)
  return Array.from({ length: count }, (_, i) => min + step * i)
}

function fmtPrice(v: number): string {
  if (v >= 10000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 100)   return v.toFixed(1)
  if (v >= 1)     return v.toFixed(2)
  return v.toFixed(4)
}

function fmtDate(ts: string): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// ── Toggle Button ──────────────────────────────────────────────────────────────

function ToggleBtn({
  label, color, active, onPress,
}: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.toggleBtn,
        { borderColor: color, backgroundColor: active ? color + '33' : 'transparent' },
      ]}
    >
      <Text style={[styles.toggleBtnText, { color: active ? color : C.label }]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Chart mode button ──────────────────────────────────────────────────────────

function ModeBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.modeBtn, active && { backgroundColor: '#00b4d822' }]}
    >
      <Text style={[styles.modeBtnText, { color: active ? '#00b4d8' : C.label }]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdvancedCandleChart({ candles, indicators, isDark = true, height = 420 }: Props) {
  const [mode,     setMode]     = useState<'candle' | 'line'>('candle')
  const [overlays, setOverlays] = useState<OverlayToggles>({
    ema20: true, ema50: true, ema200: true, bb: false, macd: false,
  })
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const toggle = useCallback((key: keyof OverlayToggles) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // ── Derived dimensions ──────────────────────────────────────────────────────

  const chartW = SCREEN_W

  const macdVisible = overlays.macd
  const volH  = Math.floor(height * VOL_H_RATIO)
  const rsiH  = Math.floor(height * RSI_H_RATIO)
  const macdH = macdVisible ? Math.floor(height * MACD_H_RATIO) : 0
  const mainH = height - volH - rsiH - macdH

  const innerW = chartW - PAD.left - PAD.right

  // ── Sorted & aligned data ───────────────────────────────────────────────────

  const { sorted, indMap } = useMemo(() => {
    const sorted = [...candles].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    // Map timestamp → indicator for O(1) lookup
    const indMap = new Map<string, MarketIndicators>()
    for (const ind of indicators) {
      indMap.set(ind.timestamp, ind)
    }
    // fallback: match by index (backend aligns them)
    return { sorted, indMap }
  }, [candles, indicators])

  const n = sorted.length
  if (n < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Sin datos suficientes</Text>
      </View>
    )
  }

  // ── Scale helpers ────────────────────────────────────────────────────────────

  const candleW = Math.max(2, Math.min(12, innerW / n - 1))
  const scaleX = (i: number) => PAD.left + (i / (n - 1)) * innerW

  // Main chart Y scale
  const allHighs  = sorted.map(c => c.high)
  const allLows   = sorted.map(c => c.low)
  const mainMin   = Math.min(...allLows)  * 0.999
  const mainMax   = Math.max(...allHighs) * 1.001
  const mainRange = mainMax - mainMin || 1

  const scaleY = (v: number, pTop: number, pHeight: number) =>
    pTop + (1 - (v - mainMin) / mainRange) * (pHeight - PAD.top - PAD.bottom)
  const mainY = (v: number) => scaleY(v, PAD.top, mainH)

  // Volume Y scale (0 → maxVol)
  const volTop = mainH
  const maxVol = Math.max(...sorted.map(c => c.volume), 1)
  const volY = (v: number) => volTop + (volH - 4) * (1 - v / maxVol)

  // RSI Y scale (0–100)
  const rsiTop = mainH + volH
  const rsiScaleY = (v: number) => rsiTop + PAD.top + (1 - v / 100) * (rsiH - PAD.top - PAD.bottom)

  // MACD Y scale
  const macdTop = mainH + volH + rsiH
  const macdVals: number[] = []
  for (let i = 0; i < n; i++) {
    const ind = indicators[i]
    if (!ind) continue
    if (ind.macd != null)           macdVals.push(ind.macd)
    if (ind.macd_signal != null)    macdVals.push(ind.macd_signal)
    if (ind.macd_histogram != null) macdVals.push(ind.macd_histogram)
  }
  const macdMin = macdVals.length ? Math.min(...macdVals) * 1.05 : -1
  const macdMax = macdVals.length ? Math.max(...macdVals) * 1.05 : 1
  const macdRange = macdMax - macdMin || 1
  const macdScaleY = (v: number) =>
    macdTop + PAD.top + (1 - (v - macdMin) / macdRange) * (macdH - PAD.top - PAD.bottom)

  // ── Build SVG paths ─────────────────────────────────────────────────────────

  // Line price path
  const linePath = useMemo(() => {
    if (mode !== 'line') return ''
    const pts = sorted.map((c, i) => `${scaleX(i).toFixed(1)},${mainY(c.close).toFixed(1)}`)
    return 'M' + pts.join(' L')
  }, [sorted, mode, mainH, n]) // eslint-disable-line react-hooks/exhaustive-deps

  // EMA line builder
  const buildEmaPath = (key: 'ema_20' | 'ema_50' | 'ema_200') => {
    let d = ''
    let first = true
    for (let i = 0; i < n; i++) {
      const ind = indicators[i]
      const v = ind?.[key]
      if (v == null) continue
      const x = scaleX(i).toFixed(1)
      const y = mainY(v).toFixed(1)
      if (first) { d = `M${x},${y}`; first = false }
      else d += ` L${x},${y}`
    }
    return d
  }

  // Bollinger upper/middle/lower paths
  const buildBBPaths = () => {
    let upper = '', lower = '', middle = ''
    let fu = true, fl = true, fm = true
    for (let i = 0; i < n; i++) {
      const ind = indicators[i]
      if (!ind) continue
      const x = scaleX(i).toFixed(1)
      if (ind.bollinger_upper != null) {
        const y = mainY(ind.bollinger_upper).toFixed(1)
        upper += fu ? `M${x},${y}` : ` L${x},${y}`; fu = false
      }
      if (ind.bollinger_lower != null) {
        const y = mainY(ind.bollinger_lower).toFixed(1)
        lower += fl ? `M${x},${y}` : ` L${x},${y}`; fl = false
      }
      if (ind.bollinger_middle != null) {
        const y = mainY(ind.bollinger_middle).toFixed(1)
        middle += fm ? `M${x},${y}` : ` L${x},${y}`; fm = false
      }
    }
    return { upper, lower, middle }
  }

  // RSI path
  const buildRsiPath = () => {
    let d = '', first = true
    for (let i = 0; i < n; i++) {
      const ind = indicators[i]
      if (!ind || ind.rsi_14 == null) continue
      const x = scaleX(i).toFixed(1)
      const y = rsiScaleY(ind.rsi_14).toFixed(1)
      if (first) { d = `M${x},${y}`; first = false }
      else d += ` L${x},${y}`
    }
    return d
  }

  // MACD paths
  const buildMacdPaths = () => {
    let line = '', signal = '', first = true, firstS = true
    for (let i = 0; i < n; i++) {
      const ind = indicators[i]
      if (!ind) continue
      const x = scaleX(i).toFixed(1)
      if (ind.macd != null) {
        const y = macdScaleY(ind.macd).toFixed(1)
        if (first) { line = `M${x},${y}`; first = false }
        else line += ` L${x},${y}`
      }
      if (ind.macd_signal != null) {
        const y = macdScaleY(ind.macd_signal).toFixed(1)
        if (firstS) { signal = `M${x},${y}`; firstS = false }
        else signal += ` L${x},${y}`
      }
    }
    return { line, signal }
  }

  const ema20Path  = overlays.ema20  ? buildEmaPath('ema_20')  : ''
  const ema50Path  = overlays.ema50  ? buildEmaPath('ema_50')  : ''
  const ema200Path = overlays.ema200 ? buildEmaPath('ema_200') : ''
  const bbPaths    = overlays.bb     ? buildBBPaths()          : null
  const rsiPath    = buildRsiPath()
  const macdPaths  = macdVisible     ? buildMacdPaths()        : null

  // Y-axis ticks for main chart
  const mainTicks = niceYTicks(mainMin, mainMax, 4).map(v => ({ v, y: mainY(v) }))

  // ── Touch interaction ───────────────────────────────────────────────────────

  const handleTouch = useCallback((px: number) => {
    if (n < 2) return
    const relX = px - PAD.left
    const idx = Math.round((relX / innerW) * (n - 1))
    const clampedIdx = Math.max(0, Math.min(n - 1, idx))
    const x = scaleX(clampedIdx)
    const candle = sorted[clampedIdx]
    const ind = indicators[clampedIdx]
    setTooltip({ x, idx: clampedIdx, candle, ind })
  }, [n, sorted, indicators, innerW]) // eslint-disable-line react-hooks/exhaustive-deps

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: e => handleTouch(e.nativeEvent.locationX),
    onPanResponderMove:  e => handleTouch(e.nativeEvent.locationX),
    onPanResponderRelease: () => setTimeout(() => setTooltip(null), 1500),
  }), [handleTouch])

  // ── Render ──────────────────────────────────────────────────────────────────

  const bgColor  = isDark ? '#0D0D0D' : '#FFFFFF'
  const gridCol  = isDark ? '#1C1C1E' : '#E5E5EA'
  const labelCol = isDark ? '#8E8E93' : '#6D6D78'
  const divCol   = isDark ? '#2C2C2E' : '#E5E5EA'

  const totalSvgH = mainH + volH + rsiH + macdH

  return (
    <View style={[styles.wrapper, { backgroundColor: bgColor }]}>

      {/* ── Chart Mode + Overlay Toggles ── */}
      <View style={styles.controls}>
        <View style={styles.modeRow}>
          <ModeBtn label="Velas" active={mode === 'candle'} onPress={() => setMode('candle')} />
          <ModeBtn label="Línea" active={mode === 'line'}   onPress={() => setMode('line')} />
        </View>
        <View style={styles.overlayRow}>
          <ToggleBtn label="E20"   color={C.ema20}   active={overlays.ema20}   onPress={() => toggle('ema20')} />
          <ToggleBtn label="E50"   color={C.ema50}   active={overlays.ema50}   onPress={() => toggle('ema50')} />
          <ToggleBtn label="E200"  color={C.ema200}  active={overlays.ema200}  onPress={() => toggle('ema200')} />
          <ToggleBtn label="BB"    color={C.bb}      active={overlays.bb}      onPress={() => toggle('bb')} />
          <ToggleBtn label="MACD"  color={C.macdLine} active={overlays.macd}  onPress={() => toggle('macd')} />
        </View>
      </View>

      {/* ── SVG Chart ── */}
      <View {...panResponder.panHandlers}>
        <Svg width={chartW} height={totalSvgH} viewBox={`0 0 ${chartW} ${totalSvgH}`}>
          <Defs>
            <SvgLinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00b4d8" stopOpacity={0.25} />
              <Stop offset="100%" stopColor="#00b4d8" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          {/* ── Background bands ── */}
          <Rect x={0} y={0}         width={chartW} height={mainH}     fill={bgColor} />
          <Rect x={0} y={mainH}     width={chartW} height={volH}      fill={isDark ? '#0A0A0A' : '#F8F8F8'} />
          <Rect x={0} y={rsiTop}    width={chartW} height={rsiH}      fill={isDark ? '#0A0A0A' : '#F8F8F8'} />
          {macdVisible && <Rect x={0} y={macdTop} width={chartW} height={macdH} fill={isDark ? '#0A0A0A' : '#F8F8F8'} />}

          {/* ── Dividers ── */}
          <Line x1={0} y1={mainH}  x2={chartW} y2={mainH}  stroke={divCol} strokeWidth={1} />
          <Line x1={0} y1={rsiTop} x2={chartW} y2={rsiTop} stroke={divCol} strokeWidth={1} />
          {macdVisible && <Line x1={0} y1={macdTop} x2={chartW} y2={macdTop} stroke={divCol} strokeWidth={1} />}

          {/* ── Main chart grid + Y labels ── */}
          {mainTicks.map(({ v, y }) => (
            <React.Fragment key={`ytick-${v}`}>
              <Line x1={PAD.left} y1={y} x2={chartW - PAD.right} y2={y}
                stroke={gridCol} strokeWidth={0.5} />
              <SvgText x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill={labelCol}>
                {fmtPrice(v)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* ── Section labels ── */}
          <SvgText x={PAD.left + 2} y={mainH - 4}  fontSize={8} fill={labelCol}>VOL</SvgText>
          <SvgText x={PAD.left + 2} y={rsiTop + 14} fontSize={8} fill={C.rsiLine}>RSI</SvgText>
          {macdVisible && <SvgText x={PAD.left + 2} y={macdTop + 14} fontSize={8} fill={C.macdLine}>MACD</SvgText>}

          {/* ── RSI reference lines (70 / 30) ── */}
          <Line x1={PAD.left} y1={rsiScaleY(70)} x2={chartW - PAD.right} y2={rsiScaleY(70)}
            stroke={C.down} strokeWidth={0.5} strokeDasharray="4,3" opacity={0.7} />
          <Line x1={PAD.left} y1={rsiScaleY(30)} x2={chartW - PAD.right} y2={rsiScaleY(30)}
            stroke={C.up}   strokeWidth={0.5} strokeDasharray="4,3" opacity={0.7} />
          <Line x1={PAD.left} y1={rsiScaleY(50)} x2={chartW - PAD.right} y2={rsiScaleY(50)}
            stroke={gridCol} strokeWidth={0.5} />
          <SvgText x={PAD.left - 4} y={rsiScaleY(70) + 3} textAnchor="end" fontSize={7} fill={C.down}>70</SvgText>
          <SvgText x={PAD.left - 4} y={rsiScaleY(30) + 3} textAnchor="end" fontSize={7} fill={C.up}>30</SvgText>

          {/* ── MACD zero line ── */}
          {macdVisible && macdMin < 0 && macdMax > 0 && (
            <Line x1={PAD.left} y1={macdScaleY(0)} x2={chartW - PAD.right} y2={macdScaleY(0)}
              stroke={gridCol} strokeWidth={0.5} />
          )}

          {/* ── Bollinger Bands fill ── */}
          {bbPaths && bbPaths.upper && bbPaths.lower && (
            <>
              <Path d={bbPaths.upper} stroke={C.bb} strokeWidth={1} fill="none" opacity={0.6} strokeDasharray="2,2" />
              <Path d={bbPaths.lower} stroke={C.bb} strokeWidth={1} fill="none" opacity={0.6} strokeDasharray="2,2" />
              <Path d={bbPaths.middle} stroke={C.bb} strokeWidth={0.8} fill="none" opacity={0.4} strokeDasharray="4,3" />
            </>
          )}

          {/* ── EMA overlays ── */}
          {ema20Path  && <Path d={ema20Path}  stroke={C.ema20}  strokeWidth={1.5} fill="none" opacity={0.85} />}
          {ema50Path  && <Path d={ema50Path}  stroke={C.ema50}  strokeWidth={1.5} fill="none" opacity={0.85} />}
          {ema200Path && <Path d={ema200Path} stroke={C.ema200} strokeWidth={1.5} fill="none" opacity={0.85} />}

          {/* ── Candlesticks ── */}
          {mode === 'candle' && sorted.map((c, i) => {
            const x    = scaleX(i)
            const isUp = c.close >= c.open
            const col  = isUp ? C.up : C.down
            const bodyTop = mainY(Math.max(c.open, c.close))
            const bodyBot = mainY(Math.min(c.open, c.close))
            const bodyH   = Math.max(bodyBot - bodyTop, 1)
            const wickX   = x
            return (
              <React.Fragment key={`c-${i}`}>
                {/* wick */}
                <Line x1={wickX} y1={mainY(c.high)} x2={wickX} y2={mainY(c.low)}
                  stroke={col} strokeWidth={1} />
                {/* body */}
                <Rect
                  x={x - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyH}
                  fill={isUp ? col : col}
                  opacity={isUp ? 0.9 : 0.75}
                />
              </React.Fragment>
            )
          })}

          {/* ── Line chart ── */}
          {mode === 'line' && linePath !== '' && (
            <Path d={linePath} stroke="#00b4d8" strokeWidth={2} fill="none" />
          )}

          {/* ── Volume bars ── */}
          {sorted.map((c, i) => {
            const isUp  = c.close >= c.open
            const x     = scaleX(i)
            const top   = volY(c.volume)
            const barH  = Math.max(volH + mainH - top - 2, 1)
            return (
              <Rect
                key={`v-${i}`}
                x={x - candleW / 2}
                y={top}
                width={candleW}
                height={barH}
                fill={isUp ? C.up : C.down}
                opacity={0.55}
              />
            )
          })}

          {/* ── RSI line ── */}
          {rsiPath && (
            <Path d={rsiPath} stroke={C.rsiLine} strokeWidth={1.5} fill="none" opacity={0.9} />
          )}

          {/* ── MACD histogram bars ── */}
          {macdVisible && indicators.map((ind, i) => {
            if (!ind || ind.macd_histogram == null) return null
            const x    = scaleX(i)
            const zero = macdScaleY(0)
            const top  = macdScaleY(ind.macd_histogram)
            const barH = Math.abs(zero - top)
            const isPos = ind.macd_histogram >= 0
            return (
              <Rect
                key={`mh-${i}`}
                x={x - candleW / 2}
                y={isPos ? top : zero}
                width={candleW}
                height={Math.max(barH, 1)}
                fill={isPos ? C.macdHist : C.down}
                opacity={0.6}
              />
            )
          })}

          {/* ── MACD line + signal ── */}
          {macdPaths?.line   && <Path d={macdPaths.line}   stroke={C.macdLine}   strokeWidth={1.5} fill="none" />}
          {macdPaths?.signal && <Path d={macdPaths.signal} stroke={C.macdSignal} strokeWidth={1}   fill="none" />}

          {/* ── Crosshair ── */}
          {tooltip && (
            <>
              <Line
                x1={tooltip.x} y1={PAD.top}
                x2={tooltip.x} y2={totalSvgH - PAD.bottom}
                stroke={C.crosshair} strokeWidth={1} strokeDasharray="4,4"
              />
              <Line
                x1={PAD.left} y1={mainY(tooltip.candle.close)}
                x2={chartW - PAD.right} y2={mainY(tooltip.candle.close)}
                stroke={C.crosshair} strokeWidth={1} strokeDasharray="4,4"
              />
              <Circle cx={tooltip.x} cy={mainY(tooltip.candle.close)} r={4}
                fill={tooltip.candle.close >= tooltip.candle.open ? C.up : C.down} />
            </>
          )}

        </Svg>
      </View>

      {/* ── Tooltip ── */}
      {tooltip && (
        <TooltipBox candle={tooltip.candle} ind={tooltip.ind} isDark={isDark} />
      )}
    </View>
  )
}

// ── Tooltip box ────────────────────────────────────────────────────────────────

function TooltipBox({
  candle, ind, isDark,
}: { candle: MarketCandle; ind?: MarketIndicators; isDark: boolean }) {
  const bg     = isDark ? '#1C1C1E' : '#F5F5F5'
  const border = isDark ? '#2C2C2E' : '#E5E5EA'
  const textP  = isDark ? '#FFFFFF' : '#000000'
  const textS  = isDark ? '#8E8E93' : '#6D6D78'
  const isUp   = candle.close >= candle.open

  const fmtV = (v: number | null | undefined) => v == null ? 'N/A' : fmtPrice(v)

  return (
    <View style={[styles.tooltip, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.tooltipDate, { color: textS }]}>{fmtDate(candle.timestamp)}</Text>
      <View style={styles.tooltipRow}>
        <TooltipItem label="O" value={fmtPrice(candle.open)}  color={textP} />
        <TooltipItem label="H" value={fmtPrice(candle.high)}  color={C.up} />
        <TooltipItem label="L" value={fmtPrice(candle.low)}   color={C.down} />
        <TooltipItem label="C" value={fmtPrice(candle.close)} color={isUp ? C.up : C.down} />
      </View>
      {ind && (
        <View style={styles.tooltipRow}>
          {ind.rsi_14    != null && <TooltipItem label="RSI"    value={ind.rsi_14.toFixed(1)}    color={C.rsiLine} />}
          {ind.macd      != null && <TooltipItem label="MACD"   value={ind.macd.toFixed(2)}      color={C.macdLine} />}
          {ind.ema_20    != null && <TooltipItem label="E20"    value={fmtV(ind.ema_20)}         color={C.ema20} />}
          {ind.ema_50    != null && <TooltipItem label="E50"    value={fmtV(ind.ema_50)}         color={C.ema50} />}
        </View>
      )}
    </View>
  )
}

function TooltipItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.tooltipItem}>
      <Text style={[styles.tooltipLabel, { color: '#8E8E93' }]}>{label}</Text>
      <Text style={[styles.tooltipValue, { color }]}>{value}</Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  controls: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  overlayRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  tooltip: {
    marginHorizontal: 8,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  tooltipDate: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  tooltipRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  tooltipItem: {
    alignItems: 'center',
    minWidth: 40,
  },
  tooltipLabel: {
    fontSize: 9,
    fontWeight: '500',
  },
  tooltipValue: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
})
