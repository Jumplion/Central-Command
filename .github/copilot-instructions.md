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

### Error handling

- **IPC failures**: `window.cc` calls return rejected promises on error. Catch them in the widget and display a non-blocking inline error state rather than letting the rejection propagate unhandled.
- **SQLite errors**: `api.sql` rejects on schema or constraint errors. Always `.catch()` in `useEffect` and surface the message to the user (e.g., `setError(e.message)`).
- **Unrecoverable widget errors**: The `WidgetHost` error boundary catches render-time exceptions. A widget that throws during render is replaced with an error card — the rest of the dashboard stays functional.

### Build and alias conventions

- Respect the project aliases defined in `electron.vite.config.ts`: `@shared`, `@main`, `@renderer`, and `@widgets`.
- The node-side and web-side TypeScript projects are checked separately via `tsconfig.node.json` and `tsconfig.web.json`; changes often need to satisfy both.
- Files in `src/shared/` are compiled under **both** tsconfigs. Do not use Node-only APIs (e.g. `process.env`) directly in shared files — they belong in `src/main/`.

---

## Known pitfalls

### Storage
- `api.kv` keys are prefixed `instanceId::` — use `api.kv.keys()`, not `window.cc.kv.keys()` directly.
- `api.sql` tables are shared across all instances of the same widget type; `api.kv` is per-instance.

### IPC
- Adding a new IPC channel requires 4 changes: `src/shared/ipc.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, and `src/shared/types.ts`.
- `src/main/platform.ts` owns `IS_WSL` — import from there, do not re-declare.

### UI
- `.widget` has `contain: layout style paint`, creating a new stacking context. `position: fixed` and portals are clipped to the widget boundary.
- `WidgetHost` uses `memo()` — pass primitive ids, not fresh object literals, to keep memoization effective.

### Security
- `safeStorage` may not encrypt on headless Linux; secrets fall back to base64. Treat as advisory encryption only.
- The job-capture HTTP server only accepts `chrome-extension://` and `moz-extension://` origins; regular web pages are blocked at CORS.

---

## Widget authoring checklist

If an unsupported `kind` value is encountered, log a warning and skip rendering the settings UI for that field.

When creating a new widget at `src/widgets/<id>/index.tsx`:

### Naming & registration

- `id` must match `^[a-z0-9][a-z0-9-]{0,63}$` **and** equal the folder name.
- Default-export a `Widget` object — the registry picks it up automatically via `import.meta.glob`.
- `manifest.settings` drives the auto-generated settings UI. Supported `kind` values: `string`, `number`, `boolean`, `select`. If an unsupported `kind` value is encountered, log a warning, skip rendering the settings UI for that field, and notify the user in the settings panel.

### Storage rules

- Initialize tables with `api.sql.exec('CREATE TABLE IF NOT EXISTS ...')` inside `useEffect(() => { ... }, [])`.
- Use `api.kv` for small per-instance config; use `api.sql` for relational or append-only data.
- Always use parameterized SQL (`api.sql.run('INSERT ... VALUES (?,?)', [a, b])`); never interpolate values.
- Store OAuth tokens via `api.secrets`, never in `api.kv` or SQL.

### UI & shell rules

- Open external links with `api.shell.openExternal(url)`, not `window.open`.
- Catch all async errors in `useEffect` and surface them with a local `error` state (see skeleton below).

**Minimal widget skeleton:**

```tsx
import type { Widget } from '@renderer/plugins/registry';

function MyWidget({ api, settings, setTitle }: import('@renderer/plugins/registry').WidgetProps) {
  const [data, setData] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.sql
      .exec('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
      .then(() => api.sql.all<{ value: string }>('SELECT value FROM items'))
      .then((rows) => setData(rows.map((r) => r.value).join(', ')))
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <div style={{ color: 'var(--error)', padding: 8 }}>{error}</div>;
  if (data === null) return <div style={{ padding: 8, color: 'var(--text-dim)' }}>Loading…</div>;
  return <div style={{ padding: 8 }}>{data || 'No items yet.'}</div>;
}

const widget: Widget = {
  manifest: {
    id: 'my-widget',        // must match folder name
    name: 'My Widget',
    version: '0.1.0',
    icon: '🔧',
    defaultSize: { w: 4, h: 4 },
    minSize:     { w: 2, h: 2 },
    settings: [
      { kind: 'string', key: 'label', label: 'Label', default: 'Hello' },
    ],
    permissions: { sqlite: true },
  },
  Component: MyWidget,
};
export default widget;
```

---

## Testing

Tests live next to source files as `*.test.ts`. Run all tests:

```bash
npx vitest run
```

Run a single test file:

```bash
npx vitest run src/widgets/job-aggregator/api.test.ts
```

Test aliases (`@shared`, `@renderer`, etc.) are resolved via `vitest.config.ts`.

---

## Browser extension (`extensions/job-capture/`)

- The extension is **Manifest V3** — background scripts must use `"service_worker"`, not `"scripts"`.
- The extension uses the native `browser` global (Chrome 121+); no polyfill is required for current Chrome.
- The capture server only accepts requests from `chrome-extension://` and `moz-extension://` origins. Requests from regular web pages are rejected.
- The server token can be regenerated from the Job Tracker widget settings panel.
