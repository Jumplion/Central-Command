---
name: 'Widget Authoring'
description: 'Rules for creating and editing widget plugins under src/widgets/'
applyTo: 'src/widgets/**'
---

## Registration

- `manifest.id` must match the folder name exactly and satisfy `^[a-z0-9][a-z0-9-]{0,63}$`
- Default-export a `Widget` object — `import.meta.glob` picks it up automatically; no manual registration
- `manifest.settings` drives the auto-generated settings UI; supported `kind` values: `string`, `number`, `boolean`, `select`
- If an unsupported `kind` is encountered, log a warning and skip rendering that field

## Storage

- Initialize tables with `CREATE TABLE IF NOT EXISTS` inside `useEffect(() => { ... }, [])`
- Use `api.kv` for small per-instance config; `api.sql` for relational or append-only data
- Always parameterize SQL: `api.sql.run('INSERT INTO t VALUES (?,?)', [a, b])` — never interpolate
- Store OAuth/sensitive tokens via `api.secrets`, never in `api.kv` or SQL
- `api.kv` is instance-scoped (prefixed `instanceId::key`); `api.sql` tables are shared across all instances of the same widget type

## Minimal widget skeleton

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
    id: 'my-widget',
    name: 'My Widget',
    version: '0.1.0',
    icon: '🔧',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    settings: [
      { kind: 'string', key: 'label', label: 'Label', default: 'Hello' },
    ],
    permissions: { sqlite: true },
  },
  Component: MyWidget,
};
export default widget;
```

## Grid sizing

- 12-column layout, 60 px row height; `defaultSize` and `minSize` are in grid units, not pixels
