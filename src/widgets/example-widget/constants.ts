import type { SqlMigration } from "@renderer/hooks/useSqlInit";

// ─── Initial schema ────────────────────────────────────────────────────────
//
// useSqlInit runs this string exactly once against the widget's SQLite
// database before any query is allowed to execute. Because the statement
// uses CREATE TABLE IF NOT EXISTS it is idempotent — safe to call on every
// app launch without destroying existing data.
//
// Define every column the widget needs at its initial release here.
// Do NOT add columns for a "later version" — that is what MIGRATIONS is for.
export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    body       TEXT    NOT NULL,
    pinned     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

// ─── Schema migrations ─────────────────────────────────────────────────────
//
// Every column added AFTER the initial release belongs here, not in INIT_SQL.
//
// The useSqlInit hook inspects each migration before running it:
//   1. PRAGMA table_info(<table>) — skip if the column already exists
//   2. Cross-validates against INIT_SQL — throws if the column is already
//      declared there (SQLite would throw "duplicate column name" at runtime)
//
// Both checks together mean migrations are safe to apply to an existing
// database (column already exists → skip) and to a fresh install (INIT_SQL
// already created it → useSqlInit prevents the duplicate ADD COLUMN).
//
// Example — adding a `color` label in a hypothetical v1.1:
//
//   import { createMigration } from '@renderer/hooks/sqlMigrationHelper';
//   export const MIGRATIONS: SqlMigration[] = [
//     createMigration(
//       'notes',                                      // table name
//       'color',                                      // new column name
//       'ALTER TABLE notes ADD COLUMN color TEXT DEFAULT "default"',
//     ),
//   ];
export const MIGRATIONS: SqlMigration[] = [];
