# Central Command Copilot Instructions

## Build, test, and lint commands

```bash
npm install         # install dependencies
npm run dev         # Electron + Vite dev server with HMR
npm run typecheck   # type-check main/preload/shared and renderer/widgets projects
npm run build       # build Electron main, preload, and renderer bundles
npm run package     # build and package with electron-builder
```

There is currently **no test script** and **no lint script** in `package.json`, so there is no single-test or single-file lint command to run yet.

## High-level architecture

This repository is an Electron desktop app built as **three separate TypeScript projects** with `electron-vite`:

- `src/main/`: Electron main process. Creates the browser window, owns application shutdown, registers IPC handlers, and manages persistent storage.
- `src/preload/`: the only bridge between browser code and Electron/Node. It exposes `window.cc`, typed by `CCApi` in `src/shared/types.ts`.
- `src/renderer/`: the React dashboard UI. It cannot access Node/Electron directly; all system access flows through `window.cc`.
- `src/shared/`: shared IPC channel names, default state, and TypeScript contracts used on both sides of the bridge.
- `src/widgets/`: widget plugins that are discovered at build time and rendered inside the dashboard grid.

The main data flow is:

1. `src/main/index.ts` creates `Storage`, registers IPC handlers from `src/main/ipc.ts`, and starts the renderer window.
2. `src/preload/index.ts` exposes `window.cc.state`, `window.cc.kv`, `window.cc.sql`, `window.cc.shell`, `window.cc.dialog`, and `window.cc.net`.
3. `src/renderer/src/state/dashboard.ts` loads app state through `window.cc.state.load()`, keeps it in a Zustand store, and persists changes with a 150 ms debounce.
4. `src/renderer/src/components/Dashboard.tsx` renders widget instances with `react-grid-layout`, and `WidgetHost.tsx` creates each widget's scoped API object before rendering it.

Persistence is split across two layers under Electron's `userData` directory:

- App-level dashboard state lives in `state.json`.
- Per-widget storage lives under `widgets/<widgetId>/`.
  - `store.json` is JSON KV storage.
  - `data.db` is a SQLite database.

## Key conventions

### Widget plugin model

- Widgets are auto-registered with `import.meta.glob('../../../widgets/*/index.tsx', { eager: true })`; do not add manual registration code.
- A widget folder name and `manifest.id` must match and satisfy `^[a-z0-9][a-z0-9-]{0,63}$`.
- Each widget default-exports a `Widget` object with `manifest` and `Component`.
- `manifest.settings` is not just metadata: it drives the settings UI automatically and seeds default instance settings.

### Storage and scoping rules

- `api.kv` is **instance-scoped** in practice. The renderer prefixes keys as `instanceId::key`, even though the backing file is shared per widget type.
- `api.sql` is **shared across all instances of the same widget type** because each widget id gets one SQLite database.
- Use parameterized SQL queries; storage code assumes widgets pass SQL and params separately.

### Process boundaries

- Renderer code should not import Electron or Node APIs directly; go through `window.cc`.
- Shared contracts belong in `src/shared/` so main, preload, and renderer stay in sync.
- New IPC channels should be defined in `src/shared/ipc.ts`, implemented in `src/main/ipc.ts`, and exposed from `src/preload/index.ts`.

### State and UI behavior

- Dashboard mutations live in the Zustand store in `src/renderer/src/state/dashboard.ts`; that store is the source of truth for dashboards, widget instances, layouts, settings, and title overrides.
- Widget titles can be overridden per instance with `setTitle`, and widgets are rendered behind an error boundary so one broken widget should not take down the whole dashboard.
- Grid sizing uses a 12-column layout with 60 px row height, and widget sizes in manifests are specified in grid units, not pixels.

### Build and alias conventions

- Respect the project aliases defined in `electron.vite.config.ts`: `@shared`, `@main`, `@renderer`, and `@widgets`.
- The node-side and web-side TypeScript projects are checked separately via `tsconfig.node.json` and `tsconfig.web.json`; changes often need to satisfy both.
