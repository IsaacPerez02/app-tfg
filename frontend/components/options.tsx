"use client"

import { SafeAreaView } from "react-native-safe-area-context"
import { View, StyleSheet, TouchableOpacity, Text } from "react-native"
import { Link, usePathname } from "expo-router"
import { useColorScheme } from "react-native"

import HomeIcon from "./svg/home"
import RocketIcon from "./svg/rocket"
import TrendingUpIcon from "./svg/trending"
import NewsIcon from "./svg/news"
import UserIcon from "./svg/user"

const TABS = [
  { path: "/(app)/app",                        section: "app",         Icon: HomeIcon,       label: "Inicio"   },
  { path: "/(app)/(tickers)/tickers",           section: "(tickers)",   Icon: TrendingUpIcon, label: "Activos"  },
  { path: "/(app)/(predictions)/predictions",   section: "(predictions)", Icon: RocketIcon,   label: "IA"       },
  { path: "/(app)/(news)/news",                 section: "(news)",      Icon: NewsIcon,       label: "Noticias" },
  { path: "/(app)/(user)/user",                 section: "(user)",      Icon: UserIcon,       label: "Perfil"   },
] as const

export default function Options() {
  const colorScheme = useColorScheme() || "light"
  const isDark = colorScheme === "dark"
  const pathname = usePathname()

  const barBg    = isDark ? "#000000" : "#FFFFFF"
  const borderC  = isDark ? "#1C1C1E" : "#E8E8E8"
  const active   = "#00b4d8"
  const inactive = isDark ? "#636366" : "#8E8E93"

  const isActive = (section: string) =>
    section === "app"
      ? pathname === "/(app)/app"
      : pathname.includes(section)

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safeArea, { backgroundColor: barBg, borderTopColor: borderC }]}
    >
      <View style={styles.bar}>
        {TABS.map(({ path, section, Icon, label }) => {
          const on = isActive(section)
          const color = on ? active : inactive
          return (
            <Link key={path} href={path as any} asChild>
              <TouchableOpacity style={styles.tab} activeOpacity={0.6}>
                <Icon color={color} />
                <Text style={[styles.label, { color }]}>{label}</Text>
              </TouchableOpacity>
            </Link>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
  bar: {
    flexDirection: "row",
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
})
