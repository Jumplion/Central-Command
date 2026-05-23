import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS gd_folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    parent_id  INTEGER REFERENCES gd_folders(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    icon       TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gd_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id  INTEGER NOT NULL REFERENCES gd_folders(id) ON DELETE CASCADE,
    field      TEXT    NOT NULL CHECK (field IN ('subject','from','label','snippet')),
    operator   TEXT    NOT NULL CHECK (operator IN ('contains','starts_with','ends_with','regex','not_contains')),
    value      TEXT    NOT NULL,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gd_emails (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_id           TEXT    UNIQUE NOT NULL,
    thread_id          TEXT    NOT NULL,
    subject            TEXT    NOT NULL DEFAULT '',
    from_address       TEXT    NOT NULL DEFAULT '',
    labels             TEXT    NOT NULL DEFAULT '[]',
    received_at        TEXT    NOT NULL,
    snippet            TEXT    NOT NULL DEFAULT '',
    folder_id          INTEGER REFERENCES gd_folders(id) ON DELETE SET NULL,
    override_folder_id INTEGER REFERENCES gd_folders(id) ON DELETE SET NULL,
    is_read            INTEGER NOT NULL DEFAULT 0,
    fetched_at         INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS gd_emails_folder_idx ON gd_emails(folder_id);
  CREATE INDEX IF NOT EXISTS gd_emails_override_idx ON gd_emails(override_folder_id);
  CREATE INDEX IF NOT EXISTS gd_emails_received_idx ON gd_emails(received_at DESC);
`;

export const MIGRATIONS: SqlMigration[] = [];
