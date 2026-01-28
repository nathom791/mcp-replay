CREATE TABLE IF NOT EXISTS libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recorded_sessions (
  id TEXT PRIMARY KEY,
  opencode_session_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recorded_messages (
  id TEXT PRIMARY KEY,
  recorded_session_id TEXT NOT NULL,
  opencode_session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (recorded_session_id) REFERENCES recorded_sessions (id)
);

CREATE TABLE IF NOT EXISTS recorded_tool_calls (
  id TEXT PRIMARY KEY,
  recorded_session_id TEXT NOT NULL,
  opencode_session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  part_id TEXT,
  sequence_index INTEGER NOT NULL,
  tool_kind TEXT NOT NULL,
  mcp_server_name TEXT,
  tool_name TEXT NOT NULL,
  arguments_json TEXT NOT NULL,
  recorded_result_json TEXT,
  live_result_json TEXT,
  diff_json TEXT,
  timing_json TEXT,
  status TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recorded_session_id) REFERENCES recorded_sessions (id)
);

CREATE TABLE IF NOT EXISTS replay_runs (
  id TEXT PRIMARY KEY,
  recorded_session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  summary TEXT,
  FOREIGN KEY (recorded_session_id) REFERENCES recorded_sessions (id)
);

CREATE TABLE IF NOT EXISTS replay_run_tool_calls (
  id TEXT PRIMARY KEY,
  replay_run_id TEXT NOT NULL,
  recorded_tool_call_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER,
  live_result_json TEXT,
  diff_json TEXT,
  FOREIGN KEY (replay_run_id) REFERENCES replay_runs (id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_tags (
  session_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (session_id, tag_id),
  FOREIGN KEY (session_id) REFERENCES recorded_sessions (id),
  FOREIGN KEY (tag_id) REFERENCES tags (id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recorded_tool_calls_session_sequence
  ON recorded_tool_calls (recorded_session_id, sequence_index);

CREATE INDEX IF NOT EXISTS idx_recorded_tool_calls_tool
  ON recorded_tool_calls (mcp_server_name, tool_name);

CREATE INDEX IF NOT EXISTS idx_recorded_sessions_updated
  ON recorded_sessions (updated_at);
