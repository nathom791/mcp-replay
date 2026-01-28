import { useEffect, useMemo, useState } from "react"
import { Editor } from "@monaco-editor/react"
import ReactJson from "react-json-view"

import type { McpToolResult } from "@opencode/core"
import { useAppStore } from "../store/app-store"
import { useRecorderStore } from "../store/recorder-store"

const renderResult = (result?: McpToolResult, title?: string) => {
  if (!result) return null
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-black/50">{title}</p>
      {result.structuredContent && (
        <div className="rounded-2xl border border-black/10 bg-white/80 p-2">
          <ReactJson
            src={result.structuredContent as Record<string, unknown>}
            name={false}
            collapsed={1}
            enableClipboard={false}
            displayDataTypes={false}
            style={{ fontSize: "0.7rem" }}
          />
        </div>
      )}
      {result.content.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs">
          {result.content.map((block, index) => (
            <div key={index}>
              <p className="font-semibold text-black/60">{block.type}</p>
              {block.text && <p className="whitespace-pre-line">{block.text}</p>}
              {block.uri && (
                <p className="text-black/50">Resource: {block.uri}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const Inspector = () => {
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const selectedToolCallId = useAppStore((state) => state.selectedToolCallId)
  const toolCallsBySession = useRecorderStore((state) => state.toolCallsBySession)
  const updateToolCall = useRecorderStore((state) => state.updateToolCall)

  const toolCall = useMemo(() => {
    if (!selectedSessionId) return undefined
    const toolCalls = toolCallsBySession[selectedSessionId] ?? []
    return toolCalls.find((call) => call.id === selectedToolCallId)
  }, [selectedSessionId, selectedToolCallId, toolCallsBySession])

  const [draftArgs, setDraftArgs] = useState("{}")

  useEffect(() => {
    if (!toolCall) {
      setDraftArgs("{}")
      return
    }
    setDraftArgs(JSON.stringify(toolCall.argumentsJson, null, 2))
  }, [toolCall])

  const saveArgs = () => {
    if (!toolCall || !selectedSessionId) return
    try {
      const parsed = JSON.parse(draftArgs)
      updateToolCall(selectedSessionId, toolCall.id, (call) => ({
        ...call,
        argumentsJson: parsed,
      }))
    } catch (error) {
      // ignore parse errors for now
    }
  }

  if (!toolCall) {
    return (
      <aside className="hidden w-96 flex-col border-l border-black/5 bg-white/60 px-6 py-8 xl:flex">
        <p className="text-sm font-semibold">Inspector</p>
        <p className="mt-2 text-xs text-black/50">
          Select a tool call to inspect arguments and results.
        </p>
      </aside>
    )
  }

  return (
    <aside className="hidden w-96 flex-col gap-4 border-l border-black/5 bg-white/60 px-6 py-8 xl:flex">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-black/50">Inspector</p>
        <p className="text-lg font-semibold text-ink">{toolCall.toolName}</p>
        <p className="text-xs text-black/50">
          {toolCall.mcpServerName ?? "builtin"} · {toolCall.status}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-black/50">Arguments</p>
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/80">
          <Editor
            height="220px"
            defaultLanguage="json"
            value={draftArgs}
            onChange={(value) => setDraftArgs(value ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
        <button
          onClick={saveArgs}
          className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
        >
          Save arguments
        </button>
      </div>
      {renderResult(toolCall.recordedResultJson, "Recorded result")}
      {renderResult(toolCall.liveResultJson, "Live result")}
      {toolCall.diffJson && (
        <div className="rounded-2xl border border-black/10 bg-white/80 p-3 text-xs">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Diff</p>
          <ReactJson
            src={toolCall.diffJson as Record<string, unknown>}
            name={false}
            collapsed={1}
            enableClipboard={false}
            displayDataTypes={false}
            style={{ fontSize: "0.7rem" }}
          />
        </div>
      )}
    </aside>
  )
}
