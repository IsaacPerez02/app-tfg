import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface ThermometerGaugeProps {
  value: number // [0, 1]
  signal: string // BUY / SELL / NEUTRAL
  alertLevel: string // MUY ALTO / ALTO / NEUTRO / BAJO / MUY BAJO
  isDark: boolean
  size?: number // gauge diameter
}

export function ThermometerGauge({
  value,
  signal,
  alertLevel,
  isDark,
  size = 180,
}: ThermometerGaugeProps) {
  // Clamp value [0, 1]
  const clipped = Math.max(0, Math.min(1, value))

  // Color zones
  const getGradientColor = (v: number) => {
    if (v < 0.3) return '#EF4444' // Red (SELL)
    if (v < 0.45) return '#F97316' // Orange
    if (v < 0.55) return '#EAB308' // Yellow (NEUTRAL)
    if (v < 0.7) return '#84CC16' // Lime
    return '#22C55E' // Green (BUY)
  }

  // Angle: -120 to 120 degrees (240 degree arc)
  const angle = -120 + clipped * 240

  const signalColor =
    signal === 'BUY'
      ? '#22C55E'
      : signal === 'SELL'
        ? '#EF4444'
        : '#EAB308'

  const signalIcon =
    signal === 'BUY'
      ? 'trending-up'
      : signal === 'SELL'
        ? 'trending-down'
        : 'minus'

  const bgGauge = isDark ? '#1C1C1E' : '#E8E8E8'
  const textP = isDark ? '#FFFFFF' : '#000000'
  const textS = isDark ? '#8E8E93' : '#6D6D72'

  return (
    <View style={[styles.container, { width: size, height: size * 1.15 }]}>
      {/* Outer gauge background */}
      <View
        style={[
          styles.gaugeOuter,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgGauge,
          },
        ]}
      >
        {/* Inner gauge circle with gradient simulation */}
        <View
          style={[
            styles.gaugeInner,
            {
              width: size * 0.8,
              height: size * 0.8,
              borderRadius: (size * 0.8) / 2,
              backgroundColor: isDark ? '#111111' : '#FFFFFF',
            },
          ]}
        >
          {/* Needle/indicator */}
          <View
            style={[
              styles.needle,
              {
                width: 4,
                height: size * 0.35,
                backgroundColor: getGradientColor(clipped),
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />

          {/* Center dot */}
          <View style={[styles.centerDot, { backgroundColor: signalColor }]} />

          {/* Value text */}
          <Text style={[styles.valueText, { color: textP }]}>
            {(clipped * 100).toFixed(0)}%
          </Text>
        </View>

        {/* Zone labels */}
        <View style={[styles.zoneLabel, styles.zoneLabelLeft]}>
          <Text style={[styles.zoneLabelText, { color: '#EF4444' }]}>VENDER</Text>
        </View>
        <View style={[styles.zoneLabel, styles.zoneLabelCenter]}>
          <Text style={[styles.zoneLabelText, { color: '#EAB308' }]}>NEUTRAL</Text>
        </View>
        <View style={[styles.zoneLabel, styles.zoneLabelRight]}>
          <Text style={[styles.zoneLabelText, { color: '#22C55E' }]}>COMPRAR</Text>
        </View>
      </View>

      {/* Signal badge */}
      <View
        style={[
          styles.signalBadge,
          {
            backgroundColor: signalColor + '18',
            borderColor: signalColor,
          },
        ]}
      >
        <MaterialCommunityIcons name={signalIcon as any} size={18} color={signalColor} />
        <View style={styles.signalText}>
          <Text style={[styles.signalLabel, { color: signalColor }]}>{signal}</Text>
          <Text style={[styles.signalSub, { color: textS }]}>{alertLevel}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  gaugeOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  gaugeInner: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  needle: {
    position: 'absolute',
    bottom: '50%',
    marginBottom: 2,
    borderRadius: 2,
  },

  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    zIndex: 10,
  },

  valueText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
  },

  zoneLabel: {
    position: 'absolute',
  },

  zoneLabelLeft: {
    bottom: 12,
    left: 12,
  },

  zoneLabelCenter: {
    bottom: 12,
    alignSelf: 'center',
  },

  zoneLabelRight: {
    bottom: 12,
    right: 12,
  },

  zoneLabelText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },

  signalText: {
    gap: 2,
  },

  signalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  signalSub: {
    fontSize: 11,
    fontWeight: '500',
  },
})
