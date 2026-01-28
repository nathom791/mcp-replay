# AGENTS.md

## Purpose
- Provide guidance for agentic coding work in this repo.
- Keep instructions aligned with `tech-stack.md` and `todo.md`.
- Update this file once build tooling and code layout are added.

## Repository status (Jan 2026)
- Monorepo scaffolding is now in place.
- Frontend: Vite + React + TypeScript under `apps/gui` managed via pnpm workspaces.
- Backend: Tauri v2 Rust app under `apps/gui/src-tauri`.
- Use the planning docs to infer intent; avoid inventing APIs or structures.

## Sources of truth
- Product/tech direction: `tech-stack.md`
- Roadmap and features: `todo.md`
- There are no Cursor or Copilot rule files in this repo today.

## Build / lint / test commands (current)
- Install deps: `pnpm install`
- Frontend dev server: `pnpm --filter @opencode/gui dev`
- Frontend build: `pnpm --filter @opencode/gui build`
- Frontend preview: `pnpm --filter @opencode/gui preview`
- Frontend typecheck: `pnpm --filter @opencode/gui typecheck`
- Tauri dev app: `cargo tauri dev` (run from `apps/gui/src-tauri`)
- Tauri build: `cargo tauri build` (run from `apps/gui/src-tauri`)
- Rust tests: `cargo test` (run from `apps/gui/src-tauri`)
- If you need to run tooling, check with the user or add scripts with the scaffolding.

## Expected commands once scaffolding exists (verify before use)
- These are suggested defaults based on the recommended stack; confirm in repo.
- Replace or remove this section when real scripts/configs are added.
- Monorepo uses pnpm workspaces; prefer `pnpm --filter <workspace> <script>`.
- `pnpm -C path <script>` is acceptable when you know the workspace path.

### Frontend (Vite + React + TypeScript)
- Install deps: `pnpm install`
- Dev server: `pnpm --filter @opencode/gui dev`
- Production build: `pnpm --filter @opencode/gui build`
- Preview build: `pnpm --filter @opencode/gui preview`
- Typecheck: `pnpm --filter @opencode/gui typecheck`

### Desktop shell (Tauri v2 + Rust)
- Dev app: `cargo tauri dev` (run from `apps/gui/src-tauri`)
- Build app: `cargo tauri build` (run from `apps/gui/src-tauri`)
- Rust tests: `cargo test` (run from `apps/gui/src-tauri`)
- Single unit test: `cargo test test_name`
- Single integration test: `cargo test --test integration_name`
- Format: `cargo fmt`
- Lint: `cargo clippy --all-targets --all-features`

### Backend/shared Rust crates (if extracted)
- Build: `cargo build`
- Tests: `cargo test`
- Single test module: `cargo test module::test_name`

## Code style guidelines
- Keep modules small; prefer focused packages (`core`, `opencode-client`, `mcp-client`, `storage`).
- Favor named exports over default exports for shared TS modules.
- Keep data models immutable where practical; avoid in-place mutation across layers.
- Use explicit types at module boundaries; avoid `any` and `unknown` without narrowing.
- Prefer composition over inheritance in UI state and domain logic.

### Imports
- Group in order: standard libs, third-party, internal absolute, relative.
- Use type-only imports (`import type { ... }`) when possible.
- Avoid deep relative paths; introduce path aliases once the workspace exists.
- Keep import lists sorted and stable to minimize diff churn.
- Prevent circular dependencies; refactor shared logic into core packages.

### Formatting
- Use Prettier for TS/TSX once configured; do not hand-format beyond defaults.
- Rust formatting must follow `rustfmt` defaults; never change style manually.
- Keep lines reasonably short; wrap long JSX props and chained calls.
- Prefer trailing commas where formatters enforce them.

### Naming conventions
- TS/JS files: `kebab-case.ts` for modules, `PascalCase.tsx` for components.
- Rust files: `snake_case.rs`; modules match file names.
- Components use `PascalCase`; hooks `camelCase`; constants `UPPER_SNAKE_CASE`.
- Database tables and columns use `snake_case`.

### TypeScript / React
- Use functional components with hooks; no class components.
- Hook names must start with `use`.
- Store async server state in TanStack Query; local UI state in Zustand.
- Validate external data with Zod before use in UI or persistence.
- Prefer `async/await` over nested promise chains.
- Avoid throwing for routine control flow; return typed errors instead.
- Keep schema files near models to reduce drift.
- Avoid premature memoization; only use `useMemo`/`useCallback` when measured.

### Rust (Tauri/backend)
- Use `Result<T, E>` everywhere; no `unwrap`/`expect` in production paths.
- Prefer `thiserror` for library errors; `anyhow` for app-level aggregation.
- Use `tracing` for structured logs; avoid `println!` except in tests.
- Keep async boundaries explicit; avoid blocking IO in async tasks.
- Use serde with explicit field names and `deny_unknown_fields` for external inputs.
- Keep command handlers small; delegate to service modules.
- Run `clippy` with warnings treated as errors where feasible.

### API/client behavior
- Wrap OpenCode API calls in a single client module with typed requests/responses.
- Centralize SSE reconnect/backoff logic; expose events through a typed channel.
- Keep MCP transport logic isolated from UI concerns.

### Data & persistence
- Use `sqlx` with migrations; never build SQL with string concatenation.
- Prefer parameterized queries and explicit column lists.
- Store large tool results as blobs only when needed; keep metadata in tables.
- Use content-addressed storage for attachments if implemented.

### Error handling & resilience
- Normalize tool call results with `isError`, `content[]`, and `structuredContent`.
- Treat replay actions as potentially destructive; default to simulated mode.
- Include clear error messages for network/SSE failures and reconnect logic.
- Surface retryable vs fatal errors distinctly in UI.

### Testing
- Favor deterministic fixtures for tool call replay and diffing.
- Unit tests should avoid network/process usage; use fakes/mocks.
- Integration tests may spawn `opencode serve` and MCP servers (once available).
- Keep tests hermetic and clean up processes on failure.

### UI/UX
- Preserve the “modern desktop GUI” goal; prefer deliberate layouts over default.
- Keep editable JSON views backed by schema validation.
- Use accessible components (Radix/shadcn) and clear keyboard focus.
- Avoid dark-mode bias unless the design system specifies it.
- Prefer responsive layouts that work at 1280x800 and smaller.

### Security
- Never execute shell commands from recorded tool args without explicit opt-in.
- Keep secrets in OS keychain or secure storage, not plain text.
- Redact credentials from logs and exports.

## Cursor/Copilot rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.
- If any are added later, they override parts of this document.

## When adding new tooling
- Update this file with the exact build/lint/test commands.
- Document the package manager and workspace layout at the top.
- Include single-test commands for each runner.

## Collaboration notes
- Keep changes small and incremental; align with TODO phases.
- Add new files in the planned monorepo structure once bootstrapped.
- Document new conventions in this file to guide other agents.
