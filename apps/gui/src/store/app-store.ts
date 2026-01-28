import { create } from "zustand"

import type { ServerConfig } from "@opencode/core"

export type NavSection = "library" | "sessions" | "mcp" | "settings"

type AppState = {
  navSection: NavSection
  selectedSessionId?: string
  selectedToolCallId?: string
  serverConfig?: ServerConfig
  connectionStatus: "disconnected" | "connecting" | "connected"
  mcpServers: string[]
  setNavSection: (navSection: NavSection) => void
  setSelectedSessionId: (id?: string) => void
  setSelectedToolCallId: (id?: string) => void
  setServerConfig: (config?: ServerConfig) => void
  setConnectionStatus: (status: AppState["connectionStatus"]) => void
  setMcpServers: (servers: string[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  navSection: "sessions",
  selectedSessionId: undefined,
  selectedToolCallId: undefined,
  serverConfig: undefined,
  connectionStatus: "disconnected",
  mcpServers: [],
  setNavSection: (navSection) => set({ navSection }),
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setSelectedToolCallId: (selectedToolCallId) => set({ selectedToolCallId }),
  setServerConfig: (serverConfig) => set({ serverConfig }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setMcpServers: (mcpServers) => set({ mcpServers }),
}))
