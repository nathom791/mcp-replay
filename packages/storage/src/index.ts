import { invoke } from "@tauri-apps/api/core"

import type {
  PagedResult,
  RecordedMessage,
  RecordedSession,
  RecordedToolCall,
  RecordedSessionPayload,
  SessionListParams,
  SessionSuite,
  Suite,
  ReplayRun,
} from "@opencode/core"

export const listRecordedSessions = async () =>
  invoke<RecordedSession[]>("storage_list_sessions")

export const listRecordedSessionsPage = async (params: SessionListParams) =>
  invoke<PagedResult<RecordedSession>>("storage_list_sessions_page", { params })

export const listSuites = async () => invoke<Suite[]>("storage_list_suites")

export const createSuite = async (name: string) =>
  invoke<Suite>("storage_create_suite", { name })

export const deleteSuite = async (suiteId: string) =>
  invoke<void>("storage_delete_suite", { suiteId })

export const assignSuite = async (sessionId: string, suiteId: string) =>
  invoke<void>("storage_assign_suite", { sessionId, suiteId })

export const unassignSuite = async (sessionId: string, suiteId: string) =>
  invoke<void>("storage_unassign_suite", { sessionId, suiteId })

export const listSessionSuites = async (sessionIds: string[]) =>
  invoke<SessionSuite[]>("storage_list_session_suites", { sessionIds })

export const saveRecordedSession = async (payload: {
  session: RecordedSession
  messages: RecordedMessage[]
  toolCalls: RecordedToolCall[]
}) => invoke<RecordedSession>("storage_save_session", { payload })

export const duplicateRecordedSession = async (request: {
  sessionId: string
  title?: string
}) => invoke<RecordedSession>("storage_duplicate_session", { request })

export const deleteRecordedSession = async (sessionId: string) =>
  invoke<void>("storage_delete_session", { sessionId })

export const getRecordedSessionPayload = async (sessionId: string) =>
  invoke<RecordedSessionPayload>("storage_get_session_payload", { sessionId })

export const replaceRecordedToolCalls = async (
  sessionId: string,
  toolCalls: RecordedToolCall[],
) => invoke<void>("storage_replace_tool_calls", { sessionId, toolCalls })

export const saveReplayRun = async (run: ReplayRun) =>
  invoke<void>("storage_save_replay_run", { run })
