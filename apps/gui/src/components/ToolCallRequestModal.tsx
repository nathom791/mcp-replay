import { useEffect, useMemo, useState } from "react"
import { Editor } from "@monaco-editor/react"
import clsx from "clsx"
import { X } from "lucide-react"

import type { McpToolDefinition, RecordedToolCall } from "@opencode/core"

type ToolCallRequestUpdate = {
  toolCallId: string
  mcpServerName?: string
  toolName: string
  argumentsJson: Record<string, unknown>
  disabled?: boolean
}

export const ToolCallRequestModal = ({
  isOpen,
  toolCall,
  mcpServers,
  toolsByServer,
  onClose,
  onSave,
}: {
  isOpen: boolean
  toolCall?: RecordedToolCall
  mcpServers: string[]
  toolsByServer: Record<string, McpToolDefinition[]>
  onClose: () => void
  onSave: (update: ToolCallRequestUpdate) => void
}) => {
  const [draftServer, setDraftServer] = useState("")
  const [draftToolName, setDraftToolName] = useState("")
  const [draftArguments, setDraftArguments] = useState("{}")
  const [draftDisabled, setDraftDisabled] = useState(false)

  useEffect(() => {
    if (!isOpen || !toolCall) return
    setDraftServer(toolCall.mcpServerName ?? "")
    setDraftToolName(toolCall.toolName)
    setDraftArguments(JSON.stringify(toolCall.argumentsJson ?? {}, null, 2))
    setDraftDisabled(Boolean(toolCall.disabled))
  }, [isOpen, toolCall?.id])

  useEffect(() => {
    if (!isOpen) return
    if (toolCall?.toolKind !== "mcp") return
    if (!draftServer && mcpServers.length > 0) {
      setDraftServer(mcpServers[0])
    }
  }, [draftServer, isOpen, mcpServers, toolCall?.toolKind])

  useEffect(() => {
    if (!isOpen) return
    if (!draftToolName) {
      const tools = toolsByServer[draftServer] ?? []
      if (tools.length > 0) {
        setDraftToolName(tools[0].name)
      }
    }
  }, [draftServer, draftToolName, isOpen, toolsByServer])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  const toolsForServer = useMemo(
    () => (draftServer ? toolsByServer[draftServer] ?? [] : []),
    [draftServer, toolsByServer],
  )

  const serverOptions = useMemo(() => {
    if (!draftServer) return mcpServers
    if (mcpServers.includes(draftServer)) return mcpServers
    return [draftServer, ...mcpServers]
  }, [draftServer, mcpServers])

  const toolOptions = useMemo(() => {
    const names = toolsForServer.map((tool) => tool.name)
    if (draftToolName && !names.includes(draftToolName)) {
      return [draftToolName, ...names]
    }
    return names
  }, [draftToolName, toolsForServer])

  const { parsedArguments, parseError } = useMemo(() => {
    if (!isOpen) {
      return { parsedArguments: null, parseError: null }
    }
    const trimmed = draftArguments.trim()
    if (!trimmed) {
      return { parsedArguments: null, parseError: "Arguments cannot be empty." }
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          parsedArguments: null,
          parseError: "Arguments must be a JSON object.",
        }
      }
      return {
        parsedArguments: parsed as Record<string, unknown>,
        parseError: null,
      }
    } catch (error) {
      return { parsedArguments: null, parseError: "Arguments must be valid JSON." }
    }
  }, [draftArguments, isOpen])

  if (!isOpen || !toolCall) return null

  const isEditable = toolCall.toolKind === "mcp"
  const canSave =
    isEditable &&
    Boolean(draftServer) &&
    Boolean(draftToolName) &&
    Boolean(parsedArguments) &&
    !parseError

  const handleSave = () => {
    if (!parsedArguments) return
    onSave({
      toolCallId: toolCall.id,
      mcpServerName: draftServer || undefined,
      toolName: draftToolName,
      argumentsJson: parsedArguments,
      disabled: draftDisabled,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-black/10 bg-white p-6 shadow-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-call-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/50">Tool request</p>
            <h2 id="tool-call-modal-title" className="text-lg font-semibold text-ink">
              {toolCall.toolName}
            </h2>
            <p className="text-xs text-black/50">
              {toolCall.mcpServerName ?? "builtin"} · {toolCall.status}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 p-2 text-black/50 hover:text-black"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!isEditable && (
          <div className="mt-4 rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
            This tool call is not an MCP request and cannot be edited.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] uppercase tracking-[0.2em] text-black/40">
              Server
            </label>
            <select
              value={draftServer}
              onChange={(event) => setDraftServer(event.target.value)}
              disabled={!isEditable}
              className={clsx(
                "rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs",
                !isEditable && "opacity-60",
              )}
            >
              {serverOptions.length === 0 && (
                <option value="">No MCP servers</option>
              )}
              {serverOptions.map((server) => (
                <option key={server} value={server}>
                  {mcpServers.includes(server) ? server : `${server} (offline)`}
                </option>
              ))}
            </select>
            {mcpServers.length === 0 && (
              <p className="text-[0.65rem] text-black/45">
                Connect to OpenCode to load MCP servers.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] uppercase tracking-[0.2em] text-black/40">
              Tool
            </label>
            <select
              value={draftToolName}
              onChange={(event) => setDraftToolName(event.target.value)}
              disabled={!isEditable || !draftServer}
              className={clsx(
                "rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs",
                (!isEditable || !draftServer) && "opacity-60",
              )}
            >
              {toolOptions.length === 0 && (
                <option value="">
                  {draftServer ? "No tools available" : "Select a server"}
                </option>
              )}
              {toolOptions.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
            {draftServer && toolsForServer.length === 0 && (
              <p className="text-[0.65rem] text-black/45">
                This server has no tool definitions loaded.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            id="tool-call-disabled"
            type="checkbox"
            checked={draftDisabled}
            onChange={(event) => setDraftDisabled(event.target.checked)}
            disabled={!isEditable}
            className="h-4 w-4 rounded border border-black/20 text-ink"
          />
          <label htmlFor="tool-call-disabled" className="text-xs text-black/60">
            Disable this call during replay
          </label>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-black/50">Arguments</p>
            {parseError && (
              <span className="text-xs text-[color:var(--ember)]">{parseError}</span>
            )}
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white/80">
            <Editor
              height="240px"
              defaultLanguage="json"
              value={draftArguments}
              onChange={(value) => setDraftArguments(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                scrollBeyondLastLine: false,
                readOnly: !isEditable,
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-black/45">
            Changes stay local until you save the session.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Save request
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
