import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'

type Props = {
  ticker: any
  onPress?: () => void
}

export function TickerCard({ ticker, onPress }: Props) {

  const safeNumber = (value: any) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  const formatPrice = (value: any) => {
    return `$${safeNumber(value).toFixed(2)}`
  }

  const formatPercent = (value: any) => {
    return `${safeNumber(value).toFixed(2)}%`
  }

  const isPositive = safeNumber(ticker?.change) >= 0

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.container}>

        {/* LEFT */}
        <View style={styles.left}>
          <Text style={styles.symbol}>
            {ticker?.symbol ?? ''}
          </Text>

          <Text style={styles.name}>
            {ticker?.name ?? ''}
          </Text>
        </View>

        {/* RIGHT */}
        <View style={styles.right}>
          <Text style={styles.price}>
            {formatPrice(ticker?.price)}
          </Text>

          <Text
            style={[
              styles.change,
              { color: isPositive ? '#16c784' : '#ea3943' }
            ]}
          >
            {formatPercent(ticker?.change)}
          </Text>
        </View>

      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a'
  },

  left: {
    flexDirection: 'column'
  },

  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  },

  name: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2
  },

  right: {
    alignItems: 'flex-end'
  },

  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },

  change: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600'
  }
})