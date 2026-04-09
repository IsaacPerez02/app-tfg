"use client"

import React, { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { View, Text, TouchableOpacity, FlatList, StyleSheet, useColorScheme, ScrollView, Modal } from "react-native"
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"
import { Colors, Typography, Spacing, BorderRadius, ThemeColors } from "@/constants/theme"
import { DotsIcon } from "@/components/svg/dots"
import Options from "@/components/options"

type AssetItem = {
  symbol: string
  quantity: number
  price: number
}

type PredictionItem = {
  symbol: string
  takenAt: string
  direction: "BUY" | "SELL"
  entryPrice: number
  currentPrice: number
}

export default function User() {
  const router = useRouter()
  const colorScheme = useColorScheme() || "light"
  const themeColors: ThemeColors = colorScheme === "dark" ? Colors.dark : Colors.light

  const [modalVisible, setModalVisible] = useState(false)

  const handleLogout = async () => {
    await AsyncStorage.removeItem("userId")
    router.replace("/(auth)/login")
  }

  const assets: AssetItem[] = [
    { symbol: "AAPL", quantity: 10, price: 168.45 },
    { symbol: "TSLA", quantity: 5, price: 890.12 },
    { symbol: "GOOGL", quantity: 2, price: 133.78 },
  ]

  const predictions: PredictionItem[] = [
    { symbol: "AAPL", takenAt: "2026-02-10", direction: "BUY", entryPrice: 160, currentPrice: 168.45 },
    { symbol: "TSLA", takenAt: "2026-02-12", direction: "BUY", entryPrice: 900, currentPrice: 890.12 },
  ]

  // Calcular totales
  const totalAssets = assets.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  const totalProfit = predictions.reduce((sum, item) => {
    const profit = (item.currentPrice - item.entryPrice) * (item.direction === "BUY" ? 1 : -1)
    return sum + profit
  }, 0)

  const renderAsset = ({ item }: { item: AssetItem }) => {
    const total = item.quantity * item.price
    return (
      <View style={[styles.assetCard, { 
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      }]}>
        <View style={styles.assetHeader}>
          <LinearGradient
            colors={[themeColors.gradientStart, themeColors.gradientEnd]}
            style={styles.assetSymbolBadge}
          >
            <Text style={styles.assetSymbolText}>{item.symbol}</Text>
          </LinearGradient>
        </View>
        <View style={styles.assetDetails}>
          <View style={styles.assetRow}>
            <Text style={[styles.assetLabel, { color: themeColors.textMuted }]}>Cantidad</Text>
            <Text style={[styles.assetValue, { color: themeColors.text }]}>{item.quantity}</Text>
          </View>
          <View style={styles.assetRow}>
            <Text style={[styles.assetLabel, { color: themeColors.textMuted }]}>Precio</Text>
            <Text style={[styles.assetValue, { color: themeColors.text }]}>${item.price.toFixed(2)}</Text>
          </View>
          <View style={[styles.assetRow, styles.assetTotalRow]}>
            <Text style={[styles.assetLabel, { color: themeColors.textMuted }]}>Total</Text>
            <Text style={[styles.assetTotal, { color: themeColors.primary }]}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    )
  }

  const renderPrediction = ({ item }: { item: PredictionItem }) => {
    const profit = (item.currentPrice - item.entryPrice) * (item.direction === "BUY" ? 1 : -1)
    const profitPercent = (profit / item.entryPrice) * 100
    const isProfit = profit >= 0
    const profitColor = isProfit ? themeColors.success : themeColors.error

    return (
      <View style={[styles.predictionCard, { 
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      }]}>
        <View style={styles.predictionHeader}>
          <View style={[styles.predictionSymbolBadge, { backgroundColor: `${themeColors.primary}20` }]}>
            <Text style={[styles.predictionSymbolText, { color: themeColors.primary }]}>
              {item.symbol}
            </Text>
          </View>
          <View style={[styles.directionBadge, { 
            backgroundColor: item.direction === "BUY" ? `${themeColors.success}15` : `${themeColors.error}15`
          }]}>
            <Text style={[styles.directionText, { 
              color: item.direction === "BUY" ? themeColors.success : themeColors.error 
            }]}>
              {item.direction === "BUY" ? "↑ COMPRA" : "↓ VENTA"}
            </Text>
          </View>
        </View>
        
        <View style={styles.predictionDetails}>
          <View style={styles.predictionRow}>
            <Text style={[styles.predictionLabel, { color: themeColors.textMuted }]}>Fecha</Text>
            <Text style={[styles.predictionValue, { color: themeColors.text }]}>
              {new Date(item.takenAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.predictionRow}>
            <Text style={[styles.predictionLabel, { color: themeColors.textMuted }]}>Entrada</Text>
            <Text style={[styles.predictionValue, { color: themeColors.text }]}>
              ${item.entryPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.predictionRow}>
            <Text style={[styles.predictionLabel, { color: themeColors.textMuted }]}>Actual</Text>
            <Text style={[styles.predictionValue, { color: themeColors.text }]}>
              ${item.currentPrice.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.predictionRow, styles.profitRow]}>
            <Text style={[styles.predictionLabel, { color: themeColors.textMuted }]}>Resultado</Text>
            <View style={styles.profitContainer}>
              <Text style={[styles.profitValue, { color: profitColor }]}>
                {isProfit ? "+" : ""}{profit.toFixed(2)} USD
              </Text>
              <Text style={[styles.profitPercent, { color: profitColor }]}>
                ({isProfit ? "+" : ""}{profitPercent.toFixed(1)}%)
              </Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[themeColors.gradientStart, themeColors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Mi Portafolio</Text>
              <Text style={styles.headerSubtitle}>Gestiona tus inversiones</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setModalVisible(true)} 
              style={styles.menuButton}
              activeOpacity={0.7}
            >
              <DotsIcon stroke="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Tarjetas de resumen */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { 
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>
              Valor Total
            </Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>
              ${totalAssets.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, { 
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>
              Ganancias/Pérdidas
            </Text>
            <Text style={[styles.summaryValue, { 
              color: totalProfit >= 0 ? themeColors.success : themeColors.error 
            }]}>
              {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(2)} USD
            </Text>
          </View>
        </View>

        {/* Sección de activos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Mis Activos
          </Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textMuted }]}>
            {assets.length} posiciones activas
          </Text>
          <FlatList
            data={assets}
            keyExtractor={item => item.symbol}
            renderItem={renderAsset}
            scrollEnabled={false}
          />
        </View>

        {/* Sección de predicciones */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Predicciones Tomadas
          </Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textMuted }]}>
            Historial de señales seguidas
          </Text>
          <FlatList
            data={predictions}
            keyExtractor={item => item.symbol + item.takenAt}
            renderItem={renderPrediction}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Modal de opciones */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomColor: themeColors.border }]} 
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalOptionText, { color: themeColors.error }]}>
                Cerrar Sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalOptionText, { color: themeColors.textMuted }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl * 1.5,
    borderBottomRightRadius: BorderRadius.xl * 1.5,
    marginBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: Typography.fontSize["3xl"],
    fontWeight: Typography.fontWeight.bold,
    color: "#fff",
    marginBottom: Spacing.xs / 2,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.base,
    color: "rgba(255,255,255,0.9)",
  },
  menuButton: {
    padding: Spacing.sm,
  },

  summaryContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },

  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs / 2,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.md,
  },

  assetCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  assetHeader: {
    marginBottom: Spacing.sm,
  },
  assetSymbolBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  assetSymbolText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: "#fff",
  },
  assetDetails: {
    gap: Spacing.xs,
  },
  assetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assetTotalRow: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
    marginTop: Spacing.xs,
  },
  assetLabel: {
    fontSize: Typography.fontSize.sm,
  },
  assetValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  assetTotal: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },

  predictionCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  predictionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  predictionSymbolBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.md,
  },
  predictionSymbolText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  directionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.md,
  },
  directionText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  predictionDetails: {
    gap: Spacing.xs,
  },
  predictionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profitRow: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
    marginTop: Spacing.xs,
  },
  predictionLabel: {
    fontSize: Typography.fontSize.sm,
  },
  predictionValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  profitContainer: {
    alignItems: "flex-end",
  },
  profitValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  profitPercent: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 280,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  modalOption: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    textAlign: "center",
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
})