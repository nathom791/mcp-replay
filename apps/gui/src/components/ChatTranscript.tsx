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
  <section className="panel-bg flex h-full flex-col rounded-3xl p-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold">Transcript</p>
      <span className="text-xs text-text3">Live snapshot</span>
    </div>
    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      {messages.map((message) => (
        <div
          key={message.info.id}
          className={clsx(
            "relative overflow-hidden rounded-2xl border p-3 text-sm",
            message.info?.role === "user"
              ? "border-border1/10 bg-surface1/80 text-text1"
              : "border-border1/10 bg-surface2/80 pl-4 text-text1 before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r before:bg-cobalt/80",
          )}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-text3">
            {message.info?.role ?? "assistant"}
          </p>
          <p className="whitespace-pre-line leading-relaxed">{extractText(message)}</p>
        </div>
      ))}
      {messages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border1/15 bg-surface1/40 px-3 py-4 text-xs text-text3">
          No messages yet. Send a prompt to start recording tool calls.
        </div>
      )}
    </div>
  </section>
)
