# Widget Schema Template

This is a reference template showing the **correct pattern** for defining SQL schemas and migrations.

## Pattern

### 1. **INIT_SQL** — All initial columns go here

```ts
// constants.ts
export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    status    TEXT    NOT NULL DEFAULT 'pending',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;
```

**Key point:** Include ALL columns you need at launch in INIT_SQL. These are part of the initial schema.

### 2. **MIGRATIONS** — Only columns added AFTER initial release

```ts
// constants.ts
import { createMigration, emptyMigrations } from '@renderer/hooks/sqlMigrationHelper';
import type { SqlMigration } from '@renderer/hooks/useSqlInit';

// Initially empty if you don't have any post-release columns to add yet
export const MIGRATIONS: SqlMigration[] = emptyMigrations();

// Later, after you've shipped v1.0 and want to add a new column in v1.1:
// export const MIGRATIONS: SqlMigration[] = [
//   createMigration('items', 'priority', 'ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0'),
//   createMigration('items', 'tags', 'ALTER TABLE items ADD COLUMN tags TEXT'),
// ];
```

**Key point:** Only add columns here that were **not** in the initial INIT_SQL. If a column is already defined there, SQLite will throw "duplicate column name" when creating new widgets.

### 3. **Widget component** — Use `useSqlInit` hook

```tsx
// index.tsx
import { useSqlInit } from '@renderer/hooks/useSqlInit';
import { INIT_SQL, MIGRATIONS } from './constants';

function MyWidget({ api }: WidgetProps) {
  // useSqlInit returns a boolean that tells you when schema is ready
  // It validates migrations and runs them in the correct order
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  useEffect(() => {
    if (ready) {
      // Now it's safe to query the database
      void loadData();
    }
  }, [ready]);

  if (!ready) return <div>Loading…</div>;
  // Render your widget
}
```

## What the `useSqlInit` hook does automatically

✅ Executes INIT_SQL once (idempotent via `CREATE TABLE IF NOT EXISTS`)  
✅ For each migration, checks if the column already exists via `PRAGMA table_info()`  
✅ Skips migrations that are already applied  
✅ **Validates** that migrations don't duplicate columns from INIT_SQL  
✅ Throws an error early if it detects a conflict  
✅ Returns `ready: boolean` to tell you when it's safe to query  

## Common mistakes to avoid

❌ **Mistake:** Defining a column in both INIT_SQL and MIGRATIONS
```ts
// ❌ WRONG — will cause "duplicate column name" error
export const INIT_SQL = `CREATE TABLE items (id INTEGER, title TEXT, status TEXT);`;
export const MIGRATIONS = [
  `ALTER TABLE items ADD COLUMN status TEXT`,  // status is already in INIT_SQL!
];
```

✅ **Fix:** Keep columns in INIT_SQL, remove duplicate from MIGRATIONS
```ts
// ✅ CORRECT
export const INIT_SQL = `CREATE TABLE items (id INTEGER, title TEXT, status TEXT);`;
export const MIGRATIONS: SqlMigration[] = emptyMigrations();
```

---

❌ **Mistake:** Not using `useSqlInit` hook
```ts
// ❌ WRONG — manual error handling
function MyWidget({ api }: WidgetProps) {
  useEffect(() => {
    const init = async () => {
      await api.sql.exec(INIT_SQL);
      for (const sql of MIGRATIONS) {
        try { await api.sql.exec(sql); } catch { /* column exists */ }
      }
    };
    init();
  }, []);
}
```

✅ **Fix:** Use the hook
```ts
// ✅ CORRECT
function MyWidget({ api }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
  
  useEffect(() => {
    if (ready) void loadData();
  }, [ready]);
}
```

---

## Helper functions

Two helper functions make it harder to get migrations wrong:

### `createMigration(table, column, sql)`

Creates a type-safe migration object with validation:

```ts
import { createMigration } from '@renderer/hooks/sqlMigrationHelper';

export const MIGRATIONS = [
  createMigration(
    'items',           // table name
    'priority',        // column name being added
    'ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0'  // full statement
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
import { emptyMigrations } from '@renderer/hooks/sqlMigrationHelper';

export const MIGRATIONS = emptyMigrations();
```

Later, you can replace it with actual migrations.

---

## Copy-paste template for new widgets

```ts
// constants.ts
import { createMigration, emptyMigrations } from '@renderer/hooks/sqlMigrationHelper';
import type { SqlMigration } from '@renderer/hooks/useSqlInit';

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS [your_table_name] (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

export const MIGRATIONS: SqlMigration[] = emptyMigrations();
// When you need to add columns after v1.0, replace with:
// export const MIGRATIONS: SqlMigration[] = [
//   createMigration('[your_table_name]', 'new_column', 'ALTER TABLE [your_table_name] ADD COLUMN new_column TEXT'),
// ];
```

```tsx
// index.tsx
import { useSqlInit } from '@renderer/hooks/useSqlInit';
import { INIT_SQL, MIGRATIONS } from './constants';

function MyWidget({ api }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  useEffect(() => {
    if (ready) void loadData();
  }, [ready]);

  return ready ? <div>Widget content</div> : <div>Loading…</div>;
}
```
