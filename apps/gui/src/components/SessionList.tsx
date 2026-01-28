import clsx from "clsx"
import { Plus } from "lucide-react"

import { useCreateSession, useSessions } from "../hooks/useOpencode"
import { useAppStore } from "../store/app-store"
import { formatRelativeTime } from "../lib/format"

export const SessionList = () => {
  const { data: sessions = [] } = useSessions()
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const setSelectedSessionId = useAppStore((state) => state.setSelectedSessionId)
  const { mutateAsync: createSession } = useCreateSession()

  const handleCreate = async () => {
    const session = await createSession()
    setSelectedSessionId(session.id)
  }

  return (
    <section className="panel-bg flex h-full flex-col rounded-3xl border border-black/5 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Sessions</p>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ink"
        >
          <Plus size={14} />
          New
        </button>
      </div>
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setSelectedSessionId(session.id)}
            className={clsx(
              "flex w-full flex-col gap-1 rounded-2xl px-3 py-2 text-left transition",
              selectedSessionId === session.id
                ? "bg-ink text-white"
                : "bg-white/80 text-ink hover:bg-white",
            )}
          >
            <span className="text-sm font-semibold">
              {session.title || "Untitled session"}
            </span>
            <span
              className={clsx(
                "text-xs",
                selectedSessionId === session.id ? "text-white/70" : "text-black/50",
              )}
            >
              Updated {formatRelativeTime(session.time.updated)}
            </span>
          </button>
        ))}
        {sessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/10 px-3 py-4 text-xs text-black/50">
            No sessions yet. Create one to start recording.
          </div>
        )}
      </div>
    </section>
  )
}
