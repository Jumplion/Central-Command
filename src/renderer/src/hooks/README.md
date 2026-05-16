# `src/renderer/src/hooks/` — Reusable React Hooks

This folder contains custom React hooks — reusable pieces of stateful logic that widgets and components can share without copy-pasting code.

## What is a React Hook?

A hook is a function whose name starts with `use`. Hooks let you "hook into" React's state and lifecycle system from inside a function component. The most common built-in hooks are `useState` (local state), `useEffect` (side effects like data loading), and `useCallback` (memoized callbacks).

Custom hooks are just functions that call other hooks and return useful values. They let you extract a pattern like "load data from SQL when the component mounts" into one reusable function.

## Files

| File | What it provides |
|---|---|
| `useWidgetData.ts` | Load rows from a widget's SQLite database and track loading state |
| `useSqlInit.ts` | Run a SQL schema setup (CREATE TABLE) once when a widget first mounts |

---

## `useWidgetData.ts`

This hook handles the common pattern of loading rows from a widget's SQLite database.

### What it does

```ts
const [rows, isLoading, reload] = useWidgetData<MyRow>(api, 'SELECT * FROM entries', []);
```

- Runs the provided `query` with `params` when the component mounts
- Returns `[data, loading, reload]`:
  - `data` — the array of rows (TypeScript generic `T[]`)
  - `loading` — `true` while the query is running
  - `reload` — a function you can call to re-run the query (e.g., after a mutation)
- Re-runs automatically if the `query` or `params` change

### The `paramsKey` trick

A common React gotcha: if you write `useWidgetData(api, query, [someId])`, the `[someId]` array is a *new* array object on every render, which would cause an infinite re-render loop (`params` changed → re-run query → re-render → params changed → ...).

The hook avoids this by serializing params to a JSON string (`JSON.stringify(params ?? null)`) and using that as the `useEffect`/`useCallback` dependency instead of the array itself. Two arrays with the same contents produce the same string, so unnecessary re-runs are avoided.

### Usage example in a widget

```tsx
const [entries, loading, reload] = useWidgetData<Entry>(api, 'SELECT * FROM entries ORDER BY ts DESC');

if (loading) return <p>Loading...</p>;
return (
  <ul>
    {entries.map(e => <li key={e.id}>{e.note}</li>)}
  </ul>
);
```

---

## `useSqlInit.ts`

Widgets that use SQLite need to create their tables before they can use them. This hook runs a `CREATE TABLE IF NOT EXISTS` statement (or any schema setup SQL) exactly once when the widget mounts, and tracks whether initialization is complete.

### What it does

```ts
const initialized = useSqlInit(api, `
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    ts   INTEGER NOT NULL
  );
`);
```

Returns a boolean — `false` while the schema is being set up, `true` once it's done.

### Why this is needed

SQLite databases are created empty. If a widget tries to `SELECT * FROM entries` before `entries` exists, it will throw an error. `useSqlInit` ensures the schema is ready before the widget tries to use it.

### Usage pattern

```tsx
const initialized = useSqlInit(api, CREATE_SCHEMA_SQL);
const [rows, loading] = useWidgetData<Row>(api, 'SELECT * FROM entries');

if (!initialized) return <p>Setting up...</p>;
// Now safe to render data
```
