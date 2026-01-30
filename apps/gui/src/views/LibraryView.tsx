import { useEffect, useMemo, useState } from "react"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import clsx from "clsx"
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react"

import type { McpToolDefinition, RecordedToolCall, ReplayRun } from "@opencode/core"
import { callMcpTool, listMcpTools } from "@opencode/mcp-client"
import {
  getRecordedSessionPayload,
  listRecordedSessions,
  saveReplayRun,
} from "@opencode/storage"
import { useMcpConfig } from "../hooks/useMcpConfig"
import {
  useRecordedSessionPayload,
  useDuplicateRecordedSession,
  useDeleteRecordedSession,
  useReplaceRecordedToolCalls,
} from "../hooks/useRecordedLibrary"
import {
  useAssignSuite,
  useCreateSuite,
  useSessionSuites,
  useSuites,
  useUnassignSuite,
} from "../hooks/useSuites"
import { formatRelativeTime } from "../lib/format"
import { diffToolResults } from "../lib/replay"
import { useAppStore } from "../store/app-store"
import { ToolCallRequestModal } from "../components/ToolCallRequestModal"

const normalizeToolCalls = (toolCalls: RecordedToolCall[]) =>
  toolCalls.map((toolCall, index) => ({
    ...toolCall,
    sequenceIndex: index,
  }))

const formatError = (error: unknown) => {
  if (!error) return "Unknown error"
  if (error instanceof Error) return error.message
  return String(error)
}

type RunSummary = {
  total: number
  skipped: number
  errors: number
}

type SessionRunStatus = {
  state: "idle" | "running" | "success" | "error"
  summary?: RunSummary
  message?: string
}

const replayModes: ReplayRun["mode"][] = ["simulated", "live", "verify"]

type SortableToolCallRowProps = {
  toolCall: RecordedToolCall
  index: number
  total: number
  onOpen: (toolCallId: string) => void
  onMove: (toolCallId: string, direction: -1 | 1) => void
  onDuplicate: (toolCallId: string) => void
  onRemove: (toolCallId: string) => void
}

type DeleteSessionModalProps = {
  isOpen: boolean
  sessionTitle: string
  isBusy: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}

const SortableToolCallRow = ({
  toolCall,
  index,
  total,
  onOpen,
  onMove,
  onDuplicate,
  onRemove,
}: SortableToolCallRowProps) => {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: toolCall.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(toolCall.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(toolCall.id)
        }
      }}
      className={clsx(
        "cursor-pointer rounded-2xl bg-white/70 px-2 py-2 transition-colors duration-200 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        toolCall.disabled && "opacity-70",
        isDragging && "ring-2 ring-ink/30 shadow-panel",
        isOver && "bg-white/80",
      )}
    >
      <div className="grid min-w-0 grid-cols-[36px_40px_minmax(120px,1.1fr)_minmax(160px,1.6fr)_minmax(90px,0.9fr)_140px] items-center gap-2">
        <div className="flex justify-center">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Reorder tool call ${index + 1}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-black/10 text-black/50 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <GripVertical size={14} />
          </button>
        </div>
        <span className="text-xs font-semibold">{index + 1}</span>
        <span className="truncate" title={toolCall.mcpServerName ?? "builtin"}>
          {toolCall.mcpServerName ?? "builtin"}
        </span>
        <span className="truncate" title={toolCall.toolName}>
          {toolCall.toolName}
        </span>
        <span className="capitalize">{toolCall.status}</span>
        <div
          className="flex justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={(event) => {
              event.stopPropagation()
              onMove(toolCall.id, -1)
            }}
            disabled={index === 0}
            className="rounded-full border border-black/10 p-1 text-black/60 disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              onMove(toolCall.id, 1)
            }}
            disabled={index === total - 1}
            className="rounded-full border border-black/10 p-1 text-black/60 disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown size={14} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate(toolCall.id)
            }}
            className="rounded-full border border-black/10 p-1 text-black/60"
            aria-label="Duplicate"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              onRemove(toolCall.id)
            }}
            className="rounded-full border border-black/10 p-1 text-[color:var(--ember)]"
            aria-label="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

const DeleteSessionModal = ({
  isOpen,
  sessionTitle,
  isBusy,
  error,
  onCancel,
  onConfirm,
}: DeleteSessionModalProps) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-6 shadow-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-session-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/50">Delete session</p>
            <h2 id="delete-session-modal-title" className="text-lg font-semibold text-ink">
              {sessionTitle}
            </h2>
            <p className="mt-1 text-xs text-black/50">
              This will permanently remove the session, its tool calls, messages, and replay
              runs.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-full border border-black/10 p-2 text-black/50 hover:text-black disabled:opacity-60"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="mt-4 text-xs text-[color:var(--ember)]">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/70 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isBusy}
            className="flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {isBusy ? "Deleting" : "Delete session"}
          </button>
        </div>
      </div>
    </div>
  )
}

export const LibraryView = () => {
  const queryClient = useQueryClient()
  const { data: sessions = [] } = useQuery({
    queryKey: ["recorded-sessions"],
    queryFn: listRecordedSessions,
  })
  const { data: suites = [] } = useSuites()
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions])
  const { data: sessionSuites = [] } = useSessionSuites(sessionIds)
  const { mutateAsync: createSuite, isPending: isCreatingSuite } = useCreateSuite()
  const { mutateAsync: assignSuite, isPending: isAssigningSuite } = useAssignSuite()
  const { mutateAsync: unassignSuite, isPending: isUnassigningSuite } =
    useUnassignSuite()
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>()
  const {
    data: payload,
    isLoading: payloadLoading,
    isError: payloadError,
    error: payloadErrorValue,
  } = useRecordedSessionPayload(selectedSessionId)
  const { mutateAsync: replaceToolCalls, isPending: isSaving } =
    useReplaceRecordedToolCalls()
  const { mutateAsync: duplicateSession } = useDuplicateRecordedSession()
  const { mutateAsync: deleteSession } = useDeleteRecordedSession()
  const [draftToolCalls, setDraftToolCalls] = useState<RecordedToolCall[]>([])
  const [activeToolCallId, setActiveToolCallId] = useState<string | null>(null)
  const [hasEdits, setHasEdits] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copyingSessionId, setCopyingSessionId] = useState<string | null>(null)
  const [copySessionError, setCopySessionError] = useState<string | null>(null)
  const [deleteSessionError, setDeleteSessionError] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(
    null,
  )
  const [suiteFilter, setSuiteFilter] = useState<string>("all")
  const [newSuiteName, setNewSuiteName] = useState("")
  const [suiteCreateError, setSuiteCreateError] = useState<string | null>(null)
  const [suiteAssignError, setSuiteAssignError] = useState<string | null>(null)
  const [replayMode, setReplayMode] = useState<ReplayRun["mode"]>("simulated")
  const [runningSessionId, setRunningSessionId] = useState<string | null>(null)
  const [isPlayingAll, setIsPlayingAll] = useState(false)
  const [runStatusBySessionId, setRunStatusBySessionId] = useState<
    Record<string, SessionRunStatus>
  >({})
  const [replayError, setReplayError] = useState<string | null>(null)

  useMcpConfig()
  const mcpServers = useAppStore((state) => state.mcpServers)

  const toolQueries = useQueries({
    queries: mcpServers.map((serverName) => ({
      queryKey: ["mcp-tools", serverName],
      queryFn: () => listMcpTools(serverName),
      enabled: Boolean(serverName),
    })),
  })

  const toolsByServer = useMemo(() => {
    const entries: Record<string, McpToolDefinition[]> = {}
    mcpServers.forEach((serverName, index) => {
      entries[serverName] = toolQueries[index]?.data ?? []
    })
    return entries
  }, [mcpServers, toolQueries])

  const activeToolCall = useMemo(() => {
    if (!activeToolCallId) return undefined
    return draftToolCalls.find((call) => call.id === activeToolCallId)
  }, [activeToolCallId, draftToolCalls])

  const [selectedServer, setSelectedServer] = useState("")
  const [selectedToolName, setSelectedToolName] = useState("")

  const toolsForSelectedServer = useMemo(
    () => (selectedServer ? toolsByServer[selectedServer] ?? [] : []),
    [selectedServer, toolsByServer],
  )
  const selectedServerIndex = selectedServer
    ? mcpServers.indexOf(selectedServer)
    : -1
  const selectedToolsLoading =
    selectedServerIndex >= 0 ? toolQueries[selectedServerIndex]?.isLoading ?? false : false

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const suitesById = useMemo(() => {
    const entries: Record<string, string> = {}
    suites.forEach((suite) => {
      entries[suite.id] = suite.name
    })
    return entries
  }, [suites])

  const sessionSuitesBySessionId = useMemo(() => {
    const entries: Record<string, string[]> = {}
    sessionSuites.forEach((entry) => {
      if (!entries[entry.sessionId]) {
        entries[entry.sessionId] = []
      }
      entries[entry.sessionId].push(entry.suiteId)
    })
    return entries
  }, [sessionSuites])

  const filteredSessions = useMemo(() => {
    if (suiteFilter === "all") return sessions
    if (suiteFilter === "unassigned") {
      return sessions.filter(
        (session) => (sessionSuitesBySessionId[session.id] ?? []).length === 0,
      )
    }
    return sessions.filter((session) =>
      (sessionSuitesBySessionId[session.id] ?? []).includes(suiteFilter),
    )
  }, [sessions, suiteFilter, sessionSuitesBySessionId])

  const selectedSessionSuiteIds = useMemo(() => {
    if (!selectedSessionId) return []
    return sessionSuitesBySessionId[selectedSessionId] ?? []
  }, [selectedSessionId, sessionSuitesBySessionId])

  const selectedSessionSuiteSet = useMemo(
    () => new Set(selectedSessionSuiteIds),
    [selectedSessionSuiteIds],
  )

  const selectedSessionSuites = useMemo(
    () =>
      selectedSessionSuiteIds
        .map((suiteId) => suitesById[suiteId])
        .filter((suiteName): suiteName is string => Boolean(suiteName)),
    [selectedSessionSuiteIds, suitesById],
  )

  const isReplayBusy = Boolean(runningSessionId) || isPlayingAll

  useEffect(() => {
    if (!selectedSessionId) return
    const exists = sessions.some((session) => session.id === selectedSessionId)
    if (!exists) {
      setSelectedSessionId(undefined)
    }
    setSuiteAssignError(null)
  }, [selectedSessionId, sessions])

  useEffect(() => {
    setActiveToolCallId(null)
  }, [selectedSessionId])

  useEffect(() => {
    if (suiteFilter === "all" || suiteFilter === "unassigned") return
    const exists = suites.some((suite) => suite.id === suiteFilter)
    if (!exists) {
      setSuiteFilter("all")
    }
  }, [suiteFilter, suites])

  useEffect(() => {
    if (!payload) {
      setDraftToolCalls([])
      setHasEdits(false)
      setSaveError(null)
      setActiveToolCallId(null)
      return
    }
    setDraftToolCalls(normalizeToolCalls(payload.toolCalls))
    setHasEdits(false)
    setSaveError(null)
    setActiveToolCallId(null)
  }, [payload])

  useEffect(() => {
    if (activeToolCallId && !activeToolCall) {
      setActiveToolCallId(null)
    }
  }, [activeToolCallId, activeToolCall])

  useEffect(() => {
    if (mcpServers.length === 0) {
      setSelectedServer("")
      return
    }
    if (!selectedServer || !mcpServers.includes(selectedServer)) {
      setSelectedServer(mcpServers[0])
    }
  }, [mcpServers, selectedServer])

  useEffect(() => {
    if (!selectedServer) {
      setSelectedToolName("")
      return
    }
    if (toolsForSelectedServer.length === 0) {
      setSelectedToolName("")
      return
    }
    const hasTool = toolsForSelectedServer.some(
      (tool) => tool.name === selectedToolName,
    )
    if (!hasTool) {
      setSelectedToolName(toolsForSelectedServer[0].name)
    }
  }, [selectedServer, selectedToolName, toolsForSelectedServer])

  const updateDraft = (updater: (calls: RecordedToolCall[]) => RecordedToolCall[]) => {
    setDraftToolCalls((current) => normalizeToolCalls(updater(current)))
    setHasEdits(true)
    setSaveError(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    updateDraft((calls) => {
      const oldIndex = calls.findIndex((call) => call.id === active.id)
      const newIndex = calls.findIndex((call) => call.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return calls
      return arrayMove(calls, oldIndex, newIndex)
    })
  }

  const setRunStatus = (sessionId: string, status: SessionRunStatus) => {
    setRunStatusBySessionId((current) => ({
      ...current,
      [sessionId]: status,
    }))
  }

  const resolvePayload = async (sessionId: string) => {
    if (payload && sessionId === selectedSessionId) {
      return payload
    }
    return queryClient.fetchQuery({
      queryKey: ["recorded-session-payload", sessionId],
      queryFn: () => getRecordedSessionPayload(sessionId),
    })
  }

  const runRecordedSession = async (sessionId: string, toolCalls: RecordedToolCall[]) => {
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

      if (replayMode === "simulated") {
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
        const diffJson =
          replayMode === "verify"
            ? diffToolResults(toolCall.recordedResultJson, liveResult)
            : undefined
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

    const summary = {
      total: toolCalls.length,
      skipped: runToolCalls.filter((call) => call.status === "skipped").length,
      errors: runToolCalls.filter((call) => call.status === "error").length,
    }

    const run: ReplayRun = {
      id: runId,
      recordedSessionId: sessionId,
      mode: replayMode,
      createdAt: Date.now(),
      completedAt: Date.now(),
      summary,
      toolCalls: runToolCalls,
    }
    await saveReplayRun(run)
    return summary
  }

  const handlePlaySession = async (sessionId: string) => {
    if (isReplayBusy) return
    if (hasEdits && selectedSessionId === sessionId) {
      setReplayError("Save or discard changes before replaying this session.")
      return
    }
    setReplayError(null)
    setRunningSessionId(sessionId)
    setRunStatus(sessionId, { state: "running" })

    try {
      const sessionPayload = await resolvePayload(sessionId)
      const summary = await runRecordedSession(sessionId, sessionPayload.toolCalls)
      setRunStatus(sessionId, {
        state: summary.errors > 0 ? "error" : "success",
        summary,
      })
    } catch (error) {
      setRunStatus(sessionId, { state: "error", message: formatError(error) })
    } finally {
      setRunningSessionId(null)
    }
  }

  const handleCopySession = async (sessionId: string) => {
    if (copyingSessionId) return
    if (hasEdits && selectedSessionId === sessionId) {
      setCopySessionError("Save or discard changes before copying this session.")
      return
    }
    setCopySessionError(null)
    setCopyingSessionId(sessionId)
    try {
      const copied = await duplicateSession({ sessionId })
      await queryClient.invalidateQueries({ queryKey: ["recorded-sessions"] })
      setSelectedSessionId(copied.id)
    } catch (error) {
      setCopySessionError(formatError(error))
    } finally {
      setCopyingSessionId(null)
    }
  }

  const handleOpenDeleteModal = (sessionId: string, title: string) => {
    if (deletingSessionId) return
    setDeleteSessionError(null)
    setDeleteTarget({ id: sessionId, title })
  }

  const handleCloseDeleteModal = () => {
    if (deletingSessionId) return
    setDeleteTarget(null)
    setDeleteSessionError(null)
  }

  const handleConfirmDeleteSession = async () => {
    if (!deleteTarget || deletingSessionId) return
    if (hasEdits && selectedSessionId === deleteTarget.id) {
      setDeleteSessionError("Save or discard changes before deleting this session.")
      return
    }
    setDeleteSessionError(null)
    setDeletingSessionId(deleteTarget.id)
    try {
      await deleteSession(deleteTarget.id)
      if (selectedSessionId === deleteTarget.id) {
        setSelectedSessionId(undefined)
      }
      setDeleteTarget(null)
    } catch (error) {
      setDeleteSessionError(formatError(error))
    } finally {
      setDeletingSessionId(null)
    }
  }

  const handlePlayAll = async () => {
    if (isReplayBusy || filteredSessions.length === 0) return
    if (
      hasEdits &&
      selectedSessionId &&
      filteredSessions.some((session) => session.id === selectedSessionId)
    ) {
      setReplayError("Save or discard changes before replaying sessions.")
      return
    }

    setReplayError(null)
    setIsPlayingAll(true)
    try {
      for (const session of filteredSessions) {
        setRunningSessionId(session.id)
        setRunStatus(session.id, { state: "running" })
        try {
          const sessionPayload = await resolvePayload(session.id)
          const summary = await runRecordedSession(session.id, sessionPayload.toolCalls)
          setRunStatus(session.id, {
            state: summary.errors > 0 ? "error" : "success",
            summary,
          })
        } catch (error) {
          setRunStatus(session.id, { state: "error", message: formatError(error) })
        }
      }
    } finally {
      setRunningSessionId(null)
      setIsPlayingAll(false)
    }
  }

  const handleCreateSuite = async () => {
    const trimmed = newSuiteName.trim()
    if (!trimmed) {
      setSuiteCreateError("Suite name cannot be empty.")
      return
    }
    setSuiteCreateError(null)
    try {
      await createSuite(trimmed)
      setNewSuiteName("")
    } catch (error) {
      setSuiteCreateError(formatError(error))
    }
  }

  const handleToggleSuite = async (suiteId: string) => {
    if (!selectedSessionId) return
    setSuiteAssignError(null)
    try {
      if (selectedSessionSuiteSet.has(suiteId)) {
        await unassignSuite({ sessionId: selectedSessionId, suiteId })
      } else {
        await assignSuite({ sessionId: selectedSessionId, suiteId })
      }
    } catch (error) {
      setSuiteAssignError(formatError(error))
    }
  }

  const formatRunSummary = (summary: RunSummary) =>
    `${summary.total - summary.skipped} ran · ${summary.skipped} skipped · ${summary.errors} errors`

  const handleMove = (toolCallId: string, direction: -1 | 1) => {
    updateDraft((calls) => {
      const index = calls.findIndex((call) => call.id === toolCallId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= calls.length) {
        return calls
      }
      const next = [...calls]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const handleRemove = (toolCallId: string) => {
    updateDraft((calls) => calls.filter((call) => call.id !== toolCallId))
  }

  const handleDuplicateToolCall = (toolCallId: string) => {
    updateDraft((calls) => {
      const index = calls.findIndex((call) => call.id === toolCallId)
      if (index < 0) return calls
      const original = calls[index]
      const next = [...calls]
      next.splice(index + 1, 0, {
        ...original,
        id: crypto.randomUUID(),
      })
      return next
    })
  }

  const handleOpenToolCall = (toolCallId: string) => {
    setActiveToolCallId(toolCallId)
  }

  const handleSaveToolCallRequest = (update: {
    toolCallId: string
    mcpServerName?: string
    toolName: string
    argumentsJson: Record<string, unknown>
    disabled?: boolean
  }) => {
    updateDraft((calls) =>
      calls.map((call) =>
        call.id === update.toolCallId
          ? {
              ...call,
              mcpServerName: update.mcpServerName,
              toolName: update.toolName,
              argumentsJson: update.argumentsJson,
              disabled: update.disabled ?? call.disabled,
            }
          : call,
      ),
    )
    setActiveToolCallId(null)
  }

  const handleAddToolCall = () => {
    if (!payload || !selectedServer || !selectedToolName) return
    const newId = crypto.randomUUID()
    const newMessageId = crypto.randomUUID()
    const newCall: RecordedToolCall = {
      id: newId,
      opencodeSessionId: payload.session.opencodeSessionId,
      messageId: newMessageId,
      sequenceIndex: draftToolCalls.length,
      toolKind: "mcp",
      mcpServerName: selectedServer,
      toolName: selectedToolName,
      argumentsJson: {},
      status: "pending",
      disabled: false,
    }
    updateDraft((calls) => [...calls, newCall])
  }

  const handleSave = async () => {
    if (!selectedSessionId) return
    setSaveError(null)
    try {
      await replaceToolCalls({ sessionId: selectedSessionId, toolCalls: draftToolCalls })
      await queryClient.invalidateQueries({
        queryKey: ["recorded-session-payload", selectedSessionId],
      })
      await queryClient.invalidateQueries({ queryKey: ["recorded-sessions"] })
      setHasEdits(false)
    } catch (error) {
      setSaveError(formatError(error))
    }
  }

  const handleDiscard = () => {
    if (!payload) return
    setDraftToolCalls(normalizeToolCalls(payload.toolCalls))
    setHasEdits(false)
    setSaveError(null)
    setActiveToolCallId(null)
  }

  const payloadErrorText = useMemo(() => formatError(payloadErrorValue), [payloadErrorValue])
  const canAddToolCall = Boolean(
    payload && selectedServer && selectedToolName && !selectedToolsLoading,
  )
  const suiteActionBusy = isAssigningSuite || isUnassigningSuite
  const sessionCountLabel =
    suiteFilter === "all"
      ? `${sessions.length} sessions`
      : `${filteredSessions.length} of ${sessions.length}`

  return (
    <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
      <section className="panel-bg flex h-full flex-col rounded-3xl border border-black/5 p-4 shadow-panel">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Recorded library</p>
          <span className="text-xs text-black/50">{sessionCountLabel}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-black/10 bg-white/80 p-1 text-[0.65rem] uppercase tracking-[0.2em]">
            {replayModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setReplayMode(mode)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs capitalize tracking-normal",
                  replayMode === mode
                    ? "bg-ink text-white"
                    : "text-black/60 hover:text-black",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={handlePlayAll}
            disabled={isReplayBusy || filteredSessions.length === 0}
            className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isPlayingAll ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {isPlayingAll ? "Running all" : "Play all"}
          </button>
        </div>
        {replayError && (
          <p className="mt-2 text-xs text-[color:var(--ember)]">{replayError}</p>
        )}
        {copySessionError && (
          <p className="mt-2 text-xs text-[color:var(--ember)]">{copySessionError}</p>
        )}
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-black/50">Suites</p>
            <span className="text-xs text-black/50">{suites.length}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setSuiteFilter("all")}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold",
                suiteFilter === "all"
                  ? "bg-ink text-white"
                  : "border border-black/10 text-black/60 hover:text-black",
              )}
            >
              All
            </button>
            <button
              onClick={() => setSuiteFilter("unassigned")}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold",
                suiteFilter === "unassigned"
                  ? "bg-ink text-white"
                  : "border border-black/10 text-black/60 hover:text-black",
              )}
            >
              Unassigned
            </button>
            {suites.map((suite) => (
              <button
                key={suite.id}
                onClick={() => setSuiteFilter(suite.id)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  suiteFilter === suite.id
                    ? "bg-ink text-white"
                    : "border border-black/10 text-black/60 hover:text-black",
                )}
              >
                {suite.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={newSuiteName}
              onChange={(event) => setNewSuiteName(event.target.value)}
              placeholder="New suite name"
              className="min-w-[140px] flex-1 rounded-full border border-black/10 bg-white px-3 py-1 text-xs"
            />
            <button
              onClick={handleCreateSuite}
              disabled={isCreatingSuite}
              className="flex items-center gap-1 rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ink disabled:opacity-60"
            >
              <Plus size={14} />
              {isCreatingSuite ? "Creating" : "Create"}
            </button>
          </div>
          {suiteCreateError && (
            <p className="mt-2 text-xs text-[color:var(--ember)]">{suiteCreateError}</p>
          )}
        </div>
        <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          {filteredSessions.map((session) => {
            const suiteNames = (sessionSuitesBySessionId[session.id] ?? [])
              .map((suiteId) => suitesById[suiteId])
              .filter((name): name is string => Boolean(name))
            const runStatus = runStatusBySessionId[session.id]
            const isRunning = runStatus?.state === "running" || runningSessionId === session.id
            const isCopying = copyingSessionId === session.id
            const isDeleting = deletingSessionId === session.id
            const deleteDisabled =
              isReplayBusy || Boolean(copyingSessionId) || Boolean(deletingSessionId)

            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSessionId(session.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedSessionId(session.id)
                  }
                }}
                className={clsx(
                  "flex w-full flex-col gap-2 rounded-2xl px-3 py-2 text-left transition",
                  selectedSessionId === session.id
                    ? "bg-ink text-white"
                    : "bg-white/80 text-ink hover:bg-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-sm font-semibold">
                      {session.title || "Untitled session"}
                    </span>
                    <span
                      className={clsx(
                        "mt-1 block text-xs",
                        selectedSessionId === session.id
                          ? "text-white/70"
                          : "text-black/50",
                      )}
                    >
                      Recorded {formatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handlePlaySession(session.id)
                      }}
                      disabled={isReplayBusy}
                      className={clsx(
                        "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                        selectedSessionId === session.id
                          ? "border border-white/30 text-white"
                          : "border border-black/10 text-black/60",
                        isReplayBusy && "opacity-60",
                      )}
                    >
                      {isRunning ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      {isRunning ? "Running" : "Play"}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handleCopySession(session.id)
                      }}
                      disabled={Boolean(copyingSessionId)}
                      className={clsx(
                        "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                        selectedSessionId === session.id
                          ? "border border-white/30 text-white"
                          : "border border-black/10 text-black/60",
                        Boolean(copyingSessionId) && "opacity-60",
                      )}
                    >
                      {isCopying ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {isCopying ? "Copying" : "Copy"}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handleOpenDeleteModal(
                          session.id,
                          session.title || "Untitled session",
                        )
                      }}
                      disabled={deleteDisabled}
                      className={clsx(
                        "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                        selectedSessionId === session.id
                          ? "border border-white/30 text-[color:var(--ember)]"
                          : "border border-black/10 text-[color:var(--ember)]",
                        deleteDisabled && "opacity-60",
                      )}
                    >
                      {isDeleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      {isDeleting ? "Deleting" : "Delete"}
                    </button>
                  </div>
                </div>
                {suiteNames.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {suiteNames.map((name) => (
                      <span
                        key={name}
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                          selectedSessionId === session.id
                            ? "bg-white/20 text-white"
                            : "bg-black/5 text-black/60",
                        )}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {runStatus && runStatus.state !== "idle" && (
                  <span
                    className={clsx(
                      "text-xs",
                      runStatus.state === "running"
                        ? selectedSessionId === session.id
                          ? "text-white/70"
                          : "text-black/50"
                        : runStatus.state === "error"
                          ? "text-[color:var(--ember)]"
                          : "text-[color:var(--moss)]",
                    )}
                  >
                    {runStatus.state === "running" && "Running replay..."}
                    {runStatus.state === "success" &&
                      runStatus.summary &&
                      formatRunSummary(runStatus.summary)}
                    {runStatus.state === "error" &&
                      (runStatus.summary
                        ? formatRunSummary(runStatus.summary)
                        : runStatus.message ?? "Replay failed")}
                  </span>
                )}
              </div>
            )
          })}
          {sessions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/10 px-3 py-4 text-xs text-black/50">
              No recorded sessions yet. Save a session from the Sessions tab.
            </div>
          )}
          {sessions.length > 0 && filteredSessions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/10 px-3 py-4 text-xs text-black/50">
              No sessions match this suite filter.
            </div>
          )}
        </div>
      </section>

      <section className="panel-bg flex h-full flex-col gap-4 rounded-3xl border border-black/5 p-6 shadow-panel">
        {!selectedSessionId && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">Select a session</p>
            <p className="mt-2 text-sm text-black/50">
              Pick a recorded session to edit the MCP tool timeline.
            </p>
          </div>
        )}

        {selectedSessionId && payloadLoading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">Loading session</p>
            <p className="mt-2 text-sm text-black/50">Fetching stored tool calls...</p>
          </div>
        )}

        {selectedSessionId && payloadError && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">Session unavailable</p>
            <p className="mt-2 text-sm text-black/50">{payloadErrorText}</p>
          </div>
        )}

        {selectedSessionId && payload && !payloadLoading && !payloadError && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/50">Session</p>
                <p className="text-lg font-semibold text-ink">
                  {payload.session.title || "Untitled session"}
                </p>
                <p className="text-xs text-black/50">
                  Updated {formatRelativeTime(payload.session.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!hasEdits || isSaving}
                  className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  <Save size={14} />
                  {isSaving ? "Saving" : "Save changes"}
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={!hasEdits || isSaving}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/70 disabled:opacity-60"
                >
                  <RotateCcw size={14} />
                  Discard
                </button>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-[color:var(--ember)]">Save failed: {saveError}</p>
            )}

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-black/50">Suites</p>
                <span className="text-xs text-black/50">
                  {selectedSessionSuites.length} assigned
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suites.map((suite) => {
                  const isAssigned = selectedSessionSuiteSet.has(suite.id)
                  return (
                    <button
                      key={suite.id}
                      onClick={() => handleToggleSuite(suite.id)}
                      disabled={suiteActionBusy}
                      className={clsx(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        isAssigned
                          ? "bg-ink text-white"
                          : "border border-black/10 text-black/60 hover:text-black",
                        suiteActionBusy && "opacity-60",
                      )}
                    >
                      {suite.name}
                    </button>
                  )
                })}
                {suites.length === 0 && (
                  <p className="text-xs text-black/50">
                    No suites yet. Create one from the library list.
                  </p>
                )}
              </div>
              {suiteAssignError && (
                <p className="mt-2 text-xs text-[color:var(--ember)]">{suiteAssignError}</p>
              )}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                Add tool call
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <label className="text-[0.65rem] uppercase tracking-[0.2em] text-black/40">
                    Server
                  </label>
                  <select
                    value={selectedServer}
                    onChange={(event) => setSelectedServer(event.target.value)}
                    disabled={mcpServers.length === 0}
                    className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                  >
                    {mcpServers.length === 0 && (
                      <option value="">No MCP servers</option>
                    )}
                    {mcpServers.map((server) => (
                      <option key={server} value={server}>
                        {server}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-[220px] flex-[2] flex-col gap-1">
                  <label className="text-[0.65rem] uppercase tracking-[0.2em] text-black/40">
                    Tool
                  </label>
                  <select
                    value={selectedToolName}
                    onChange={(event) => setSelectedToolName(event.target.value)}
                    disabled={!selectedServer || selectedToolsLoading}
                    className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                  >
                    {toolsForSelectedServer.length === 0 && (
                      <option value="">
                        {selectedToolsLoading ? "Loading tools..." : "No tools available"}
                      </option>
                    )}
                    {toolsForSelectedServer.map((tool) => (
                      <option key={tool.name} value={tool.name}>
                        {tool.title ? `${tool.title} (${tool.name})` : tool.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAddToolCall}
                  disabled={!canAddToolCall}
                  className="flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  <Plus size={14} />
                  Add call
                </button>
              </div>
              {mcpServers.length === 0 && (
                <p className="mt-2 text-xs text-black/50">
                  No MCP servers available. Connect to OpenCode to load tools.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Tool calls</p>
              <span className="text-xs text-black/50">
                {draftToolCalls.length} calls
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="text-xs">
                <div className="grid grid-cols-[36px_40px_minmax(120px,1.1fr)_minmax(160px,1.6fr)_minmax(90px,0.9fr)_140px] items-center gap-2 pb-2 text-[0.65rem] uppercase tracking-[0.2em] text-black/40">
                  <span className="sr-only">Reorder</span>
                  <span>#</span>
                  <span>Server</span>
                  <span>Tool</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={draftToolCalls.map((call) => call.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {draftToolCalls.map((toolCall, index) => (
                        <SortableToolCallRow
                          key={toolCall.id}
                          toolCall={toolCall}
                          index={index}
                          total={draftToolCalls.length}
                          onOpen={handleOpenToolCall}
                          onMove={handleMove}
                          onDuplicate={handleDuplicateToolCall}
                          onRemove={handleRemove}
                        />
                      ))}
                      {draftToolCalls.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-black/10 py-4 text-center text-xs text-black/50">
                          No tool calls recorded yet. Add one from the tool picker.
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </>
        )}
      </section>

      <ToolCallRequestModal
        isOpen={Boolean(activeToolCallId)}
        toolCall={activeToolCall}
        mcpServers={mcpServers}
        toolsByServer={toolsByServer}
        onClose={() => setActiveToolCallId(null)}
        onSave={handleSaveToolCallRequest}
      />
      <DeleteSessionModal
        isOpen={Boolean(deleteTarget)}
        sessionTitle={deleteTarget?.title ?? "Untitled session"}
        isBusy={Boolean(deletingSessionId)}
        error={deleteSessionError}
        onCancel={handleCloseDeleteModal}
        onConfirm={handleConfirmDeleteSession}
      />
    </div>
  )
}
