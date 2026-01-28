## Phased TODO list for “OpenCode Session Recorder + MCP Tool Replay GUI”

### Phase 0 — Repo, scope, and invariants

* [ ] Define the two supported operating modes:

  * [ ] **Live mode:** GUI drives chat via OpenCode server API; tool calls are captured as they happen.
  * [ ] **Import mode:** GUI imports an OpenCode session export JSON and extracts tool calls for playback.
* [ ] Define the “tool call unit” you will record and replay:

  * [ ] `serverName` (MCP server key from OpenCode config) ([OpenCode][1])
  * [ ] `toolName` (MCP tool name)
  * [ ] `arguments` (JSON)
  * [ ] `recordedResult` (MCP tool result blocks + optional structured result)
* [ ] Decide persistence format (recommended):

  * [ ] SQLite file per “library” with migrations.
  * [ ] Attachments in a content-addressed blob store (disk folder keyed by SHA256).
* [ ] Create monorepo layout (example):

  * [ ] `apps/gui/` (Tauri/Electron/desktop-web)
  * [ ] `packages/core/` (domain models + replay engine)
  * [ ] `packages/opencode-client/` (OpenCode server + SSE integration)
  * [ ] `packages/mcp-client/` (MCP JSON-RPC client)
  * [ ] `packages/storage/` (SQLite + migrations)
* [ ] Add “definition of done” for MVP:

  * [ ] Start OpenCode server, create session, chat, capture MCP tool calls.
  * [ ] Persist session + tool timeline.
  * [ ] Replay selected tool calls against configured MCP servers without a model.

---

### Phase 1 — OpenCode server connectivity (chat + sessions)

OpenCode exposes a server with an OpenAPI spec and a JS/TS SDK. ([OpenCode][2])

**1.1 Server bootstrap**

* [ ] Support connecting to:

  * [ ] Existing OpenCode server URL (user-provided).
  * [ ] Spawned server via `opencode serve` (subprocess) and manage lifecycle. ([OpenCode][3])
  * [ ] SDK-assisted local start via `@opencode-ai/sdk` (`createOpencode`) for dev workflows. ([OpenCode][4])
* [ ] Implement health/version probe: `GET /global/health`. ([OpenCode][2])
* [ ] Implement basic auth support via `OPENCODE_SERVER_PASSWORD` / username if enabled. ([OpenCode][2])

**1.2 Sessions CRUD**

* [ ] List sessions: `GET /session`. ([OpenCode][2])
* [ ] Create session: `POST /session`. ([OpenCode][2])
* [ ] Get session details: `GET /session/:id`. ([OpenCode][2])
* [ ] Update session title: `PATCH /session/:id`. ([OpenCode][2])
* [ ] Session children/fork support for branching workflows:

  * [ ] `POST /session/:id/fork`
  * [ ] `GET /session/:id/children` ([OpenCode][2])
* [ ] Delete session: `DELETE /session/:id`. ([OpenCode][2])

**1.3 Chat messaging**

* [ ] Implement message list: `GET /session/:id/message` (returns message info + parts). ([OpenCode][2])
* [ ] Implement send message (sync): `POST /session/:id/message`. ([OpenCode][2])
* [ ] Implement send message (async): `POST /session/:id/prompt_async`. ([OpenCode][2])
* [ ] Implement command execution (optional, but useful for parity): `POST /session/:id/command`. ([OpenCode][2])

---

### Phase 2 — Streaming + recorder pipeline (capture MCP tool calls)

OpenCode exposes a global SSE event stream. ([OpenCode][2])

**2.1 Event ingestion**

* [ ] Subscribe to `GET /global/event` SSE stream and build a resilient client:

  * [ ] Automatic reconnect with last-event-id resume when possible.
  * [ ] Backoff strategy.
  * [ ] “Disconnected” UI state.
* [ ] Maintain an in-memory “live session state”:

  * [ ] Messages (by messageID)
  * [ ] Parts (by partID)
  * [ ] Tool call lifecycle (requested → running → result/error)

**2.2 Tool call extraction strategy**

* [ ] Primary extraction: derive tool calls from message “parts” returned by:

  * [ ] Streaming updates (SSE)
  * [ ] Periodic reconciliation via `GET /session/:id/message` (authoritative snapshot) ([OpenCode][2])
* [ ] Implement “reconciliation loop”:

  * [ ] On reconnect, refetch latest messages/parts for any active sessions.
  * [ ] Deduplicate by stable IDs (messageID/partID/toolCallID if present).
* [ ] Identify and tag MCP-originated tool calls:

  * [ ] Map to OpenCode MCP server keys from config and status APIs. ([OpenCode][2])

**2.3 Normalized recording model (core domain)**

* [ ] Define stable entities:

  * [ ] `Library` (local DB)
  * [ ] `RecordedSession` (mirrors OpenCode session + metadata)
  * [ ] `RecordedMessage` (prompt + assistant)
  * [ ] `RecordedToolCall`:

    * [ ] `opencodeSessionId`
    * [ ] `messageId`
    * [ ] `sequenceIndex` (timeline ordering)
    * [ ] `toolKind`: `mcp` | `builtin` | `unknown`
    * [ ] `mcpServerName`
    * [ ] `toolName`
    * [ ] `argumentsJson`
    * [ ] `recordedResultJson`
    * [ ] `timing` (start/end/duration)
    * [ ] `status`: success/error/canceled
* [ ] Store MCP tool result shape per MCP schema:

  * [ ] `content[]` and optional `structuredContent`, `isError`. ([Model Context Protocol][5])

**2.4 Logging/export format (JSONL)**

* [ ] Implement JSONL export of normalized timeline:

  * [ ] Deterministic ordering.
  * [ ] Stable correlation IDs.
  * [ ] Include OpenCode config snapshot and MCP config snapshot for replay fidelity. ([OpenCode][1])

---

### Phase 3 — MCP server config + status (match OpenCode schema)

OpenCode supports local and remote MCP server definitions with `type`, `command`/`url`, `headers`, `environment`, `enabled`, and optional OAuth config. ([OpenCode][1])

**3.1 Read MCP configuration**

* [ ] Fetch OpenCode config via `GET /config` and parse `mcp` section. ([OpenCode][2])
* [ ] Support both:

  * [ ] Local servers: `type:"local"`, `command:[...]`, `environment`, `enabled`. ([OpenCode][1])
  * [ ] Remote servers: `type:"remote"`, `url`, `headers`, `enabled`, `oauth` optional/false. ([OpenCode][1])

**3.2 MCP status + dynamic add**

* [ ] Show MCP server status in the GUI:

  * [ ] `GET /mcp` status map. ([OpenCode][2])
* [ ] Allow adding MCP servers dynamically through OpenCode server:

  * [ ] `POST /mcp { name, config }`. ([OpenCode][2])

**3.3 OAuth considerations**

* [ ] Decide replay auth handling:

  * [ ] Option A (minimal): only support header-based auth (API keys) from config.
  * [ ] Option B (full): also support OAuth and token storage compatible with OpenCode’s behavior.
* [ ] If implementing Option B:

  * [ ] Read OpenCode’s stored MCP tokens location (`~/.local/share/opencode/mcp-auth.json`) and treat as opaque credential store. ([OpenCode][1])
  * [ ] Implement token refresh and secure storage (OS keychain if desktop).

---

### Phase 4 — MCP client + replay engine (no model required)

MCP tools are invoked using JSON-RPC methods like `tools/list` and `tools/call`. ([Model Context Protocol][6])

**4.1 MCP transport support**

* [ ] Implement MCP client transports needed for your target MCP servers:

  * [ ] HTTP(S) transport for remote MCP endpoints (common for `type:"remote"`).
  * [ ] StdIO transport for local MCP servers started via `command` (common for `type:"local"`). ([OpenCode][1])
* [ ] Implement process manager for local MCP:

  * [ ] Spawn, capture stderr logs, restart, graceful shutdown.
  * [ ] Per-server concurrency limits.

**4.2 Tool catalog**

* [ ] For each MCP server:

  * [ ] Call `tools/list` and cache tool schemas for validation and GUI argument editing. ([Model Context Protocol][6])
  * [ ] Version the tool catalog by server + timestamp.

**4.3 Replay execution modes**

* [ ] Implement replay plan builder:

  * [ ] Select subset of tool calls (by range, by tool, by server, by error).
  * [ ] Optionally reorder or insert delays.
* [ ] Implement execution modes:

  * [ ] **Simulated:** return recorded result without calling server.
  * [ ] **Live:** call MCP server with `tools/call` using recorded arguments.
  * [ ] **Verify:** live replay + diff recorded vs live result (structured + text).
* [ ] Implement result handling:

  * [ ] Persist live results separately from recorded results.
  * [ ] Normalize diff output:

    * [ ] `structuredContent` JSON diff
    * [ ] `content[]` block diff
  * [ ] Mark call as `isError` when MCP result indicates tool execution error. ([Model Context Protocol][5])

**4.4 Determinism + safety**

* [ ] Add “dry-run guardrails” for risky tools:

  * [ ] Default simulated mode for tools matching denylist patterns (filesystem deletion, network write, etc.).
  * [ ] Per-tool allow/deny toggles stored in app settings.
* [ ] Record environment snapshot for each replay run:

  * [ ] MCP config used
  * [ ] Tool schema version
  * [ ] Host OS + app version

---

### Phase 5 — Storage layer (sessions as first-class editable objects)

**5.1 Database schema**

* [ ] Tables:

  * [ ] `libraries`
  * [ ] `recorded_sessions`
  * [ ] `recorded_messages`
  * [ ] `recorded_tool_calls`
  * [ ] `replay_runs`
  * [ ] `replay_run_tool_calls` (live results, diffs, timings)
  * [ ] `tags` + join tables
  * [ ] `attachments` (blob references)
* [ ] Indices:

  * [ ] `(sessionId, sequenceIndex)`
  * [ ] `(mcpServerName, toolName)`
  * [ ] `(createdAt)`
  * [ ] Full-text search for message content and tool args/results.

**5.2 Import/export compatibility**

* [ ] Implement “Import from OpenCode export JSON”:

  * [ ] OpenCode CLI supports export/import of sessions. ([OpenCode][3])
  * [ ] Parse exported structure; map messages/parts; extract tool calls.
* [ ] Implement app-native export:

  * [ ] JSONL timeline
  * [ ] Single JSON bundle (session + calls + results + schemas)
  * [ ] Optional: embed attachments.

**5.3 Migration + versioning**

* [ ] Migration runner on app startup.
* [ ] Backward-compatible readers for older session versions.

---

### Phase 6 — GUI (modern session library + editor + player)

**6.1 UI foundations**

* [ ] App shell:

  * [ ] Left nav: Libraries, Sessions, MCP Servers, Settings
  * [ ] Main: Session view
  * [ ] Right drawer: Inspector (details + JSON)
* [ ] State management:

  * [ ] Query cache for OpenCode API
  * [ ] Local DB cache
  * [ ] SSE event stream integration (live updates)

**6.2 Session library UX**

* [ ] Sessions list:

  * [ ] Search (title + content)
  * [ ] Filters: tag, date, has-tool-calls, has-errors, MCP server
  * [ ] Sort: recent, duration, tool-call count
* [ ] Session details:

  * [ ] Chat transcript (prompt/assistant)
  * [ ] Tool timeline (expandable)
  * [ ] “Runs” tab for replay history

**6.3 Tool call editor**

* [ ] Timeline table columns:

  * [ ] index, server, tool, status, duration, recorded/live toggle
* [ ] Edit tool call:

  * [ ] Arguments editor with schema-aware form (fallback JSON editor).
  * [ ] Result viewer:

    * [ ] Render `content[]` blocks
    * [ ] Show `structuredContent` JSON
* [ ] Inline operations:

  * [ ] Duplicate call
  * [ ] Disable call (skip)
  * [ ] Reorder (drag/drop)
  * [ ] Split into a new “Replay script” entity

**6.4 Replay runner UI**

* [ ] Controls:

  * [ ] Run / Pause / Stop
  * [ ] Step
  * [ ] Mode: Simulated / Live / Verify
  * [ ] Concurrency: 1 / N
* [ ] Live run console:

  * [ ] Streaming logs (per call)
  * [ ] Status badges
  * [ ] Diff view for Verify mode
* [ ] Persist run artifacts:

  * [ ] Summary (success rate, time, errors)
  * [ ] Per-call outputs and diffs

---

### Phase 7 — Optional: “inside OpenCode” capture via plugin (higher fidelity)

OpenCode supports plugins loaded from `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global). ([OpenCode][7])

* [ ] Write an OpenCode plugin that:

  * [ ] Subscribes to internal tool-call lifecycle events.
  * [ ] Emits normalized tool call records to:

    * [ ] Local JSONL file, or
    * [ ] HTTP endpoint exposed by your GUI app, or
    * [ ] `POST /log` with structured `extra` payload (then your GUI subscribes to events). ([OpenCode][2])
* [ ] Add plugin install/uninstall tooling:

  * [ ] “Install plugin” button writes file into plugin dir.
  * [ ] Version pinning and upgrade strategy.

---

### Phase 8 — Hardening: tests, compatibility, and packaging

**8.1 Automated tests**

* [ ] Unit tests:

  * [ ] OpenCode API client parsing
  * [ ] Tool call extraction + reconciliation
  * [ ] MCP client transports
  * [ ] Diff engine
* [ ] Integration tests:

  * [ ] Spawn `opencode serve`, create session, send message, verify capture. ([OpenCode][3])
  * [ ] Spin up `@modelcontextprotocol/server-everything` as local MCP and replay calls. ([OpenCode][1])
* [ ] Golden fixtures:

  * [ ] Saved OpenCode export JSON
  * [ ] Recorded JSONL timelines

**8.2 Resilience**

* [ ] Handle OpenCode server restarts:

  * [ ] Reconnect + refetch sessions/messages
  * [ ] Detect session status via `GET /session/status`. ([OpenCode][2])
* [ ] Handle unstable MCP servers:

  * [ ] Timeouts per call
  * [ ] Retries with idempotency controls
  * [ ] Circuit breaker per server

**8.3 Packaging**

* [ ] Desktop builds for macOS/Windows/Linux.
* [ ] Configurable OpenCode server target (local spawned vs remote).
* [ ] Data directory management (library location selection, backups).

---

### Phase 9 — Stretch features (if needed)

* [ ] “Replay scripts” as reusable assets independent of a session.
* [ ] Parameterization:

  * [ ] Variables in tool args (`${var}`), value sets, and per-run overrides.
* [ ] Multi-session compare:

  * [ ] Diff tool timelines between two sessions/runs.
* [ ] Shareable bundles:

  * [ ] Export replay script + required MCP config (sans secrets).
* [ ] Collaborative store:

  * [ ] Git-backed library or remote sync.

---

## Implementation anchors (what to build against)

* OpenCode server endpoints for sessions/messages/SSE and MCP status/dynamic add. ([OpenCode][2])
* OpenCode MCP config schema for local/remote servers and OAuth behavior. ([OpenCode][1])
* MCP tool result fields (`content`, `structuredContent`, `isError`) for recording and diffing. ([Model Context Protocol][5])

[1]: https://opencode.ai/docs/mcp-servers/ "MCP servers | OpenCode"
[2]: https://opencode.ai/docs/server/ "Server | OpenCode"
[3]: https://opencode.ai/docs/cli/ "CLI | OpenCode"
[4]: https://opencode.ai/docs/sdk/ "SDK | OpenCode"
[5]: https://modelcontextprotocol.io/specification/2025-06-18/schema?utm_source=chatgpt.com "Schema Reference"
[6]: https://modelcontextprotocol.io/specification/2025-06-18/server/tools?utm_source=chatgpt.com "Tools"
[7]: https://opencode.ai/docs/plugins/ "Plugins | OpenCode"
