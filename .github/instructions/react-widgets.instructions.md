---
name: "Widget Authoring"
description: "Rules for creating and editing widget plugins under src/widgets/"
applyTo: "src/widgets/**"
---

## Registration

- `manifest.id` must match the folder name exactly and satisfy `^[a-z0-9][a-z0-9-]{0,63}$`
- Default-export a `Widget` object — `import.meta.glob` picks it up automatically; no manual registration
- `manifest.settings` drives the auto-generated settings UI; supported `kind` values: `string`, `number`, `boolean`, `select`
- If an unsupported `kind` is encountered, log a warning and skip rendering that field

## Storage

- Initialize tables with `CREATE TABLE IF NOT EXISTS` inside `useEffect(() => { ... }, [])`
- Use `api.kv` for small per-instance config; `api.sql` for relational or append-only data
- Always parameterize SQL — never interpolate values into query strings
- Store OAuth/sensitive tokens via `api.secrets`, never in `api.kv` or SQL
- `api.kv` is instance-scoped (prefixed `instanceId::key`); `api.sql` tables are shared across all instances of the same widget type

## SQL file conventions (widgets with sqlite permission)

Every widget that uses `api.sql` must split SQL into two dedicated files:

- **`schema.ts`** — `INIT_SQL` (all `CREATE TABLE IF NOT EXISTS` DDL) and `MIGRATIONS` (`SqlMigration[]`). Imported by the widget component and passed to `useSqlInit`.
- **`queries.ts`** — Named-param query strings for all multi-field INSERT/UPDATE operations. Exported as constants and used with `namedSql()`.

**`constants.ts` must not contain SQL.** Non-SQL constants (labels, colours, style objects, lookup data) live there.

## Named parameters for INSERT / UPDATE

Use `namedSql` from `@renderer/plugins/sqlParams` for any INSERT or UPDATE that has 3+ bound columns. This prevents silent positional-param bugs (e.g. a missing column silently shifting `last_updated` into the wrong slot).

```ts
// queries.ts — use :name placeholders
export const INSERT_ITEM =
  "INSERT INTO items (title, status, created_at) VALUES (:title, :status, :created_at)";

export const UPDATE_ITEM =
  "UPDATE items SET title=:title, status=:status WHERE id=:id";

// component — spread namedSql result into api.sql.run
import { namedSql } from "@renderer/plugins/sqlParams";
import { INSERT_ITEM, UPDATE_ITEM } from "./queries";

await api.sql.run(
  ...namedSql(INSERT_ITEM, { title, status, created_at: Date.now() }),
);
await api.sql.run(...namedSql(UPDATE_ITEM, { title, status, id: item.id }));
```

**Keep raw positional `?` for:**

- Simple single/two-param queries: `DELETE FROM items WHERE id=?`, `UPDATE items SET flag=? WHERE id=?`
- `runBatch` loops where namedSql is called per-item: `const [sql, params] = namedSql(INSERT_X, item); runBatch([{ sql, params }])`
- Complex special SQL: `ON CONFLICT ... DO UPDATE`, `INSERT ... SELECT ... WHERE NOT EXISTS`, CTEs

## Minimal widget skeleton

```tsx
import type { Widget } from "@renderer/plugins/registry";

function MyWidget({
  api,
  settings,
  setTitle,
}: import("@renderer/plugins/registry").WidgetProps) {
  const [data, setData] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.sql
      .exec(
        "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
      )
      .then(() => api.sql.all<{ value: string }>("SELECT value FROM items"))
      .then((rows) => setData(rows.map((r) => r.value).join(", ")))
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error)
    return <div style={{ color: "var(--error)", padding: 8 }}>{error}</div>;
  if (data === null)
    return <div style={{ padding: 8, color: "var(--text-dim)" }}>Loading…</div>;
  return <div style={{ padding: 8 }}>{data || "No items yet."}</div>;
}

const widget: Widget = {
  manifest: {
    id: "my-widget",
    name: "My Widget",
    version: "0.1.0",
    icon: "🔧",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    settings: [
      { kind: "string", key: "label", label: "Label", default: "Hello" },
    ],
    permissions: { sqlite: true },
  },
  Component: MyWidget,
};
export default widget;
```

## Grid sizing

- 12-column layout, 60 px row height; `defaultSize` and `minSize` are in grid units, not pixels
