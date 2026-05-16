# `src/widgets/` — Widget Plugins

This folder contains all the widget plugins. Each widget lives in its own subfolder and is completely self-contained. The app discovers them automatically at build time — no manual registration needed.

## What is a widget?

A widget is a React component that lives in one cell of the dashboard grid. It can store data, make network requests, authenticate with Google services, and interact with the OS. Widgets are isolated from each other — one widget's storage doesn't interfere with another's.

## How auto-discovery works

The renderer's plugin registry (`src/renderer/src/plugins/registry.ts`) uses Vite's `import.meta.glob` to find all files matching `src/widgets/*/index.tsx` at build time. Every folder that has an `index.tsx` with a valid default export becomes an available widget. You never need to register a widget anywhere — just create the folder.

## Folder layout

```
src/widgets/
├── _shared/              # Shared components used by multiple widgets
├── api-tracker/          # Monitors network calls made by other widgets
├── audition-aggregator/  # Tracks acting auditions
├── file-shortcuts/       # Quick-launch file/folder shortcuts
├── gmail/                # Read Gmail inbox
├── job-aggregator/       # Aggregates job listings from multiple sources
├── job-tracker/          # Kanban-style job application tracker
└── media-tracker/        # Track books, movies, TV shows, games
```

## Widget structure

Every widget folder must contain `index.tsx` with a default export of type `Widget`:

```ts
import type { Widget } from '@renderer/plugins/registry';

const widget: Widget = {
  manifest: { /* see below */ },
  Component: ({ api, settings, setTitle }) => { /* JSX */ }
};

export default widget;
```

Larger widgets split their code across multiple files in the same folder (e.g., `components.tsx`, `types.ts`, `helpers.ts`). These are private to the widget — no other widget imports them.

## The manifest

The manifest tells the app everything it needs to know about a widget before rendering it:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Must equal the folder name. Used as the storage namespace on disk. |
| `name` | `string` | Display name shown in the header and Add dialog |
| `description` | `string?` | Shown in the Add widget dialog |
| `version` | `string` | Semver string like `0.1.0` |
| `icon` | `string?` | Emoji shown in the widget header |
| `defaultSize` | `{ w, h }` | Size in grid units (12-col grid, 60px row height) |
| `minSize` | `{ w, h }?` | Minimum size the user can resize to |
| `settings` | `SettingsField[]?` | Declares the settings form fields shown in the ⚙ panel |
| `permissions` | `{ sqlite?, google? }?` | Declare `true` to unlock `api.sql` or `api.google` |
| `platforms` | `string[]?` | `['desktop']` or `['mobile']` — omit for both |

## The `api` prop

The `Component` receives an `api` object scoped to its instance. See `src/renderer/src/plugins/README.md` for a detailed breakdown. Quick reference:

| API | Description |
|---|---|
| `api.kv` | Per-instance JSON key/value storage |
| `api.sql` | Per-widget-type SQLite database (shared across all instances) |
| `api.net.fetch` | HTTP requests (routed through Electron's `net` module, no CORS) |
| `api.secrets` | Per-widget encrypted storage (for API keys etc.) |
| `api.shell` | Open URLs, files, and folders in the OS |
| `api.dialog` | Native file-picker dialog |
| `api.google` | Google OAuth (connect, get token, disconnect) |
| `api.google.shared` | Shared Google auth namespace — one login for all widgets |

## The `settings` prop and `setTitle`

`settings` is a plain `Record<string, unknown>` with the current values for every field declared in `manifest.settings`. It's passed fresh on every render — if the user changes a setting, the component re-renders with the new values.

`setTitle(title)` lets a widget override its header title at runtime (e.g., to show a count or the user's name). Pass `undefined` to restore the manifest name.

## Existing widgets

### `api-tracker`
Displays a live log of every HTTP request made by any widget via `api.net.fetch`. Useful for debugging. Listens to the `apiEvents` event bus rather than making its own requests.

### `audition-aggregator`
Tracks acting auditions with a SQLite database. Supports filtering by status, date range, and role type. Has a multi-tab UI (Active, Past, Stats).

### `file-shortcuts`
A configurable list of files and folders. Click an entry to open it with its default OS application. Shortcuts are stored in KV per instance.

### `gmail`
Reads the user's Gmail inbox using the Gmail API. Requires Google OAuth (`api.google.shared`). Shows a list of recent threads with sender, subject, and snippet.

### `job-aggregator`
Searches for job postings across multiple sources (JSearch API, RSS boards). Has three tabs: Search (live query), Saved (bookmarked jobs), and Boards (curated feeds). Uses SQLite to cache results.

### `job-tracker`
A Kanban board for tracking job applications. Columns: Wishlist → Applied → Interview → Offer → Rejected. Each application is a row in SQLite. Supports CSV import/export and Gmail scanning to auto-update statuses.

### `media-tracker`
Tracks media you're consuming — books, movies, TV shows, video games. Status columns: Want → In Progress → Done → Dropped. Stores everything in SQLite. Has chart visualizations using the shared `StackedBarChart` component.

## `_shared/`

Components used by more than one widget live here. See `src/widgets/_shared/README.md` for details.

---

## Tips for writing widgets

- **Use `useEffect` for timers and subscriptions**, and always return a cleanup function to avoid memory leaks
- **Use `useSqlInit` from `@renderer/hooks/useSqlInit`** to set up your database tables before querying them
- **Use `useWidgetData` from `@renderer/hooks/useWidgetData`** to load SQL rows and handle loading state
- **Never call `api.google.connect()` during render** — it opens a browser window and blocks for up to 5 minutes. Call it from a button's `onClick` handler instead
- **The widget body scrolls automatically** — you don't need `overflow: auto` on your container
- **If your widget crashes, it shows an error without crashing the dashboard** — the `ErrorBoundary` in `WidgetHost` catches rendering errors

---

## Storage API reference

```ts
// JSON key/value (per instance)
await api.kv.set('lastRun', Date.now());
const last = await api.kv.get<number>('lastRun');  // undefined if not set
await api.kv.del('lastRun');
const allKeys = await api.kv.keys();

// SQLite (per widget type, shared across instances)
await api.sql.exec(`CREATE TABLE IF NOT EXISTS entries (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  note TEXT    NOT NULL,
  ts   INTEGER NOT NULL
)`);
await api.sql.run('INSERT INTO entries (note, ts) VALUES (?, ?)', ['hello', Date.now()]);
const rows = await api.sql.all<{ id: number; note: string; ts: number }>(
  'SELECT * FROM entries ORDER BY ts DESC LIMIT 50'
);
const one = await api.sql.get<{ id: number }>('SELECT id FROM entries LIMIT 1');

// Secrets (per widget type, encrypted)
await api.secrets.set('apiKey', 'super-secret-value');
const key = await api.secrets.get('apiKey');  // string | null
await api.secrets.has('apiKey');              // boolean
await api.secrets.del('apiKey');

// Network (no CORS, routed through Electron)
const res = await api.net.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'hello' }),
});
// res.ok: boolean, res.status: number, res.body: string

// Shell and dialog
await api.shell.openExternal('https://example.com');
await api.shell.openPath('/home/user/documents');
await api.shell.showItemInFolder('/home/user/file.txt');
const paths = await api.dialog.openPath({ title: 'Pick a file', properties: ['openFile'] });
```

## Settings fields reference

```ts
type SettingsField =
  | { kind: 'string';  key: string; label: string; default?: string; placeholder?: string; multiline?: boolean }
  | { kind: 'number';  key: string; label: string; default?: number; min?: number; max?: number; step?: number }
  | { kind: 'boolean'; key: string; label: string; default?: boolean }
  | { kind: 'select';  key: string; label: string; default?: string; options: { value: string; label: string }[] };
```

The settings UI is generated automatically from this schema. Defaults are applied when an instance is first added to the dashboard.

## Google OAuth setup

To use `api.google` or `api.google.shared`, you need a Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the API you need (e.g., Gmail API, Google Calendar API)
3. Under "Credentials", create **OAuth 2.0 Client ID** → choose **Desktop app**
4. Add yourself as a test user on the OAuth consent screen
5. Expose the Client ID and Client Secret via widget `settings` fields so the user can paste them in

```ts
// Example: connect on button click
async function handleConnect() {
  await api.google.shared.connect({
    clientId: settings.clientId as string,
    clientSecret: settings.clientSecret as string,
    service: 'gmail',
  });
}

// Example: get a token for API calls
const token = await api.google.shared.getToken('gmail');
if (!token) return; // not connected

const res = await api.net.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Minimal widget example

```tsx
// src/widgets/hello/index.tsx
import type { Widget } from '@renderer/plugins/registry';

const widget: Widget = {
  manifest: {
    id: 'hello',
    name: 'Hello',
    description: 'A minimal demo widget',
    version: '0.1.0',
    icon: '👋',
    defaultSize: { w: 4, h: 3 },
    settings: [
      { kind: 'string', key: 'who', label: 'Who to greet', default: 'world' }
    ]
  },
  Component: ({ settings }) => {
    const who = (settings.who as string) || 'world';
    return <p>Hello, {who}!</p>;
  }
};

export default widget;
```
