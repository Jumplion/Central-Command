# Widget authoring

A widget is a self-contained module that renders inside a Central Command
dashboard cell. To add one, create a folder under this directory and drop in an
`index.tsx` that default-exports a `Widget` object. The plugin registry picks
it up automatically on the next dev/build cycle.

## Folder layout

```bash
src/widgets/
└── <id>/
    ├── index.tsx       # required - default export of type Widget
    ├── components/...  # optional - your widget's internal components
    └── ...
```

`<id>` must match `^[a-z0-9][a-z0-9-]{0,63}$`. It's used as the folder name on
disk for the widget's storage namespace, so it must be filesystem-safe.

## Widget shape

```ts
import type { Widget } from '@renderer/plugins/registry';

const widget: Widget = {
  manifest: { /* see below */ },
  Component: function MyWidget(props) { /* ... */ }
};

export default widget;
```

## Manifest

| Field          | Type                                       | Notes                                   |
| -------------- | ------------------------------------------ | --------------------------------------- |
| `id`           | `string`                                   | Must equal the folder name              |
| `name`         | `string`                                   | Display name                            |
| `description`  | `string?`                                  | Shown in the Add dialog                 |
| `version`      | `string`                                   | Semver-ish, e.g. `0.1.0`                |
| `author`       | `string?`                                  | Optional                                |
| `icon`         | `string?`                                  | Emoji or short string used in header    |
| `defaultSize`  | `{ w: number; h: number }`                 | Grid cells (12-col layout, 60px rows)   |
| `minSize`      | `{ w: number; h: number }?`                | Minimum drag/resize size                |
| `settings`     | `SettingsField[]?`                         | Schema for the per-instance settings UI |
| `permissions`  | `{ sqlite?: boolean }?`                    | Declare capabilities used by this widget |

### SettingsField

```ts
type SettingsField =
  | { kind: 'string'; key: string; label: string; default?: string; placeholder?: string; multiline?: boolean }
  | { kind: 'number'; key: string; label: string; default?: number; min?: number; max?: number; step?: number }
  | { kind: 'boolean'; key: string; label: string; default?: boolean }
  | { kind: 'select'; key: string; label: string; default?: string; options: { value: string; label: string }[] };
```

The settings UI is rendered automatically from this schema. Defaults are
applied when an instance is first added.

## Component contract

```ts
interface WidgetProps {
  api: WidgetApi;                                // storage scoped to this instance
  settings: Record<string, unknown>;             // current settings values
  setTitle: (title: string | undefined) => void; // override the header title
}
```

### Storage

- `api.kv` is a JSON key/value store **scoped to this widget instance**. Two
  instances of the same widget do not share keys.
- `api.sql` is a SQLite database **shared across all instances of this
  widget**. Use it for structured data (logs, time-series, etc). Always use
  parameterized queries; never interpolate untrusted values.

```ts
await api.kv.set('lastRun', Date.now());
const last = await api.kv.get<number>('lastRun');

await api.sql.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    ts   INTEGER NOT NULL
  );
`);
await api.sql.run('INSERT INTO entries (note, ts) VALUES (?, ?)', ['hello', Date.now()]);
const rows = await api.sql.all<{ id: number; note: string; ts: number }>(
  'SELECT * FROM entries ORDER BY ts DESC LIMIT 50'
);
```

## Minimal example

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
    minSize: { w: 2, h: 2 },
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

## Shell & dialog APIs

Widgets have access to OS-level shell and dialog helpers via `api.shell` and
`api.dialog`:

```ts
// Open a URL in the default browser (http/https/mailto only)
await api.shell.openExternal('https://example.com');

// Open a file or folder with the OS default app
await api.shell.openPath('/home/user/documents');

// Reveal a path in the system file manager
await api.shell.showItemInFolder('/home/user/file.txt');

// Open a native file-picker dialog; returns null if cancelled
const paths = await api.dialog.openPath({
  title: 'Pick a file',
  properties: ['openFile', 'multiSelections'],
});
// properties options: 'openFile' | 'openDirectory' | 'multiSelections'
```

## Permissions

The `manifest.permissions` field gates optional capabilities:

| Key      | Type      | Description                         |
| -------- | --------- | ----------------------------------- |
| `sqlite` | `boolean` | Declare that this widget uses `api.sql` |

Future gated capabilities (process spawn, pty, etc.) will use additional keys
here.

## Tips

- Long-running side effects belong in `useEffect`. Cancel them on unmount.
- The widget body is scrollable; you don't need to handle overflow yourself.
- If a widget throws during render, the host shows an error and the rest of
  the dashboard keeps working.
- Network calls go out from the renderer like any browser fetch. Be aware of
  CORS.
