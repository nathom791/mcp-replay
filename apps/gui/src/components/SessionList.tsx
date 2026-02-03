import { useEffect, useMemo, useState } from "react"
import clsx from "clsx"
import { Plus } from "lucide-react"

import { PaginationControls } from "./PaginationControls"
import { SearchInput } from "./SearchInput"
import { useCreateSession, useSessions } from "../hooks/useOpencode"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { useAppStore } from "../store/app-store"
import { formatRelativeTime } from "../lib/format"

const SESSION_PAGE_SIZE = 15

export const SessionList = () => {
  const { data: sessions = [] } = useSessions()
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const setSelectedSessionId = useAppStore((state) => state.setSelectedSessionId)
  const { mutateAsync: createSession } = useCreateSession()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 200)
  const normalizedSearch = debouncedSearch.trim().toLowerCase()
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    setPageIndex(0)
  }, [normalizedSearch])

  const filteredSessions = useMemo(() => {
    if (!normalizedSearch) return sessions

    return sessions.filter((session) => {
      const title = session.title ?? ""
      return (
        title.toLowerCase().includes(normalizedSearch) ||
        session.id.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [sessions, normalizedSearch])

  const total = filteredSessions.length
  const pageCount = total === 0 ? 0 : Math.ceil(total / SESSION_PAGE_SIZE)
  const maxPageIndex = Math.max(0, pageCount - 1)

  useEffect(() => {
    if (pageIndex > maxPageIndex) setPageIndex(maxPageIndex)
  }, [pageIndex, maxPageIndex])

  const pageSessions = useMemo(() => {
    const start = pageIndex * SESSION_PAGE_SIZE
    return filteredSessions.slice(start, start + SESSION_PAGE_SIZE)
  }, [filteredSessions, pageIndex])

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
      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search sessions"
        className="mt-3"
      />
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {pageSessions.map((session) => (
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
        {sessions.length > 0 && total === 0 && (
          <div className="rounded-2xl border border-dashed border-border1/15 bg-surface1/40 px-3 py-4 text-xs text-text3">
            No sessions match your search.
          </div>
        )}
      </div>
      <PaginationControls
        pageIndex={pageIndex}
        pageSize={SESSION_PAGE_SIZE}
        total={total}
        onPageIndexChange={setPageIndex}
        className="mt-3"
      />
    </section>
  )
}
