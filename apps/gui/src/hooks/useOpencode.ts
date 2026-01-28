import { useMutation, useQuery } from "@tanstack/react-query"

import type {
  OpenCodeMessageWithParts,
  OpenCodeSession,
  ServerConfig,
} from "@opencode/core"
import {
  createSession,
  getServerConfig,
  listSessionMessages,
  listSessions,
  sendMessage,
  setServerConfig,
} from "@opencode/opencode-client"

export const useServerConfigQuery = () =>
  useQuery<ServerConfig | null>({
    queryKey: ["server-config"],
    queryFn: getServerConfig,
  })

export const useSetServerConfig = () =>
  useMutation({
    mutationFn: (config: ServerConfig) => setServerConfig(config),
  })

export const useSessions = () =>
  useQuery<OpenCodeSession[]>({
    queryKey: ["sessions"],
    queryFn: listSessions,
  })

export const useSessionMessages = (sessionId?: string) =>
  useQuery<OpenCodeMessageWithParts[]>({
    queryKey: ["session-messages", sessionId],
    queryFn: () => listSessionMessages(sessionId ?? ""),
    enabled: Boolean(sessionId),
  })

export const useCreateSession = () =>
  useMutation({
    mutationFn: (title?: string) => createSession(title),
  })

export const useSendMessage = () =>
  useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) =>
      sendMessage(sessionId, text),
  })
