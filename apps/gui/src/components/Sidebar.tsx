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
    <aside className="flex h-full w-72 flex-col gap-6 border-r border-border1/10 bg-surface2/70 px-6 py-8">
      <div className="space-y-1">
        <p className="font-display text-xl text-text1">OpenCode Replay</p>
        <p className="text-sm text-text3">Session capture + MCP playback</p>
      </div>
      <nav className="space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setNavSection(item.id)}
              className={clsx(
                "ui-focus relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition duration-ui ease-ease-out",
                navSection === item.id
                  ? "bg-cobalt/10 text-text1 ring-1 ring-cobalt/20 before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[2px] before:rounded-r before:bg-cobalt"
                  : "text-text1 hover:bg-surface1/70",
              )}
            >
              <Icon size={18} />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p
                  className={clsx(
                    "text-xs",
                    navSection === item.id ? "text-text2" : "text-text3",
                  )}
                >
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-border1/10 bg-surface1/60 p-4 text-xs text-text2">
        Capture tool calls live from OpenCode, then replay them without running a model.
      </div>
    </aside>
  )
}
