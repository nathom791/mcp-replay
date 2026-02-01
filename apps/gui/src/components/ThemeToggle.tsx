import clsx from "clsx"

import { Moon, Sun, Monitor } from "lucide-react"

import { useTheme } from "../theme/useTheme"
import type { ThemeMode } from "../theme/theme"

const options: Array<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
  { mode: "system", label: "System", Icon: Monitor },
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
]

export const ThemeToggle = () => {
  const { mode, setMode } = useTheme()

  return (
    <div className="flex items-center rounded-full border border-border1/10 bg-surface3/70 p-1">
      {options.map(({ mode: optionMode, label, Icon }) => (
        <button
          key={optionMode}
          type="button"
          onClick={() => setMode(optionMode)}
          className={clsx(
            "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition duration-ui ease-ease-out",
            mode === optionMode
              ? "bg-surface1 text-text1 shadow-pressed"
              : "text-text2 hover:bg-ink/5 hover:text-text1",
          )}
          aria-pressed={mode === optionMode}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}
