import clsx from "clsx"

import type { RecordedToolCall } from "@opencode/core"
import { formatDurationMs } from "../lib/format"
import { useAppStore } from "../store/app-store"

export const ToolTimeline = ({ toolCalls }: { toolCalls: RecordedToolCall[] }) => {
  const selectedToolCallId = useAppStore((state) => state.selectedToolCallId)
  const setSelectedToolCallId = useAppStore((state) => state.setSelectedToolCallId)

  return (
    <section className="panel-bg flex h-full flex-col rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Tool timeline</p>
        <span className="text-xs text-text3">{toolCalls.length} calls</span>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-[44px_minmax(100px,1fr)_minmax(140px,1.4fr)_100px_100px] gap-2 px-3 pb-2 text-[0.65rem] uppercase tracking-[0.2em] text-text3">
          <span>#</span>
          <span>Server</span>
          <span>Tool</span>
          <span>Status</span>
          <span className="text-right">Duration</span>
        </div>

        <div className="space-y-2">
          {toolCalls.map((toolCall) => (
            <button
              key={toolCall.id}
              type="button"
              onClick={() => setSelectedToolCallId(toolCall.id)}
              className={clsx(
                "ui-focus relative grid w-full min-w-0 grid-cols-[44px_minmax(100px,1fr)_minmax(140px,1.4fr)_100px_100px] items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs transition duration-ui ease-ease-out",
                toolCall.disabled && "opacity-70",
                selectedToolCallId === toolCall.id
                  ? "border-cobalt/30 bg-cobalt/10 pl-4 ring-1 ring-cobalt/20 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-r before:bg-cobalt"
                  : "border-border1/10 bg-surface1/65 hover:bg-surface1/90",
              )}
            >
              <span className="font-semibold">{toolCall.sequenceIndex + 1}</span>
              <span className="truncate text-text2" title={toolCall.mcpServerName ?? "builtin"}>
                {toolCall.mcpServerName ?? "builtin"}
              </span>
              <span className="truncate" title={toolCall.toolName}>
                {toolCall.toolName}
              </span>
              <span className="capitalize text-text2">{toolCall.status}</span>
              <span className="text-right text-text2">
                {formatDurationMs(toolCall.timing?.durationMs)}
              </span>
            </button>
          ))}

          {toolCalls.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border1/15 bg-surface1/40 py-4 text-center text-xs text-text3">
              No tool calls captured yet.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
