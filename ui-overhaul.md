# UI Overhaul Plan: Daylight Porcelain + Cobalt

## Direction
Light-first "instrument glass": porcelain canvas (cool white, faint blue-gray) with crisp ink typography and cobalt as the single confident accent. Glass shows up as disciplined translucency + hairlines + inner highlights; blur is reserved for overlays only. The UI should feel precise, calm, and desktop-native at 1280x800 (not "frosted everywhere").

## 1) Token System (CSS variables + Tailwind mapping)
- Keep Tailwind as the styling engine (repo already uses it) and move colors to CSS variables so `data-theme` works.
- Store color tokens as RGB triplets so Tailwind opacity utilities work: `rgb(var(--token) / <alpha-value>)`.
- Update `apps/gui/src/index.css` to define tokens under `:root` (light defaults) + `:root[data-theme="dark"]` (optional second pass).
- Update `apps/gui/tailwind.config.ts` to map Tailwind color names to `rgb(var(--...)/<alpha-value>)`.

Suggested tokens (light, porcelain+cobalt):

```css
/* in apps/gui/src/index.css */

:root {
  /* tell the browser we’re light-first */
  color-scheme: light;

  /* core palette (RGB triplets) */
  --ink: 13 18 32;          /* #0D1220 */
  --paper: 247 249 255;     /* #F7F9FF */
  --fog: 233 237 247;       /* #E9EDF7 */
  --slate: 44 52 72;        /* #2C3448 */
  --cobalt: 47 93 255;      /* #2F5DFF */
  --cobalt-600: 36 75 219;  /* #244BDB */

  /* status */
  --moss: 20 184 166;       /* success */
  --ember: 245 158 11;      /* warning */
  --danger: 225 29 72;      /* destructive */

  /* semantic text */
  --text-1: var(--ink);
  --text-2: 43 52 74;
  --text-3: 95 107 134;

  /* semantic surfaces (tinted, no blur) */
  --canvas: var(--paper);
  --surface-1: 255 255 255;
  --surface-2: 250 251 255;
  --surface-3: 244 246 251;

  /* borders (use with low alpha) */
  --border-1: var(--ink);
  --border-2: var(--slate);

  /* glass */
  --glass-blur-sm: 6px;
  --glass-blur-md: 12px;
  --glass-blur-lg: 20px;

  /* radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  /* shadows (tune in Tailwind config too) */
  --shadow-panel: 0 1px 0 rgba(13,18,32,0.05), 0 10px 28px rgba(13,18,32,0.08);
  --shadow-popover: 0 1px 0 rgba(13,18,32,0.06), 0 18px 50px rgba(13,18,32,0.16);

  /* motion */
  --motion-fast: 90ms;
  --motion-ui: 140ms;
  --motion-medium: 200ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

/* optional, later */
:root[data-theme="dark"] {
  color-scheme: dark;
  /* keep cobalt as accent, invert surfaces, keep contrast calm */
}
```

Tailwind mapping targets (in `apps/gui/tailwind.config.ts`):
- Colors to add/map: `ink`, `paper`, `fog`, `surface1`, `surface2`, `surface3`, `text1`, `text2`, `text3`, `border1`, `cobalt`, `moss`, `ember`, `danger`.
- Shadows to add/map: `shadow-panel`, `shadow-popover`, `shadow-pressed`.
- (Optional) Border radii keys: `panel`, `control` using CSS vars so you can standardize without hunting `rounded-2xl` vs `rounded-3xl`.

Typography (keep current unless you explicitly want to change fonts later):
- Display: Fraunces (already used)
- Body: Work Sans (already used)
- Mono (recommended for JSON/Monaco parity): JetBrains Mono (later)

## 2) Glass Rules (so it looks premium, not blurry)
- Persistent surfaces (sidebar, panels, tables, cards): tinted surfaces + hairlines + inner highlights; NO blur.
- Overlays only (modals, popovers/menus, toasts): tint + `backdrop-filter: blur(var(--glass-blur-md/lg))` + stronger shadow.
- Never animate blur radius; animate opacity + small transform only (and disable transform flourish for `prefers-reduced-motion`).
- Always stabilize text contrast on overlays: overlays must have enough tint opacity that text remains >= 4.5:1 regardless of what’s behind.

Surface hierarchy:
- Canvas: porcelain gradient background, subtle, no blur
- Surface-2: sidebar/inspector rails (cooler tint)
- Surface-1: main panels and cards (clean, bright)
- Surface-3: input wells / table headers / code wells
- Overlay: glass blur + strong shadow (dialogs, dropdowns)

Lighting model (repeatable recipe):
- Tint + hairline border + inner top highlight + subtle specular gradient (top-left)
- (Optional later) very low noise overlay to prevent banding

## 3) Component Plan (map to current code)
General changes:
- Replace "ink-filled everywhere" selection with cobalt wash + small indicator; reserve solid ink fills for truly primary actions only.
- Unify focus rings: cobalt ring + offset on all interactive elements (`:focus-visible` only).

App shell (`apps/gui/src/App.tsx`)
- Canvas background: porcelain + faint cobalt bloom (radial), light noise optional.
- Standardize layout rhythm: consistent outer padding, consistent panel spacing, clear dividers.
- Make surfaces consistent: sidebar = surface-2, main = canvas + surface-1 panels, inspector = surface-2.

Sidebar (`apps/gui/src/components/Sidebar.tsx`)
- Background: surface-2 (no blur), hairline divider to main.
- Active item: cobalt wash (`bg-cobalt/10`) + 2px left indicator; text remains ink.
- Hover: subtle lift (`bg-surface1/70`), no heavy per-item shadows.
- Title uses display font; keep the rest body font.

Panels (`panel-bg` used across the app)
- Redefine `.panel-bg` to be the standard panel recipe (NO blur by default).
- Add a separate `.overlay-glass` recipe for modals/popovers (blur-md/lg).
- Keep `shadow-panel` subtle; reserve `shadow-popover` for overlays.

Buttons (currently many raw `<button className="... bg-ink ...">`)
- Define variants and migrate the main CTAs:
  - Primary: `bg-cobalt text-white hover:bg-cobalt-600`
  - Secondary: `bg-surface3/80 text-text1 border border-border1/10`
  - Ghost: `bg-transparent hover:bg-ink/5`
  - Destructive: `bg-danger text-white`
- Convert existing amber CTAs (`bg-ember`) to warning-only usage; primary actions become cobalt.

Inputs / textarea (`ServerConnectCard`, `SessionDetails`, `ToolCallRequestModal`)
- Inputs use surface-3 wells + hairline border; focus ring cobalt.
- Placeholder uses `text3`.
- Invalid state uses `danger` border + subtle tint + inline message (standardize error messaging color away from `--ember` if it’s truly warning).

ReplayControls (`apps/gui/src/components/ReplayControls.tsx`)
- Turn mode pills into a segmented control:
  - Container: surface-3 + border
  - Selected segment: surface-1 + inner highlight + subtle shadow
  - Focus ring on each segment

SessionList (`apps/gui/src/components/SessionList.tsx`)
- "New" button becomes primary cobalt.
- Selected session: cobalt wash + indicator, not solid ink.
- Empty state: porcelain-friendly dashed border with readable text3.

SessionDetails / header + prompt (`apps/gui/src/components/SessionDetails.tsx`)
- Header panel becomes a clean instrument strip: label, title, status, actions.
- "Run replay" primary cobalt; "Stop" secondary; "Record session" secondary (or primary if it’s the core flow).
- Prompt textarea: surface-3 well; send button primary cobalt.

ToolTimeline (table rows) (`apps/gui/src/components/ToolTimeline.tsx`)
- Avoid trying to "round table rows"; move rows to div-based list or wrap row content in a rounded container per row.
- Hover/selected states use surface/cobalt wash; keep text crisp and aligned.

ChatTranscript (`apps/gui/src/components/ChatTranscript.tsx`)
- Replace pure black assistant bubbles:
  - User bubble: surface-1 + border
  - Assistant bubble: surface-2/3 + cobalt accent (small left stripe or header label), not full ink fill
- Maintain clear role labels with adequate contrast.

Inspector (`apps/gui/src/components/Inspector.tsx`)
- Inspector rail is surface-2 (no blur).
- Monaco/JSON blocks are surface-3 wells with strong borders; keep mono typography.
- "Save arguments" becomes primary cobalt; show parse errors as danger (not ember/warning).

Modals (`apps/gui/src/components/ToolCallRequestModal.tsx` and Library view modals)
- Scrim: neutral, calm (`bg-ink/35`).
- Modal surface: overlay glass (blur-lg) + `shadow-popover` + hairline border + inner highlight.
- Close button: ghost icon with clear focus ring.
- Ensure Escape closes (already implemented) and focus-visible styles apply everywhere.

McpView (`apps/gui/src/views/McpView.tsx`)
- Server cards: surface-1, no blur; type badge uses surface-3 and text3.

LibraryView (`apps/gui/src/views/LibraryView.tsx`)
- Sortable rows: unify hover/selected/focus with cobalt ring and surface washes (replace `hover:bg-black/5`, `ring-ink/30`).
- Icon buttons: standard "icon ghost" style with focus rings.
- Errors currently use `var(--ember)`; migrate errors to danger and keep ember for warnings.

## 4) Theme wiring (so tokens actually apply)
- Wire `ThemeProvider` into `apps/gui/src/main.tsx` so `data-theme` gets applied (right now it isn’t mounted anywhere).
- Prevent theme flash: optional inline script in `apps/gui/index.html` to set `data-theme` from localStorage before React mounts.
- Add the existing `ThemeToggle` into `apps/gui/src/views/SettingsView.tsx` (or a header) after it’s fixed to use real token colors.

## 5) Style architecture in this repo
- Keep `apps/gui/src/index.css` as the single import point (it already hosts Tailwind directives).
- Add a small set of recipe classes in `@layer components`:
  - `.panel` (replaces `.panel-bg` behavior; no blur)
  - `.overlay-glass` (blur-md/lg for overlays)
  - `.ui-focus` (shared focus-visible ring)
- (Optional, recommended) introduce minimal UI primitives in `apps/gui/src/components/ui/`:
  - `Button.tsx`, `Input.tsx`, `Panel.tsx` to stop repeating long class strings and ensure state coverage.

## 6) Migration plan (small PRs, minimal churn)
1) Tokens + Tailwind mapping
- Define porcelain/cobalt tokens in `apps/gui/src/index.css`.
- Map Tailwind colors/shadows in `apps/gui/tailwind.config.ts`.
- Add base focus-visible rules.

2) Panel + overlay recipes
- Rebuild `.panel-bg` into the standard panel recipe (remove default blur).
- Add `.overlay-glass` recipe for modals/popovers.

3) Core controls
- Standardize buttons and inputs (primary=cobalt, warning=ember, success=moss, error=danger).
- Fix focus rings across controls.

4) Frame + navigation
- Apply surface hierarchy to `Sidebar`, `Inspector`, and main layout.

5) Sessions screen polish
- Session list + details header + prompt area.

6) Library screen polish
- Sortable rows, icon buttons, modals.

7) MCP + Settings polish
- Cards and empty states.

8) Optional dark theme pass
- Only after light theme is consistent and contrast-checked.

## 7) Verification checklist
- Visual: 1280x800 layout holds; no clipped panels/modals; surface hierarchy obvious; glass only on overlays.
- A11y: keyboard focus is always visible; dialogs trap focus; Escape closes; contrast meets >=4.5:1 for primary text.
- Perf: no large persistent `backdrop-filter`; no blur animations; modal open/close stays smooth in Tauri.
- Done means: primary flows use cobalt consistently, warnings/errors no longer reuse ember, and repeated styling is token-driven (not `black/50`, `white/80` everywhere).
