import clsx from "clsx"

import type { RecordedToolCall } from "@opencode/core"
import { formatDurationMs } from "../lib/format"
import { useAppStore } from "../store/app-store"

export const ToolTimeline = ({ toolCalls }: { toolCalls: RecordedToolCall[] }) => {
  const selectedToolCallId = useAppStore((state) => state.selectedToolCallId)
  const setSelectedToolCallId = useAppStore((state) => state.setSelectedToolCallId)

  return (
    <section className="panel-bg flex h-full flex-col rounded-3xl border border-black/5 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Tool timeline</p>
        <span className="text-xs text-black/50">{toolCalls.length} calls</span>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        <table className="w-full text-left text-xs">
          <thead className="text-[0.65rem] uppercase tracking-[0.2em] text-black/40">
            <tr>
              <th className="pb-2">#</th>
              <th className="pb-2">Server</th>
              <th className="pb-2">Tool</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="space-y-2">
            {toolCalls.map((toolCall) => (
              <tr
                key={toolCall.id}
                onClick={() => setSelectedToolCallId(toolCall.id)}
                className={clsx(
                  "cursor-pointer rounded-2xl",
                  selectedToolCallId === toolCall.id
                    ? "bg-ink text-white"
                    : "bg-white/70 text-ink",
                )}
              >
                <td className="px-2 py-2 text-xs font-semibold">
                  {toolCall.sequenceIndex + 1}
                </td>
                <td className="px-2 py-2">
                  {toolCall.mcpServerName ?? "builtin"}
                </td>
                <td className="px-2 py-2">{toolCall.toolName}</td>
                <td className="px-2 py-2 capitalize">{toolCall.status}</td>
                <td className="px-2 py-2 text-right">
                  {formatDurationMs(toolCall.timing?.durationMs)}
                </td>
              </tr>
            ))}
            {toolCalls.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-black/50">
                  No tool calls captured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
