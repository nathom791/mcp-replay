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
      const firstServer = mcpServers[0]
      if (firstServer) setDraftServer(firstServer)
    }
  }, [draftServer, isOpen, mcpServers, toolCall?.toolKind])

  useEffect(() => {
    if (!isOpen) return
    if (!draftToolName) {
      const tools = toolsByServer[draftServer] ?? []
      if (tools.length > 0) {
        const firstTool = tools[0]
        if (firstTool) setDraftToolName(firstTool.name)
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="overlay-glass w-full max-w-3xl rounded-3xl p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-call-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text3">Tool request</p>
            <h2 id="tool-call-modal-title" className="text-lg font-semibold text-text1">
              {toolCall.toolName}
            </h2>
            <p className="text-xs text-text3">
              {toolCall.mcpServerName ?? "builtin"} · {toolCall.status}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ui-focus rounded-full border border-border1/10 bg-surface1/40 p-2 text-text2 transition duration-ui ease-ease-out hover:bg-surface1/70 hover:text-text1"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!isEditable && (
          <div className="mt-4 rounded-2xl border border-ember/25 bg-ember/10 px-4 py-3 text-xs text-ember">
            This tool call is not an MCP request and cannot be edited.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] uppercase tracking-[0.2em] text-text3">
              Server
            </label>
            <select
              value={draftServer}
              onChange={(event) => setDraftServer(event.target.value)}
              disabled={!isEditable}
              className={clsx(
                "ui-focus rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-xs text-text1",
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
              <p className="text-[0.65rem] text-text3">
                Connect to OpenCode to load MCP servers.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] uppercase tracking-[0.2em] text-text3">
              Tool
            </label>
            <select
              value={draftToolName}
              onChange={(event) => setDraftToolName(event.target.value)}
              disabled={!isEditable || !draftServer}
              className={clsx(
                "ui-focus rounded-2xl border border-border1/10 bg-surface3/80 px-3 py-2 text-xs text-text1",
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
              <p className="text-[0.65rem] text-text3">
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
            className="h-4 w-4 rounded border border-border1/20 accent-cobalt"
          />
          <label htmlFor="tool-call-disabled" className="text-xs text-text2">
            Disable this call during replay
          </label>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-text3">Arguments</p>
            {parseError && (
              <span className="text-xs text-danger">{parseError}</span>
            )}
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border2/15 bg-surface3/80">
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
          <p className="text-xs text-text3">
            Changes stay local until you save the session.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-border1/10 bg-surface3/70 px-4 py-2 text-xs font-semibold text-text1 transition duration-ui ease-ease-out hover:bg-surface3"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-full bg-cobalt px-4 py-2 text-xs font-semibold text-white transition duration-ui ease-ease-out hover:bg-cobalt-600 disabled:opacity-60"
            >
              Save request
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
