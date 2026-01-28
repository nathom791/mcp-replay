import { invoke } from "@tauri-apps/api/core"

import type {
  McpConfigMap,
  McpToolDefinition,
  McpToolResult,
} from "@opencode/core"

export const setMcpConfigs = async (configs: McpConfigMap) =>
  invoke<void>("mcp_set_configs", { configs })

export const listMcpTools = async (serverName: string) =>
  invoke<McpToolDefinition[]>("mcp_list_tools", { serverName })

export const callMcpTool = async (
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
) =>
  invoke<McpToolResult>("mcp_call_tool", {
    serverName,
    toolName,
    arguments: args,
  })
