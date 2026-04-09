import { Platform } from "react-native"

// Colores inspirados en el logo IA Investing
const logoBlue = "#00b4d8"       // Azul principal del logo
const logoGreen = "#4caf50"      // Verde principal del logo
const logoGradientLight = "#00d4ff" // Variante más clara para luces
const logoGradientDark = "#007f6f"  // Variante más oscura para sombras

export const Colors = {
  light: {
    text: "#11181C",
    textMuted: "#687076",
    background: "#fff",
    surface: "#f8f9fa",
    border: "#d1d5db",
    tint: logoBlue,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: logoBlue,
    primary: logoBlue,        // botones y elementos destacados
    secondary: logoGreen,     // acentos y highlights
    gradientStart: logoBlue,
    gradientEnd: logoGreen,
    error: "#ef4444",
    errorSoft: "#fee2e2",
    success: "#22c55e",
    successSoft: "#dcfce7",
  },
  dark: {
    text: "#ECEDEE",
    textMuted: "#9BA1A6",
    background: "#151718",
    surface: "#1e1f1f",
    border: "#374151",
    tint: logoGradientLight,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: logoGradientLight,
    primary: logoGradientLight,
    secondary: logoGradientDark,
    gradientStart: logoGradientLight,
    gradientEnd: logoGradientDark,
    error: "#fca5a5",
    errorSoft: "#7f1d1d",
    success: "#4ade80",
    successSoft: "#166534",
  },
}

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})

export type ColorScheme = "light" | "dark"
export type ThemeColors = typeof Colors.light

export const Typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "Roboto",
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  }),
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },
  fontWeight: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
}

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
}
