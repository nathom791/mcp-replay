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
    const session = await createSession(undefined)
    setSelectedSessionId(session.id)
  }

  return (
    <section className="panel-bg flex h-full flex-col rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text1">Sessions</p>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-full bg-cobalt px-3 py-1 text-xs font-semibold text-white transition duration-ui ease-ease-out hover:bg-cobalt-600"
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
              "ui-focus relative flex w-full flex-col gap-1 rounded-2xl px-3 py-2 text-left transition duration-ui ease-ease-out",
              selectedSessionId === session.id
                ? "bg-cobalt/10 pl-4 text-text1 ring-1 ring-cobalt/20 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-r before:bg-cobalt"
                : "border border-border1/10 bg-surface1/70 text-text1 hover:bg-surface1/90",
            )}
          >
            <span className="text-sm font-semibold">
              {session.title || "Untitled session"}
            </span>
            <span
              className={clsx(
                "text-xs",
                selectedSessionId === session.id ? "text-text2" : "text-text3",
              )}
            >
              Updated {formatRelativeTime(session.time.updated)}
            </span>
          </button>
        ))}
        {sessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border1/15 bg-surface1/40 px-3 py-4 text-xs text-text3">
            No sessions yet. Create one to start recording.
          </div>
        )}
      </div>
    </section>
  )
}
