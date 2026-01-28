import clsx from "clsx"

import type { OpenCodeMessageWithParts } from "@opencode/core"

const extractText = (message: OpenCodeMessageWithParts) => {
  const parts = Array.isArray(message.parts) ? message.parts : []
  const textParts = parts.filter(
    (part) => part.type === "text" || part.type === "reasoning",
  )
  if (textParts.length === 0) return "(no text content)"
  return textParts
    .map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean)
    .join("\n")
}

export const ChatTranscript = ({
  messages,
}: {
  messages: OpenCodeMessageWithParts[]
}) => (
  <section className="panel-bg flex h-full flex-col rounded-3xl border border-black/5 p-4 shadow-panel">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold">Transcript</p>
      <span className="text-xs text-black/50">Live snapshot</span>
    </div>
    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      {messages.map((message) => (
        <div
          key={message.info.id}
          className={clsx(
            "rounded-2xl p-3 text-sm",
            message.info?.role === "user"
              ? "bg-white text-ink"
              : "bg-ink text-white",
          )}
        >
          <p className="text-xs uppercase tracking-[0.25em] opacity-70">
            {message.info?.role ?? "assistant"}
          </p>
          <p className="whitespace-pre-line leading-relaxed">{extractText(message)}</p>
        </div>
      ))}
      {messages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-black/10 px-3 py-4 text-xs text-black/50">
          No messages yet. Send a prompt to start recording tool calls.
        </div>
      )}
    </div>
  </section>
)
