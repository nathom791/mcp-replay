import { Library, ListChecks, Plug, Settings } from "lucide-react"
import clsx from "clsx"

import { useAppStore, type NavSection } from "../store/app-store"

const navItems: Array<{
  id: NavSection
  label: string
  description: string
  icon: typeof Library
}> = [
  {
    id: "library",
    label: "Libraries",
    description: "Recorded sessions",
    icon: Library,
  },
  {
    id: "sessions",
    label: "Sessions",
    description: "Live OpenCode",
    icon: ListChecks,
  },
  {
    id: "mcp",
    label: "MCP Servers",
    description: "Tools + status",
    icon: Plug,
  },
  {
    id: "settings",
    label: "Settings",
    description: "App + safety",
    icon: Settings,
  },
]

export const Sidebar = () => {
  const navSection = useAppStore((state) => state.navSection)
  const setNavSection = useAppStore((state) => state.setNavSection)

  return (
    <aside className="flex h-full w-72 flex-col gap-6 border-r border-black/5 bg-white/60 px-6 py-8">
      <div className="space-y-1">
        <p className="font-display text-xl text-ink">OpenCode Replay</p>
        <p className="text-sm text-black/60">Session capture + MCP playback</p>
      </div>
      <nav className="space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setNavSection(item.id)}
              className={clsx(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
                navSection === item.id
                  ? "bg-ink text-white shadow-panel"
                  : "bg-white/70 text-ink hover:bg-white",
              )}
            >
              <Icon size={18} />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p
                  className={clsx(
                    "text-xs",
                    navSection === item.id ? "text-white/70" : "text-black/50",
                  )}
                >
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}
      </nav>
      <div className="mt-auto rounded-2xl bg-white/70 p-4 text-xs text-black/60">
        Capture tool calls live from OpenCode, then replay them without running a model.
      </div>
    </aside>
  )
}
