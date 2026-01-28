# tech-stack.md

## Objective

Build a **modern desktop GUI** that:

1. Connects to **OpenCode’s HTTP server** (`opencode serve`) to chat with a model.
2. Captures **MCP tool calls** emitted during those chats (via OpenCode events / message parts).
3. Persists sessions locally (searchable + editable).
4. Replays selected MCP tool calls later **without** running a model (simulated/live/verify modes).

OpenCode server essentials:
- Exposes an **OpenAPI 3.1 spec** at `/doc`.
- Streams real-time events via **SSE** at `/global/event`.
- Provides config and MCP status endpoints (`/config`, `/mcp`, etc.).
- Can enable CORS for browser-origin clients via `opencode serve --cors ...`.

(References at end.)

---

## Recommended stack (best fit)

### Desktop framework
**Tauri v2 (stable) + Rust backend + React/TypeScript frontend**

Why this is the best overall fit for your TODO list:
- You need reliable **local process management** (spawn/monitor local MCP servers defined by `type:"local"` + `command:[...]`).
- You want a “nice modern GUI” without Electron’s Chromium bundle overhead.
- You want a single packaged desktop app with:
  - Rust for durability/perf in streaming + process orchestration
  - React/TS for fast UI iteration

### Frontend (GUI)
- **React + TypeScript**
- **Vite** (dev/build)
- **Tailwind CSS + shadcn/ui (Radix-based)** for modern UI primitives
- **TanStack Query** (server state + caching)
- **Zustand** (local UI state: selection, filters, playback controls)
- **TanStack Table** (timeline grids; sort/filter/group)
- **Monaco Editor** (edit tool args/results JSON with schema hints)
- **react-json-view** (quick structured JSON viewer)
- **jsondiffpatch** (structured diff for Verify mode)

### Backend (Tauri / Rust)
#### OpenCode client + event capture
- **reqwest** for HTTP calls to OpenCode server
- **SSE client** (Rust) to consume `/global/event` and push events to the UI
  - Emit app-level events into the frontend (Tauri event channel)

#### MCP client + process manager
- **StdIO transport** for local MCP servers (spawn with `command` array; manage env; timeout)
- **HTTP(S) transport** for remote MCP servers (send headers; optional OAuth support)
- **serde + serde_json** for JSON-RPC payloads
- Implement MCP `tools/list` and `tools/call` per MCP spec (2025-06-18)

#### Local persistence
- **SQLite** for session library
- **sqlx** (SQLite driver) + migrations
- **content-addressed blob store** on disk for large payloads/attachments (optional)

#### Logging + diagnostics
- **tracing + tracing-subscriber**
- Persisted run logs (per replay run) + rolling app log

### Domain model / validation
- **Zod** (frontend) for editing/validating tool args against tool schemas.
- Optional: generate TS types from Rust models via **ts-rs** or **specta** to keep the domain model aligned.

---

## Why not a web-only app?

A browser-only GUI can work, but it becomes fragile because you must:
- fight CORS and auth boundaries against OpenCode server
- implement local stdio MCP spawning outside the browser (you end up needing a local daemon anyway)

If you still want “web app + local daemon”, see the alternative stack below.

---

## Alternative stack (fastest dev if you want all-JS)

### Electron + React + Node “main” process
- Electron (Chromium + Node)
- React/TS + Vite
- Node main process hosts:
  - OpenCode client via `@opencode-ai/sdk` (optional convenience)
  - SSE consumption + tool call recorder
  - MCP stdio process manager
  - SQLite via `better-sqlite3`

Pros:
- Everything in TypeScript, fewer languages.
- Node makes stdio + JSON-RPC trivial.

Cons:
- Heavier installs, more memory footprint.
- Packaging + security hardening tends to be more work.

---

## Component-to-requirement mapping

### Capturing MCP tool calls from OpenCode chats
- Prefer: **OpenCode SSE** (`/global/event`) + message reconciliation (`/session/:id/message`)
- Backend maintains a normalized timeline and persists tool calls.

### Replay (no model required)
- Backend MCP client replays:
  - **Simulated:** return recorded result
  - **Live:** call MCP `tools/call` with recorded args
  - **Verify:** live call + diff recorded vs live (`structuredContent` + `content[]`)

### Editing sessions in GUI
- Use Monaco Editor for:
  - tool arguments JSON
  - allow disable/reorder/duplicate steps
- Schema-driven helper UI:
  - populate tool schemas via MCP `tools/list`
  - validate edits in Zod before saving

---

## Suggested versions (pin early)

- Tauri: v2.x
- Rust: stable toolchain
- Node: LTS (for frontend tooling)
- React: current stable
- SQLite: bundled via sqlx

---

## “Must-have” security baseline

- Store secrets (MCP OAuth tokens / API keys) in OS keychain where possible.
- Treat tool replay as potentially destructive:
  - per-tool allow/deny list
  - default to Simulated mode for unknown tools
- Do not execute arbitrary shell commands from recorded args without explicit opt-in.

---

## References

OpenCode:
- Server docs (OpenAPI `/doc`, SSE `/global/event`, CORS flags): https://opencode.ai/docs/server/
- MCP server config schema (`local`/`remote`, `command`, `headers`, `oauth`, token file): https://opencode.ai/docs/mcp-servers/
- SDK: https://opencode.ai/docs/sdk/
- Plugins: https://opencode.ai/docs/plugins/

MCP spec:
- Tools (`tools/list`, `tools/call`): https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- Schema (tool result fields like `structuredContent`, `isError`): https://modelcontextprotocol.io/specification/2025-06-18/schema

Tauri:
- Tauri 2.0 stable release: https://v2.tauri.app/blog/tauri-20/
