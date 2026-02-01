import type { ReactNode } from "react"
import { createContext, useCallback, useEffect, useMemo, useState } from "react"

import {
  applyThemeToDom,
  getInitialThemeMode,
  getResolvedTheme,
  setThemeMode,
  subscribeToSystemTheme,
  type ThemeMode,
} from "./theme"
import type { ThemeState } from "./useTheme"

export const ThemeContext = createContext<ThemeState | null>(null)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => getInitialThemeMode())
  const resolved = useMemo(() => getResolvedTheme(mode), [mode])

  useEffect(() => {
    applyThemeToDom(resolved)
  }, [resolved])

  useEffect(() => {
    if (mode !== "system") return
    return subscribeToSystemTheme(() => {
      applyThemeToDom(getResolvedTheme("system"))
    })
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setThemeMode(next)
    setModeState(next)
  }, [])

  const value = useMemo<ThemeState>(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
