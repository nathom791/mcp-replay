export type ThemeMode = "system" | "light" | "dark"

const STORAGE_KEY = "opencode.themeMode"

const getSystemTheme = (): Exclude<ThemeMode, "system"> =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

export const getInitialThemeMode = (): ThemeMode => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === "light" || raw === "dark" || raw === "system") return raw
  return "system"
}

export const getResolvedTheme = (mode: ThemeMode): Exclude<ThemeMode, "system"> =>
  mode === "system" ? getSystemTheme() : mode

export const applyThemeToDom = (resolved: Exclude<ThemeMode, "system">): void => {
  document.documentElement.dataset.theme = resolved
}

export const setThemeMode = (mode: ThemeMode): void => {
  window.localStorage.setItem(STORAGE_KEY, mode)
}

export const subscribeToSystemTheme = (onChange: () => void): (() => void) => {
  const query = window.matchMedia("(prefers-color-scheme: dark)")
  const handler = () => onChange()

  // Safari compat
  if ("addEventListener" in query) {
    query.addEventListener("change", handler)
    return () => query.removeEventListener("change", handler)
  }

  const legacy = query as unknown as {
    addListener: (listener: (event: MediaQueryListEvent) => void) => void
    removeListener: (listener: (event: MediaQueryListEvent) => void) => void
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  legacy.addListener(handler)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return () => legacy.removeListener(handler)
}
