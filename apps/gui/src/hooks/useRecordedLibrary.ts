import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { RecordedSessionPayload, RecordedToolCall } from "@opencode/core"
import {
  deleteRecordedSession,
  duplicateRecordedSession,
  getRecordedSessionPayload,
  replaceRecordedToolCalls,
} from "@opencode/storage"

export const useRecordedSessionPayload = (sessionId?: string) =>
  useQuery<RecordedSessionPayload>({
    queryKey: ["recorded-session-payload", sessionId],
    queryFn: () => getRecordedSessionPayload(sessionId ?? ""),
    enabled: Boolean(sessionId),
  })

export const useReplaceRecordedToolCalls = () =>
  useMutation({
    mutationFn: ({
      sessionId,
      toolCalls,
    }: {
      sessionId: string
      toolCalls: RecordedToolCall[]
    }) => replaceRecordedToolCalls(sessionId, toolCalls),
  })

export const useDuplicateRecordedSession = () =>
  useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title?: string }) =>
      duplicateRecordedSession({ sessionId, title }),
  })

export const useDeleteRecordedSession = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => deleteRecordedSession(sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["recorded-sessions"] })
      queryClient.invalidateQueries({ queryKey: ["session-suites"], exact: false })
      queryClient.removeQueries({
        queryKey: ["recorded-session-payload", sessionId],
      })
    },
  })
}
