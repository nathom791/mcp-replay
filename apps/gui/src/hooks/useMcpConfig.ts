import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import type { McpConfigMap } from "@opencode/core"
import { getConfig } from "@opencode/opencode-client"
import { setMcpConfigs } from "@opencode/mcp-client"
import { useAppStore } from "../store/app-store"

export const useMcpConfig = () => {
  const serverConfig = useAppStore((state) => state.serverConfig)
  const setMcpServers = useAppStore((state) => state.setMcpServers)

  const query = useQuery<McpConfigMap>({
    queryKey: ["mcp-config"],
    queryFn: getConfig,
    enabled: Boolean(serverConfig),
  })

  useEffect(() => {
    if (!query.data) return
    const servers = Object.keys(query.data)
    setMcpServers(servers)
    setMcpConfigs(query.data).catch(() => undefined)
  }, [query.data, setMcpServers])

  return query
}
