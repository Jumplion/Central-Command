# `src/renderer/src/hooks/` — Reusable React Hooks

This folder contains custom React hooks — reusable pieces of stateful logic that widgets and components can share without copy-pasting code.

## What is a React Hook?

A hook is a function whose name starts with `use`. Hooks let you "hook into" React's state and lifecycle system from inside a function component. The most common built-in hooks are `useState` (local state), `useEffect` (side effects like data loading), and `useCallback` (memoized callbacks).

Custom hooks are just functions that call other hooks and return useful values. They let you extract a pattern like "load data from SQL when the component mounts" into one reusable function.

## Files

| File                    | What it provides                                                      |
| ----------------------- | --------------------------------------------------------------------- |
| `useWidgetData.ts`      | Load rows from a widget's SQLite database and track loading state     |
| `useSqlInit.ts`         | Run a SQL schema setup (CREATE TABLE) once when a widget first mounts |
| `sqlMigrationHelper.ts` | Helper functions to create type-safe SQL migrations                   |
| `SCHEMA_PATTERN.md`     | **Read this first:** Complete guide to the schema migration pattern   |

---

## `useWidgetData.ts`

This hook handles the common pattern of loading rows from a widget's SQLite database.

### What it does

```ts
const [rows, isLoading, reload] = useWidgetData<MyRow>(
  api,
  "SELECT * FROM entries",
  [],
);
```

- Runs the provided `query` with `params` when the component mounts
- Returns `[data, loading, reload]`:
  - `data` — the array of rows (TypeScript generic `T[]`)
  - `loading` — `true` while the query is running
  - `reload` — a function you can call to re-run the query (e.g., after a mutation)
- Re-runs automatically if the `query` or `params` change

### The `paramsKey` trick

A common React gotcha: if you write `useWidgetData(api, query, [someId])`, the `[someId]` array is a _new_ array object on every render, which would cause an infinite re-render loop (`params` changed → re-run query → re-render → params changed → ...).

The hook avoids this by serializing params to a JSON string (`JSON.stringify(params ?? null)`) and using that as the `useEffect`/`useCallback` dependency instead of the array itself. Two arrays with the same contents produce the same string, so unnecessary re-runs are avoided.

### Usage example in a widget

```tsx
const [entries, loading, reload] = useWidgetData<Entry>(
  api,
  "SELECT * FROM entries ORDER BY ts DESC",
);

if (loading) return <p>Loading...</p>;
return (
  <ul>
    {entries.map((e) => (
      <li key={e.id}>{e.note}</li>
    ))}
  </ul>
);
```

---

## `useSqlInit.ts`

Widgets that use SQLite need to create their tables before they can use them. This hook runs a `CREATE TABLE IF NOT EXISTS` statement (or any schema setup SQL) exactly once when the widget mounts, and tracks whether initialization is complete. It also safely applies migrations (schema changes) added after initial release.

### What It Does

```ts
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import type { SqlMigration } from "@renderer/hooks/useSqlInit";

// Schema for initial release
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    ts   INTEGER NOT NULL
  );
`;

// Migrations for columns added AFTER v1.0 was released
const MIGRATIONS: SqlMigration[] = [
  {
    table: "entries",
    column: "priority",
    sql: "ALTER TABLE entries ADD COLUMN priority INTEGER DEFAULT 0",
  },
];

const initialized = useSqlInit(api, INIT_SQL, MIGRATIONS);
```

Returns a boolean — `false` while the schema is being set up, `true` once it's done.

### What the hook automatically handles

✅ Executes INIT_SQL once (idempotent via `CREATE TABLE IF NOT EXISTS`)  
✅ For each migration, checks if the column already exists  
✅ Skips migrations that are already applied  
✅ **Validates** that migrations don't duplicate columns from INIT_SQL (throws an error if detected)  
✅ Returns `ready: boolean` to tell you when it's safe to query

### Why this is needed

SQLite databases are created empty. If a widget tries to `SELECT * FROM entries` before `entries` exists, it will throw an error. `useSqlInit` ensures the schema is ready before the widget tries to use it. The validation also prevents the "duplicate column name" error that occurs when migrations reference columns already in INIT_SQL.

### Usage pattern

```tsx
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { INIT_SQL, MIGRATIONS } from "./constants";

function MyWidget({ api }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
  const [rows, loading] = useWidgetData<Row>(api, "SELECT * FROM entries");

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  if (!ready) return <p>Setting up…</p>;
  if (loading) return <p>Loading…</p>;
  // Now safe to render data
}
```

---

## `sqlMigrationHelper.ts`

Helper functions to make it harder to define migrations incorrectly.

### `createMigration(table, column, sql)`

Creates a type-safe migration object with validation:

```ts
import { createMigration } from "@renderer/hooks/sqlMigrationHelper";

export const MIGRATIONS = [
  createMigration(
    "items",
    "priority",
    "ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0",
  ),
];
```

Validates:

- All parameters are provided
- SQL contains `ALTER TABLE` and `ADD COLUMN`
- Column name appears in the statement

### `emptyMigrations()`

Use this as a placeholder when you don't have any migrations yet:

```ts
import { emptyMigrations } from "@renderer/hooks/sqlMigrationHelper";

export const MIGRATIONS = emptyMigrations();
```

---

## ⚠️ Important: Schema Pattern

**Before creating a new widget, read [SCHEMA_PATTERN.md](./SCHEMA_PATTERN.md)** for the complete guide on how to define INIT_SQL and MIGRATIONS correctly.

The key rule: **All initial columns go in INIT_SQL. Only add migrations for columns added AFTER the initial release.** If you define a column in both places, SQLite will throw a "duplicate column name" error when creating new instances of your widget.
