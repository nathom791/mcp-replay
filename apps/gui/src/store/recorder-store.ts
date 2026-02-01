import { create } from "zustand"

import type {
  OpenCodeEvent,
  OpenCodeMessageWithParts,
  OpenCodePart,
  RecordedToolCall,
} from "@opencode/core"
import { extractRecordedToolCalls } from "@opencode/core"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const getMessagePartFromEvent = (payload: OpenCodeEvent["payload"]): OpenCodePart | null => {
  if (payload.type !== "message.part.updated") return null
  if (!isRecord(payload)) return null
  const properties = payload.properties
  if (!isRecord(properties)) return null
  const part = properties.part
  if (!isRecord(part)) return null
  if (typeof part.id !== "string") return null
  if (typeof part.sessionID !== "string") return null
  if (typeof part.messageID !== "string") return null
  if (typeof part.type !== "string") return null
  return part as OpenCodePart
}

const getRemovedPartInfoFromEvent = (
  payload: OpenCodeEvent["payload"],
): { sessionID: string; messageID: string; partID: string } | null => {
  if (payload.type !== "message.part.removed") return null
  if (!isRecord(payload)) return null
  const properties = payload.properties
  if (!isRecord(properties)) return null
  const sessionID = properties.sessionID
  const messageID = properties.messageID
  const partID = properties.partID
  if (typeof sessionID !== "string") return null
  if (typeof messageID !== "string") return null
  if (typeof partID !== "string") return null
  return { sessionID, messageID, partID }
}

type RecorderState = {
  messagesBySession: Record<string, OpenCodeMessageWithParts[]>
  toolCallsBySession: Record<string, RecordedToolCall[]>
  setMessages: (
    sessionId: string,
    messages: OpenCodeMessageWithParts[],
    mcpServers: string[],
  ) => void
  applyEvent: (event: OpenCodeEvent, mcpServers: string[]) => void
  updateToolCall: (
    sessionId: string,
    toolCallId: string,
    updater: (toolCall: RecordedToolCall) => RecordedToolCall,
  ) => void
}

const upsertPart = (parts: OpenCodePart[], incoming: OpenCodePart) => {
  const index = parts.findIndex((part) => part.id === incoming.id)
  if (index === -1) {
    return [...parts, incoming]
  }
  return parts.map((part, idx) => (idx === index ? incoming : part))
}

export const useRecorderStore = create<RecorderState>((set, get) => ({
  messagesBySession: {},
  toolCallsBySession: {},
  setMessages: (sessionId, messages, mcpServers) => {
    const toolCalls = extractRecordedToolCalls({
      sessionId,
      messages,
      mcpServers,
    })
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
      toolCallsBySession: { ...state.toolCallsBySession, [sessionId]: toolCalls },
    }))
  },
  applyEvent: (event, mcpServers) => {
    const payload = event.payload
    const part = getMessagePartFromEvent(payload)
    if (part) {
      const sessionId = part.sessionID
      const messages = get().messagesBySession[sessionId] ?? []
      const nextMessages: OpenCodeMessageWithParts[] = messages.map((message) => {
        if (message.info.id !== part.messageID) {
          return message
        }
        return {
          ...message,
          parts: upsertPart(message.parts, part),
        }
      })
      const hasMessage = nextMessages.some(
        (message) => message.info.id === part.messageID,
      )
      const newMessage: OpenCodeMessageWithParts = {
        info: {
          id: part.messageID,
          sessionID: sessionId,
          role: "assistant",
          time: { created: Date.now() },
        },
        parts: [part],
      }
      const finalMessages: OpenCodeMessageWithParts[] = hasMessage
        ? nextMessages
        : [...nextMessages, newMessage]
      const toolCalls = extractRecordedToolCalls({
        sessionId,
        messages: finalMessages,
        mcpServers,
      })
      set((state) => ({
        messagesBySession: { ...state.messagesBySession, [sessionId]: finalMessages },
        toolCallsBySession: { ...state.toolCallsBySession, [sessionId]: toolCalls },
      }))
    }
    const removed = getRemovedPartInfoFromEvent(payload)
    if (removed) {
      const { sessionID, messageID, partID } = removed
      const messages = get().messagesBySession[sessionID] ?? []
      const nextMessages = messages.map((message) => {
        if (message.info.id !== messageID) {
          return message
        }
        return {
          ...message,
          parts: message.parts.filter((part) => part.id !== partID),
        }
      })
      const toolCalls = extractRecordedToolCalls({
        sessionId: sessionID,
        messages: nextMessages,
        mcpServers,
      })
      set((state) => ({
        messagesBySession: { ...state.messagesBySession, [sessionID]: nextMessages },
        toolCallsBySession: { ...state.toolCallsBySession, [sessionID]: toolCalls },
      }))
    }
  },
  updateToolCall: (sessionId, toolCallId, updater) => {
    const toolCalls = get().toolCallsBySession[sessionId] ?? []
    const nextToolCalls = toolCalls.map((toolCall) =>
      toolCall.id === toolCallId ? updater(toolCall) : toolCall,
    )
    set((state) => ({
      toolCallsBySession: { ...state.toolCallsBySession, [sessionId]: nextToolCalls },
    }))
  },
}))
