# Central Command — Widget Feature Roadmap

## Context

The Central Command foundation just shipped: an Electron + React + TypeScript
shell with a manifest-based plugin registry, per-widget JSON KV + SQLite
storage, and a draggable grid dashboard. The user has 12 widget ideas they
might want to add over time (one — cross-browser browsing stats — was dropped
from this roadmap because it requires a separate WebExtension subproject).

This document captures each idea with feasibility notes, identifies the
shared infrastructure that needs to be added to the foundation, and proposes
a phased build order so each phase produces something usable. It's a living
backlog — pick from it as priorities shift.

## Foundation today

A widget gets:

- `api.kv` — per-instance JSON key/value
- `api.sql` — per-widget SQLite (parameterized queries)
- `setTitle(...)` — override header title
- Renderer is a normal browser context — `fetch` works, no Node access
- Settings UI auto-rendered from manifest schema

What the foundation does **not** provide yet (these are what each widget
needs added to the core):

- OAuth helper / external auth window plumbing
- Encrypted secret storage (Electron `safeStorage` wrapper)
- Process spawning IPC
- Pty / terminal IPC
- Filesystem read IPC
- HTTP fetch proxy in main (only needed if CORS blocks an API)
- Native notifications IPC
- Background scheduler (for ticks while dashboard is unfocused)
- `shell.openExternal` / `openPath` / `showItemInFolder` IPC
- In-process widget event bus (for cross-widget data flow)

## Tier definitions

- **Tier 1** — self-contained, uses only kv/sql + renderer fetch
- **Tier 2** — needs a new local-only capability (process, fs, pty)
- **Tier 3** — needs OAuth + cloud API
- **Tier 4** — OS-specific or browser-internal data (hardest)

## Feature backlog

### Job application aggregator — Tier 1, S

- v1 is a pure SQLite-backed widget. Schema:
  `applications(id, company, role, status, applied_at, source, link, notes, last_updated)`
  with status enum (Applied/Phone/Onsite/Offer/Rejected/Ghosted).
- Add CSV import/export and a weekly burndown chart (`recharts` is light).
- Optional Tier 3 enrichment later: scan Gmail for "thanks for applying" /
  rejection emails — enable only after the email widget exists.

### File/folder shortcuts — Tier 2, S

- Needs new infra: `shell:openPath`, `shell:showItemInFolder`,
  `shell:openExternal`, `dialog:openPath`.
- Validate paths exist before launching; HTML5 drop accepts files
  (Electron sets `path` on `File`).

### Todoist (or homegrown) checklist — Tier 1.5, S–M

- Todoist still issues personal API tokens — using a token + safeStorage
  drops this from Tier 3 to "needs vault only." OAuth is optional later.
- Sync API v9 supports CORS and incremental sync via `sync_token`.
- Mirror tasks into widget SQLite, queue mutations, flush on connect.

### Cloudflare / website monitor — Tier 1 (uptime) / Tier 3 (Cloudflare API), S

- Uptime: renderer `setInterval` while dashboard is open.
- Cloudflare API uses a bearer token (zone-scoped), CORS-friendly. Endpoints:
  `/zones/:id/analytics/dashboard`, `/zones/:id/ssl/certificate_packs` for
  SSL expiry.
- Token must live in safeStorage vault.
- Real "always-on" pinging needs the background scheduler.

### YouTube watch later / playlists — Tier 3, S–M

- **Watch History is not exposed by YouTube Data API v3** (Takeout only) —
  document this; the widget covers Watch Later, Subscriptions, Playlists,
  Liked Videos.
- Quota: 10k units/day default; `playlistItems.list` = 1 unit, plenty.
- Embed via `https://www.youtube.com/embed/<id>` works inside Electron.

### Recent emails — Tier 3, M

- Gmail API: `users.messages.list` + batched metadata gets. Quota 250
  units/user/sec; ~25 msgs ≈ 125 units. Polling interval setting.
- Show snippet + "Open in Gmail" via `openExternal`; don't render HTML body.
- IMAP for iCloud/Outlook later — needs a Node-side IMAP client + new IPC;
  defer.

### Google Drive browser — Tier 3, M

- Drive REST API is CORS-friendly; renderer can call directly with token.
- `drive.google.com` blocks iframing (`X-Frame-Options`). Realistic v1:
  inline list/search/details, "Open" delegates to `shell.openExternal`.
- Personal-use OAuth: leave consent screen as "Testing" + add self as test
  user. Document this in the widget README.
- 1000 req / 100s / user quota cap — easy to hit while browsing folders.

### GitHub dashboard — local Tier 2 / remote Tier 3, M

- Local: scan a configured "code root" for `.git/HEAD` to find repos. Show
  branch + dirty status (lazy on-click — `git status --porcelain` per repo
  is noisy).
- Remote: GitHub GraphQL with a fine-grained PAT in safeStorage; PAT is far
  simpler than full OAuth here. Cache lists 60–120s, rate limit 5000/hr.
- Needs: fs read IPC, process spawn (for git), safeStorage.

### Audacity recording quick-setup — Tier 2, M

- Audacity's `mod-script-pipe` is the right hook. User enables it once
  (Preferences → Modules). Then the widget drives commands.
- Pipe paths: Windows `\\.\pipe\ToSrvPipe` / `FromSrvPipe`; *nix FIFOs at
  `/tmp/audacity_script_pipe.to.<uid>` / `from.<uid>`.
- Flow: spawn Audacity if not running, poll-connect to pipe, send
  `New:`, set sample rate / channels / project name / output dir, `Record:`.
- Audacity binary path is OS-specific — make it a setting.
- Needs: process spawn IPC + named-pipe/FIFO bridge module in main.

### Active terminal panel — Tier 2, M

- node-pty (native module) in main + xterm.js in renderer.
- IPC: `pty:spawn`, `pty:write`, `pty:resize`, `pty:kill` + `pty:data`
  events back. Track `instanceId → pid`; clean up in `before-quit`
  (existing hook is the right place).
- electron-builder's `install-app-deps` (already wired up) handles the
  Windows / cross-platform rebuild story.
- Default shell: `process.env.SHELL` on *nix, `pwsh` / `cmd` on Windows.
- Gate via a new manifest permission (`pty: true`); the
  `WidgetManifest.permissions` field already exists as a placeholder.

### Program update checker — Tier 4, L

- Per-OS adapter in main; ship one OS first, add others incrementally.
  - macOS: `brew outdated --json=v2`, optional `mas outdated`. Skip Sparkle.
  - Windows: `winget upgrade --include-unknown`; `choco outdated` if Chocolatey present.
  - Linux: detect apt/dnf/pacman/flatpak/snap, run their listing commands.
- Listing commands are all unprivileged — never spawn `sudo`. Widget surfaces
  the list and lets the user open the package manager themselves.
- Cache results 6–24h; user-triggered refresh.

### Contacts consolidation — Tier 3 (Google) / Tier 4 (iCloud), L

- Canonical store: own SQLite.
  Schema sketch: `contacts(id, primary_name, ...)`,
  `identifiers(contact_id, kind, value, source)`,
  `interactions(contact_id, kind, ts, source_ref)`.
  Index identifiers on `(kind, value)` for dedupe.
- Google: People API (OAuth, same Google client setup as Gmail/Drive).
- iCloud: CardDAV via `tsdav` + app-specific password. Document the manual
  password-generation step.
- "Relationship graph" is a v2 — wait until Gmail + Calendar widgets emit
  interactions onto a shared bus.
- Needs: OAuth helper, safeStorage, in-process bus (later).

### Reach-Out tracking — Tier 1 standalone / better with #Contacts

- Cadence model: `desired_interval_days`, `last_contact_at` per contact.
  Daily compute due/overdue.
- Without the Contacts widget feeding it, falls back to manual logging —
  still useful but dull.
- Notifications integration once the notify IPC exists.

## Shared infrastructure additions, ordered by leverage

Build these as needed in the phase ordering below; this is the dependency
order, highest-ROI first.

| # | Module | Unlocks | Notes |
| --- | -------- | --------- | ------- |
| 1 | Shell IPC (`shell:openExternal`, `openPath`, `showItemInFolder`, `dialog:openPath`) | File shortcuts, Drive, Gmail, GitHub, YouTube | ~30 min, highest ROI |
| 2 | safeStorage vault (`secrets:set/get/del/has`, namespaced per widget) | Drive, Gmail, Todoist, Cloudflare, GitHub PAT, YouTube, Contacts | Uses Electron `safeStorage`. Falls back to plaintext on headless Linux — warn |
| 3 | OAuth helper (PKCE + loopback redirect) | Drive, Gmail, YouTube, Todoist (optional), Contacts | **Loopback over custom protocol** — Google's own desktop recommendation. Random port + state + PKCE. Fragile dev-mode + single-instance issues with `app.setAsDefaultProtocolClient` |
| 4 | Process spawn IPC (`process:spawn/write/kill` + `data` event) | Audacity, Update checker, GitHub local | Generic; gate per-widget via `permissions: { spawn: true }` |
| 5 | Filesystem read IPC (`fs:readDir`, `fs:stat`, `fs:exists`) | File shortcuts (drag validate), GitHub local scan | Never expose `fs:writeFile`; allowlist root paths |
| 6 | node-pty IPC (separate from #4 — pty resize/control sequences differ) | Terminal | Verify cross-OS native rebuild before shipping |
| 7 | Native notifications IPC (`notify:show`) | Update checker, monitor, Reach-Out | Trivial wrapper on Electron `Notification` |
| 8 | HTTP fetch proxy (`net:fetch` mirror in main) | Any CORS-blocked API later | Build only when first widget actually needs it |
| 9 | Background scheduler (`schedule:create({widget,instance,intervalMs})` + tick events) | Cloudflare always-on monitor | Optional v1; needed when widgets must run while dashboard is unfocused |
| 10 | In-process event bus (`bus:publish/subscribe`) | Reach-Out consumes Gmail/Calendar | Build only when 2+ widgets need to share data |

## Recommended build order

Each phase ends with something usable. Tackle phases in order; within a
phase, the order is loose.

### Phase 0 — validate the widget system

- **Job application aggregator** (Tier 1, S). Pure widget; exercises forms,
  settings, sql, charts. Proves the contract end to end before any infra
  work.

### Phase 1 — quick infra win

- Build **Shell IPC**.
- **File/folder shortcuts** (S). Smallest "real" widget that needs new
  infra. Drag-and-drop also exercises the renderer.

### Phase 2 — the big infra unlock (auth)

- Build **safeStorage vault**, then **OAuth helper** (loopback PKCE).
- **Todoist** (S, easiest — token via vault, no OAuth flow needed for v1).
- **Cloudflare / website monitor** (S, token-only). Confirms vault for
  non-OAuth secrets.
- **YouTube** (S–M). Cheap second OAuth integration; read-only listings.

### Phase 3 — Google APIs round 2

- **Recent emails** (M). Establishes a reusable Google API helper module.
- **Google Drive** (M). Layered on the same Google client.

### Phase 4 — process integrations

- Build **process spawn IPC** + **filesystem read IPC**.
- **Update checker** (L). Ship with one OS adapter, add others later.
- **GitHub dashboard** (M). Local scan via spawn + remote via PAT.
- **Audacity quick-setup** (M). Add named-pipe/FIFO bridge in main.

### Phase 5 — terminal

- Build **node-pty IPC**.
- **Active terminal** (M). Ensure cross-OS rebuild works first.

### Phase 6 — relationship layer

- Build **in-process bus**, add CardDAV client.
- **Contacts consolidation** (L). Pull from Google People first, dedupe,
  add iCloud later.
- **Reach-Out tracking** (S, after Contacts). Subscribes to interaction
  events from Gmail / Calendar widgets via the bus.

### Phase 7 — optional polish

- Build **notifications IPC** + **background scheduler** when first widget
  needs them (likely during Phase 2 for Cloudflare's always-on case, or
  Phase 4 for update checker alerts — fold in opportunistically).

## Verification

The roadmap is end-to-end testable per phase, not all at once:

- **Per phase**: `npm run build` and `npm run dev`, then exercise the
  newly-shipped widget(s) in the running app. Confirm storage round-trips
  (kill app + relaunch, verify state persists).
- **Per infrastructure addition**: typecheck (`npm run typecheck`), then
  hand-test from a smoke widget that exercises the new IPC, before the real
  consumer widget is built on top.
- **OAuth flow** specifically: test on a fresh user data dir
  (Electron `userData`) — token persistence, refresh, and `safeStorage`
  decryption all need to survive a relaunch and an OS-level keychain prompt.
- **Cross-OS native modules** (better-sqlite3, eventually node-pty): build
  and run on each target OS before shipping the dependent widget. CI matrix
  is the right place if/when that gets set up.

## Critical files to touch

When implementing any of these, the seam files are:

- `/home/user/Central-Command/src/shared/ipc.ts` — new IPC channel constants
- `/home/user/Central-Command/src/shared/types.ts` — extend `CCApi` with new
  capability surfaces; extend `WidgetManifest.permissions` for gated infra
- `/home/user/Central-Command/src/main/ipc.ts` — register new IPC handlers
- `/home/user/Central-Command/src/main/storage/` — pattern to follow for new
  main-side modules (`secrets/`, `oauth/`, `process/`, `pty/`, etc.)
- `/home/user/Central-Command/src/preload/index.ts` — expose new namespaces
  on `window.cc`
- `/home/user/Central-Command/src/renderer/src/plugins/api.ts` — extend
  `WidgetApi` with the per-widget scoped wrapper for the new capability
- `/home/user/Central-Command/src/widgets/README.md` — document the new
  capability and any required permissions
