import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"

import { Sidebar } from "./components/Sidebar"
import { Inspector } from "./components/Inspector"
import { useEventStream } from "./hooks/useEventStream"
import { useServerConfigQuery } from "./hooks/useOpencode"
import { useAppStore } from "./store/app-store"
import { LibraryView } from "./views/LibraryView"
import { McpView } from "./views/McpView"
import { SessionsView } from "./views/SessionsView"
import { SettingsView } from "./views/SettingsView"

const App = () => {
  const navSection = useAppStore((state) => state.navSection)
  const setNavSection = useAppStore((state) => state.setNavSection)
  const setSelectedSessionId = useAppStore((state) => state.setSelectedSessionId)
  const setSelectedToolCallId = useAppStore((state) => state.setSelectedToolCallId)
  const setServerConfig = useAppStore((state) => state.setServerConfig)
  const { data: serverConfig } = useServerConfigQuery()

  useEventStream()

  useEffect(() => {
    if (serverConfig) {
      setServerConfig(serverConfig)
    }
  }, [serverConfig, setServerConfig])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen("app:go-home", () => {
      setNavSection("sessions")
      setSelectedSessionId(undefined)
      setSelectedToolCallId(undefined)
    })
      .then((cleanup) => {
        unlisten = cleanup
      })
      .catch(() => undefined)

    return () => {
      unlisten?.()
    }
  }, [setNavSection, setSelectedSessionId, setSelectedToolCallId])

  return (
    <div className="flex min-h-screen text-text1">
      <Sidebar />
      <div className="flex min-w-0 flex-1">
        <main className="min-w-0 flex-1 p-6">
          {navSection === "sessions" && <SessionsView />}
          {navSection === "library" && <LibraryView />}
          {navSection === "mcp" && <McpView />}
          {navSection === "settings" && <SettingsView />}
        </main>
        {navSection === "sessions" && <Inspector />}
      </div>
    </div>
  )
}

export default App
