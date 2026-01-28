import { useMemo } from "react"

import { ServerConnectCard } from "../components/ServerConnectCard"
import { SessionDetails } from "../components/SessionDetails"
import { SessionList } from "../components/SessionList"
import { useMcpConfig } from "../hooks/useMcpConfig"
import { useSessions } from "../hooks/useOpencode"
import { useAppStore } from "../store/app-store"

export const SessionsView = () => {
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions()
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  useMcpConfig()

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId],
  )

  return (
    <div className="flex h-full flex-col gap-6">
      <ServerConnectCard />
      <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
        <SessionList />
        <SessionDetails session={selectedSession} sessionsLoading={sessionsLoading} />
      </div>
    </div>
  )
}
