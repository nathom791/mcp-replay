import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { SessionSuite, Suite } from "@opencode/core"
import {
  assignSuite,
  createSuite,
  deleteSuite,
  listSessionSuites,
  listSuites,
  unassignSuite,
} from "@opencode/storage"

export const useSuites = () =>
  useQuery<Suite[]>({
    queryKey: ["suites"],
    queryFn: listSuites,
  })

export const useCreateSuite = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createSuite(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suites"] })
    },
  })
}

export const useDeleteSuite = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (suiteId: string) => deleteSuite(suiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suites"] })
      queryClient.invalidateQueries({ queryKey: ["session-suites"], exact: false })
    },
  })
}

export const useSessionSuites = (sessionIds: string[]) =>
  useQuery<SessionSuite[]>({
    queryKey: ["session-suites", sessionIds],
    queryFn: () => listSessionSuites(sessionIds),
    enabled: sessionIds.length > 0,
  })

export const useAssignSuite = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sessionId,
      suiteId,
    }: {
      sessionId: string
      suiteId: string
    }) => assignSuite(sessionId, suiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-suites"], exact: false })
      queryClient.invalidateQueries({ queryKey: ["recorded-sessions"], exact: false })
    },
  })
}

export const useUnassignSuite = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sessionId,
      suiteId,
    }: {
      sessionId: string
      suiteId: string
    }) => unassignSuite(sessionId, suiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-suites"], exact: false })
      queryClient.invalidateQueries({ queryKey: ["recorded-sessions"], exact: false })
    },
  })
}
