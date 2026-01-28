import { create } from "zustand"

import type {
  OpenCodeEvent,
  OpenCodeMessageWithParts,
  OpenCodePart,
  RecordedToolCall,
} from "@opencode/core"
import { extractRecordedToolCalls } from "@opencode/core"

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
    if (!payload || typeof payload !== "object" || !("type" in payload)) {
      return
    }
    if (payload.type === "message.part.updated") {
      const part = (payload as { properties: { part: OpenCodePart } }).properties.part
      const sessionId = part.sessionID
      const messages = get().messagesBySession[sessionId] ?? []
      const nextMessages = messages.map((message) => {
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
      const finalMessages = hasMessage
        ? nextMessages
        : [
            ...nextMessages,
            {
              info: {
                id: part.messageID,
                sessionID: sessionId,
                role: "assistant",
                time: { created: Date.now() },
              },
              parts: [part],
            },
          ]
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
    if (payload.type === "message.part.removed") {
      const info = payload as {
        properties: { sessionID: string; messageID: string; partID: string }
      }
      const { sessionID, messageID, partID } = info.properties
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
