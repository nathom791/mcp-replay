import { useQuery } from "@tanstack/react-query"

import { listRecordedSessions } from "@opencode/storage"
import { formatRelativeTime } from "../lib/format"

export const LibraryView = () => {
  const { data: sessions = [] } = useQuery({
    queryKey: ["recorded-sessions"],
    queryFn: listRecordedSessions,
  })

  return (
    <div className="panel-bg h-full rounded-3xl border border-black/5 p-6 shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Recorded library</p>
        <span className="text-xs text-black/50">{sessions.length} sessions</span>
      </div>
      <div className="mt-6 space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3"
          >
            <p className="text-sm font-semibold">
              {session.title || "Untitled session"}
            </p>
            <p className="text-xs text-black/50">
              Recorded {formatRelativeTime(session.updatedAt)}
            </p>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-black/50">
            No recorded sessions yet. Save a session from the Sessions tab.
          </div>
        )}
      </div>
    </div>
  )
}
