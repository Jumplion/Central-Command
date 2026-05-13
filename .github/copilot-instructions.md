# Central Command — Copilot Instructions

Electron + React + TypeScript desktop dashboard. Three isolated TS projects: `src/main/` (Node), `src/preload/` (bridge), `src/renderer/` (React). Widgets live in `src/widgets/`.

## Commands

- `npm run dev` — Electron + Vite HMR
- `npm run typecheck` — checks both `tsconfig.node.json` and `tsconfig.web.json`
- `npm run build` / `npm run package`
- `npx vitest run` — run all tests; `npx vitest run <path>` for one file

## Architecture

- **Path aliases**: `@shared`, `@main`, `@renderer`, `@widgets` — never use deep relative paths
- **IPC**: channels in `src/shared/ipc.ts`, handlers in `src/main/ipc.ts`, exposed via `src/preload/index.ts`, typed in `src/shared/types.ts`
- **State**: Zustand at `src/renderer/src/state/dashboard.ts`, debounced 150 ms → `state.json`
- **Storage**: `JsonStore` (per-widget `store.json`, instance-scoped by `instanceId::key`) + `SqliteStore` (per-widget `data.db`, type-scoped)
- **Widget discovery**: `import.meta.glob` auto-discovers `src/widgets/*/index.tsx` — no manual registration

## Critical rules (apply everywhere)

- Renderer must never import Node/Electron APIs — use `window.cc` exclusively
- New IPC channel requires 4 edits: `src/shared/ipc.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`
- Widget `manifest.id` must match folder name and satisfy `^[a-z0-9][a-z0-9-]{0,63}$`
- Always use parameterized SQL — never interpolate values into query strings
- `api.kv` is instance-scoped; `api.sql` is widget-type-scoped (shared across instances)
- `src/shared/` is compiled under both tsconfigs — no Node-only APIs there

## Detailed rules (loaded per file type)

- TypeScript & React → `.github/instructions/typescript.instructions.md`
- Widget authoring → `.github/instructions/react-widgets.instructions.md`
- Electron main process → `.github/instructions/electron-main.instructions.md`
- Tests → `.github/instructions/testing.instructions.md`
