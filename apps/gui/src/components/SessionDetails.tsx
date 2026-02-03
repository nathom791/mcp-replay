import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, FileText, Send } from "lucide-react"

import type {
  OpenCodeMessageWithParts,
  OpenCodeSession,
  RecordedMessage,
  RecordedSession,
  ReplayRun,
} from "@opencode/core"
import { callMcpTool } from "@opencode/mcp-client"
import { saveRecordedSession, saveReplayRun } from "@opencode/storage"
import { useSendMessage, useSessionMessages } from "../hooks/useOpencode"
import { useAppStore } from "../store/app-store"
import { useRecorderStore } from "../store/recorder-store"
import { diffToolResults } from "../lib/replay"
import { ReplayControls } from "./ReplayControls"
import { TranscriptModal } from "./TranscriptModal"
import { ToolTimeline } from "./ToolTimeline"

const extractMessageContent = (message: OpenCodeMessageWithParts) => {
  const parts = message.parts.filter(
    (part) => part.type === "text" || part.type === "reasoning",
  )
  return parts
    .map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean)
    .join("\n")
}

type RecordStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; savedAt: number }
  | { state: "error"; message: string }

export const SessionDetails = ({
  session,
  sessionsLoading = false,
}: {
  session?: OpenCodeSession
  sessionsLoading?: boolean
}) => {
  const queryClient = useQueryClient()
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const mcpServers = useAppStore((state) => state.mcpServers)
  const setSelectedSessionId = useAppStore((state) => state.setSelectedSessionId)
  const setSelectedToolCallId = useAppStore((state) => state.setSelectedToolCallId)
  const {
    data: messages = [],
    isError: messagesError,
    error: messagesErrorValue,
    isSuccess: messagesSuccess,
  } = useSessionMessages(selectedSessionId)
  const setMessages = useRecorderStore((state) => state.setMessages)
  const toolCalls = useRecorderStore((state) =>
    selectedSessionId ? state.toolCallsBySession[selectedSessionId] ?? [] : [],
  )
  const updateToolCall = useRecorderStore((state) => state.updateToolCall)
  const { mutateAsync: sendMessage } = useSendMessage()

  const [prompt, setPrompt] = useState("")
  const [mode, setMode] = useState<ReplayRun["mode"]>("simulated")
  const [isRunning, setIsRunning] = useState(false)
  const [recordStatus, setRecordStatus] = useState<RecordStatus>({ state: "idle" })
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)
  const messagesErrorText = useMemo(() => {
    if (!messagesErrorValue) return "Unknown error"
    if (messagesErrorValue instanceof Error) return messagesErrorValue.message
    return String(messagesErrorValue)
  }, [messagesErrorValue])

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) =>
        Array.isArray(message.parts) ? message : { ...message, parts: [] },
      ),
    [messages],
  )

  useEffect(() => {
    if (selectedSessionId && messagesSuccess) {
      setMessages(selectedSessionId, normalizedMessages, mcpServers)
    }
  }, [selectedSessionId, messagesSuccess, normalizedMessages, mcpServers, setMessages])

  useEffect(() => {
    setRecordStatus({ state: "idle" })
  }, [selectedSessionId])

  useEffect(() => {
    setIsTranscriptOpen(false)
  }, [selectedSessionId])

  useEffect(() => {
    if (recordStatus.state !== "saved") return
    const timeoutId = window.setTimeout(() => {
      setRecordStatus({ state: "idle" })
    }, 2500)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [recordStatus])

  const handleSend = async () => {
    if (!selectedSessionId || !prompt.trim()) return
    await sendMessage({ sessionId: selectedSessionId, text: prompt })
    setPrompt("")
  }

  const recordSession = async () => {
    if (!session || !selectedSessionId || !messagesSuccess) return
    setRecordStatus({ state: "saving" })
    const recordedSession: RecordedSession = {
      id: crypto.randomUUID(),
      opencodeSessionId: session.id,
      title: session.title ?? "Untitled session",
      source: "live",
      createdAt: session.time.created,
      updatedAt: session.time.updated,
    }
    const recordedMessages: RecordedMessage[] = normalizedMessages.map((message) => ({
      id: message.info.id,
      opencodeSessionId: session.id,
      role: message.info.role,
      content: extractMessageContent(message),
      createdAt: message.info.time.created,
    }))
    try {
      await saveRecordedSession({
        session: recordedSession,
        messages: recordedMessages,
        toolCalls,
      })
      await queryClient.invalidateQueries({ queryKey: ["recorded-sessions"] })
      setRecordStatus({ state: "saved", savedAt: Date.now() })
    } catch (error) {
      setRecordStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const runReplay = async () => {
    if (!selectedSessionId || !session) return
    setIsRunning(true)
    const runId = crypto.randomUUID()
    const runToolCalls: ReplayRun["toolCalls"] = []

    for (const toolCall of toolCalls) {
      const callId = crypto.randomUUID()
      if (toolCall.disabled || toolCall.toolKind !== "mcp") {
        runToolCalls.push({
          id: callId,
          recordedToolCallId: toolCall.id,
          status: "skipped",
        })
        continue
      }

      if (mode === "simulated") {
        runToolCalls.push({
          id: callId,
          recordedToolCallId: toolCall.id,
          status: "success",
          liveResultJson: toolCall.recordedResultJson,
        })
        continue
      }

      if (!toolCall.mcpServerName) {
        runToolCalls.push({
          id: callId,
          recordedToolCallId: toolCall.id,
          status: "error",
        })
        continue
      }

      const startedAt = Date.now()
      try {
        const liveResult = await callMcpTool(
          toolCall.mcpServerName,
          toolCall.toolName,
          toolCall.argumentsJson,
        )
        const diffJson = mode === "verify" ? diffToolResults(toolCall.recordedResultJson, liveResult) : undefined
        updateToolCall(selectedSessionId, toolCall.id, (call) => ({
          ...call,
          liveResultJson: liveResult,
          diffJson,
        }))
        runToolCalls.push({
          id: callId,
          recordedToolCallId: toolCall.id,
          status: "success",
          startedAt,
          completedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          liveResultJson: liveResult,
          diffJson,
        })
      } catch (error) {
        runToolCalls.push({
          id: callId,
          recordedToolCallId: toolCall.id,
          status: "error",
          startedAt,
          completedAt: Date.now(),
          durationMs: Date.now() - startedAt,
        })
      }
    }

    const run: ReplayRun = {
      id: runId,
      recordedSessionId: selectedSessionId,
      mode,
      createdAt: Date.now(),
      completedAt: Date.now(),
      summary: {
        total: toolCalls.length,
        skipped: runToolCalls.filter((call) => call.status === "skipped").length,
        errors: runToolCalls.filter((call) => call.status === "error").length,
      },
      toolCalls: runToolCalls,
    }
    await saveReplayRun(run)
    setIsRunning(false)
  }

  const stopReplay = () => {
    setIsRunning(false)
  }

  const sessionTitle = useMemo(() => {
    if (!session) return "Select a session"
    return session.title || "Untitled session"
  }, [session])

  const clearSelection = () => {
    setSelectedSessionId(undefined)
    setSelectedToolCallId(undefined)
  }

  const isRecording = recordStatus.state === "saving"
  const canRecord = Boolean(session && selectedSessionId && messagesSuccess)
  const recordHint = !session
    ? "Loading session details..."
    : !messagesSuccess
      ? "Loading session messages..."
      : null

  if (!selectedSessionId) {
    return (
      <section className="panel-bg flex h-full flex-col items-center justify-center rounded-3xl p-6 text-center">
        <p className="text-lg font-semibold">Pick a session</p>
        <p className="mt-2 text-sm text-text3">
          Select an OpenCode session to view messages and tool calls.
        </p>
      </section>
    )
  }

  if (!session && !sessionsLoading) {
    return (
      <section className="panel-bg flex h-full flex-col items-center justify-center rounded-3xl p-6 text-center">
        <p className="text-lg font-semibold">Session unavailable</p>
        <p className="mt-2 text-sm text-text3">
          We couldn&apos;t load this session. It may have been removed or the server
          is unavailable.
        </p>
        <button
          onClick={clearSelection}
          className="mt-4 rounded-full border border-border1/10 bg-surface3/70 px-4 py-2 text-xs font-semibold text-text1 transition duration-ui ease-ease-out hover:bg-surface3"
        >
          Back to sessions
        </button>
      </section>
    )
  }

  if (messagesError) {
    return (
      <section className="panel-bg flex h-full flex-col items-center justify-center rounded-3xl p-6 text-center">
        <p className="text-lg font-semibold">Session load failed</p>
        <p className="mt-2 text-sm text-text3">
          {`Unable to load messages. ${messagesErrorText}`}
        </p>
        <button
          onClick={clearSelection}
          className="mt-4 rounded-full border border-border1/10 bg-surface3/70 px-4 py-2 text-xs font-semibold text-text1 transition duration-ui ease-ease-out hover:bg-surface3"
        >
          Back to sessions
        </button>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="panel-bg flex flex-wrap items-center justify-between gap-4 rounded-3xl p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text3">Session</p>
          <p className="text-lg font-semibold text-text1">{sessionTitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReplayControls
            mode={mode}
            onModeChange={setMode}
            onRun={runReplay}
            onStop={stopReplay}
            isRunning={isRunning}
          />
          <button
            type="button"
            onClick={() => setIsTranscriptOpen(true)}
            className="flex items-center gap-2 rounded-full border border-border1/10 bg-surface3/70 px-4 py-2 text-xs font-semibold text-text1 transition duration-ui ease-ease-out hover:bg-surface3"
            aria-haspopup="dialog"
            aria-expanded={isTranscriptOpen}
          >
            <FileText size={14} />
            Transcript
          </button>
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={recordSession}
              disabled={!canRecord || isRecording}
              className="flex items-center gap-2 rounded-full border border-border1/10 bg-surface3/70 px-4 py-2 text-xs font-semibold text-text1 transition duration-ui ease-ease-out hover:bg-surface3 disabled:opacity-60"
            >
              <Download size={14} />
              {isRecording ? "Recording" : "Record session"}
            </button>
            {recordStatus.state === "error" && (
              <p className="text-xs text-danger">
                Save failed: {recordStatus.message}
              </p>
            )}
            {recordStatus.state === "saved" && (
              <p className="text-xs text-moss">Saved to library</p>
            )}
            {recordStatus.state === "idle" && recordHint && (
              <p className="text-xs text-text3">{recordHint}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1">
        <ToolTimeline toolCalls={toolCalls} />
      </div>
      <div className="panel-bg rounded-3xl p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-text3">Send message</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={2}
            className="min-w-[240px] flex-1 rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-sm text-text1 placeholder:text-text3"
            placeholder="Ask OpenCode to use MCP tools..."
          />
          <button
            onClick={handleSend}
            className="flex items-center gap-2 rounded-full bg-cobalt px-4 py-2 text-xs font-semibold text-white transition duration-ui ease-ease-out hover:bg-cobalt-600"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>

      <TranscriptModal
        isOpen={isTranscriptOpen}
        messages={normalizedMessages}
        onClose={() => setIsTranscriptOpen(false)}
      />
    </section>
  )
}
