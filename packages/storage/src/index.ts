import { invoke } from "@tauri-apps/api/core"

import type {
  RecordedMessage,
  RecordedSession,
  RecordedToolCall,
  ReplayRun,
} from "@opencode/core"

export const listRecordedSessions = async () =>
  invoke<RecordedSession[]>("storage_list_sessions")

export const saveRecordedSession = async (payload: {
  session: RecordedSession
  messages: RecordedMessage[]
  toolCalls: RecordedToolCall[]
}) => invoke<RecordedSession>("storage_save_session", { payload })

export const saveReplayRun = async (run: ReplayRun) =>
  invoke<void>("storage_save_replay_run", { run })
