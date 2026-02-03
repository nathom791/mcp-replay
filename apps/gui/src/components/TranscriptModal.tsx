import { useEffect } from "react"
import { X } from "lucide-react"

import type { OpenCodeMessageWithParts } from "@opencode/core"
import { ChatTranscript } from "./ChatTranscript"

export const TranscriptModal = ({
  isOpen,
  messages,
  onClose,
}: {
  isOpen: boolean
  messages: OpenCodeMessageWithParts[]
  onClose: () => void
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-modal-title"
      >
        <h2 id="transcript-modal-title" className="sr-only">
          Transcript
        </h2>
        <div className="h-[80vh]">
          <ChatTranscript
            variant="overlay"
            messages={messages}
            headerRight={
              <div className="flex items-center gap-2">
                <span className="text-xs text-text3">Live snapshot</span>
                <button
                  onClick={onClose}
                  className="ui-focus rounded-full border border-border1/10 bg-surface1/40 p-2 text-text2 transition duration-ui ease-ease-out hover:bg-surface1/70 hover:text-text1"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
