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
import { Link } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, BorderRadius, ThemeColors } from "@/constants/theme"

const logo = require("@/assets/app/logo/logo.png")
const API_BASE_URL = process.env.EXPO_PUBLIC_API

export default function Login() {
    const router = useRouter()
    const colorScheme = useColorScheme() || "light"
    const themeColors: ThemeColors = colorScheme === "dark" ? Colors.dark : Colors.light

    const [email, setEmail] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")

    const handleLogin = async () => {
        if (!email || !password) {
            setError("Todos los campos son obligatorios")
            return
        }

        try {
            setLoading(true)
            setError("")

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.message || "Error al iniciar sesión")
            else {
                await AsyncStorage.setItem("userId", JSON.stringify(data.userId))
                router.replace("/(app)/app")
            }
        } catch (err: any) {
            setError(err.message)
            setEmail("")
            setPassword("")
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
                                Empieza a invertir con inteligencia
                            </Text>

                            <Text style={{ color: themeColors.text, marginBottom: Spacing.xl, textAlign: "center", fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold }}>
                                Bienvenido
                            </Text>

                            <TextInput
                                style={[styles.input, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
                                placeholder="Email"
                                placeholderTextColor={themeColors.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <TextInput
                                style={[styles.input, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
                                placeholder="Contraseña"
                                placeholderTextColor={themeColors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />

                            {error ? (
                                <View style={[styles.errorBox, { backgroundColor: themeColors.errorSoft, borderColor: themeColors.error }]}>
                                    <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: themeColors.primary }]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                <Text style={[styles.buttonText, { color: themeColors.surface }]}>
                                    {loading ? "Cargando..." : "Iniciar Sesión"}
                                </Text>
                            </TouchableOpacity>

                            <Link href="/(auth)/register" asChild>
                                <TouchableOpacity style={styles.link}>
                                    <Text style={[styles.linkText, { color: themeColors.primary }]}>
                                        ¿No tienes cuenta? Regístrate
                                    </Text>
                                </TouchableOpacity>
                            </Link>

                            <Link href="/(auth)/forgot-password" asChild>
                                <TouchableOpacity style={styles.forgotLink}>
                                    <Text style={[styles.forgotText, { color: themeColors.textMuted }]}>
                                        ¿Olvidaste tu contraseña?
                                    </Text>
                                </TouchableOpacity>
                            </Link>
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
    forgotLink: { marginTop: Spacing.md, alignSelf: "center" },
    forgotText: { fontSize: Typography.fontSize.sm },
    errorBox: { borderWidth: 1, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
    errorText: { fontSize: Typography.fontSize.sm, textAlign: "center" },
})
