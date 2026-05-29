import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const KEEP_API_BASE = "https://keep.googleapis.com/v1";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS notes (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '',
    content     TEXT    NOT NULL DEFAULT '',
    category    TEXT    NOT NULL DEFAULT '',
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

export const MIGRATIONS: SqlMigration[] = [];
