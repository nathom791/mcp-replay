import { invoke } from "@tauri-apps/api/core"

import type {
  McpConfigMap,
  OpenCodeMessageWithParts,
  OpenCodeSession,
  ServerConfig,
} from "@opencode/core"

export const getServerConfig = async () =>
  invoke<ServerConfig | null>("get_server_config")

export const setServerConfig = async (config: ServerConfig) =>
  invoke<ServerConfig>("set_server_config", { config })

export const checkServerHealth = async () =>
  invoke<{ healthy: boolean; version: string }>("opencode_health")

export const listSessions = async () =>
  invoke<OpenCodeSession[]>("opencode_list_sessions")

export const createSession = async (title?: string) =>
  invoke<OpenCodeSession>("opencode_create_session", { title })

export const listSessionMessages = async (sessionId: string) =>
  invoke<OpenCodeMessageWithParts[]>("opencode_list_session_messages", {
    sessionId,
  })

export const sendMessage = async (sessionId: string, text: string) =>
  invoke<OpenCodeMessageWithParts>("opencode_send_message", {
    sessionId,
    text,
  })

export const getConfig = async () => invoke<McpConfigMap>("opencode_get_mcp")

export const startEventStream = async () => invoke<void>("opencode_start_event_stream")

export const stopEventStream = async () => invoke<void>("opencode_stop_event_stream")
