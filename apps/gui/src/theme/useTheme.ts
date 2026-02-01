import { useContext } from "react"

import { ThemeContext } from "./ThemeProvider"
import type { ThemeMode } from "./theme"

export type ThemeState = {
  mode: ThemeMode
  resolved: Exclude<ThemeMode, "system">
  setMode: (mode: ThemeMode) => void
}

export const useTheme = (): ThemeState => {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return value
}
