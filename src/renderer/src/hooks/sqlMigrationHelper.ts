import type { SqlMigration } from "./useSqlInit";

/**
 * Helper to create type-safe SQL migrations.
 * Enforces the SqlMigration structure and prevents common mistakes.
 *
 * @example
 * ```ts
 * export const MIGRATIONS = [
 *   createMigration('items', 'priority', 'ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0'),
 *   createMigration('items', 'tags', 'ALTER TABLE items ADD COLUMN tags TEXT'),
 * ];
 * ```
 *
 * IMPORTANT: Only add columns that were NOT in INIT_SQL.
 * If a column is already in the initial schema, SQLite will throw "duplicate column name".
 *
 * @param table - Table name (must match CREATE TABLE name in INIT_SQL)
 * @param column - Column name being added
 * @param sql - Full ALTER TABLE statement
 */
export function createMigration(
  table: string,
  column: string,
  sql: string,
): SqlMigration {
  if (!table || !column || !sql) {
    throw new Error("createMigration: table, column, and sql are required");
  }
  if (!sql.toLowerCase().includes("alter table")) {
    throw new Error(
      `createMigration: sql must be an ALTER TABLE statement, got: ${sql}`,
    );
  }
  if (!sql.toLowerCase().includes("add column")) {
    throw new Error(`createMigration: sql must ADD a column, got: ${sql}`);
  }
  if (!sql.includes(column)) {
    console.warn(
      `createMigration: column name "${column}" does not appear in sql statement`,
    );
  }
  return { table, column, sql };
}
