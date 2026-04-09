"use client"

import { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  View,
  TextInput,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Platform,
  useColorScheme,
  Image,
  StyleSheet,
} from "react-native"
import { useRouter } from "expo-router"
import { Colors, Typography, Spacing, BorderRadius, ThemeColors } from "@/constants/theme"

const logo = require("@/assets/app/logo/logo.png")
const API_BASE_URL = process.env.EXPO_PUBLIC_API

export default function ForgotPassword() {
  const router = useRouter()
  const colorScheme = useColorScheme() || "light"
  const themeColors: ThemeColors = colorScheme === "dark" ? Colors.dark : Colors.light

  const [email, setEmail] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>("")
  const [error, setError] = useState<string>("")

  const handleReset = async () => {
    if (!email) {
      setError("El email es obligatorio")
      return
    }

    try {
      setLoading(true)
      setError("")
      setMessage("")

      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.message || "Error al enviar el email")

      setMessage("Se ha enviado un correo con instrucciones para resetear tu contraseña.")
      setEmail("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: themeColors.background }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centerWrapper}>
            <View style={[styles.content, { backgroundColor: themeColors.background }]}>
              <Image source={logo} style={styles.logo} />

              <Text style={{ color: themeColors.textMuted, textAlign: "center", marginBottom: Spacing.lg, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium }}>
                Ingresa tu email para resetear tu contraseña
              </Text>

              <Text style={{ color: themeColors.text, marginBottom: Spacing.xl, textAlign: "center", fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold }}>
                Recuperar Contraseña
              </Text>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: themeColors.errorSoft, borderColor: themeColors.error }]}>
                  <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
                </View>
              ) : null}

              {message ? (
                <View style={[styles.successBox, { backgroundColor: themeColors.successSoft, borderColor: themeColors.success }]}>
                  <Text style={[styles.successText, { color: themeColors.success }]}>{message}</Text>
                </View>
              ) : null}

              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="Email"
                placeholderTextColor={themeColors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: themeColors.primary }]}
                onPress={handleReset}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: themeColors.surface }]}>
                  {loading ? "Enviando..." : "Enviar"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} style={styles.link}>
                <Text style={[styles.linkText, { color: themeColors.primary }]}>Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  centerWrapper: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: "100%" },
  content: { padding: Spacing.xl, width: "100%", maxWidth: 400, borderRadius: BorderRadius.lg },
  logo: { width: 150, height: 150, alignSelf: "center", marginBottom: Spacing.md, resizeMode: "contain" },
  input: { height: 52, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.md, fontSize: Typography.fontSize.base },
  button: { height: 52, borderRadius: BorderRadius.md, justifyContent: "center", alignItems: "center", marginTop: Spacing.sm },
  buttonText: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  link: { marginTop: Spacing.lg, alignSelf: "center" },
  linkText: { fontSize: Typography.fontSize.sm },
  errorBox: { borderWidth: 1, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  errorText: { fontSize: Typography.fontSize.sm, textAlign: "center" },
  successBox: { borderWidth: 1, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  successText: { fontSize: Typography.fontSize.sm, textAlign: "center" },
})
