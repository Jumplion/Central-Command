import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS media_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    type            TEXT    NOT NULL DEFAULT 'other',
    status          TEXT    NOT NULL DEFAULT 'want',
    pinned          INTEGER NOT NULL DEFAULT 0,
    rating          INTEGER,
    notes           TEXT,
    author_creator  TEXT,
    external_id     TEXT,
    external_source TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS media_status_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    INTEGER NOT NULL,
    status     TEXT    NOT NULL,
    changed_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS media_links (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id        INTEGER NOT NULL,
    linked_item_id INTEGER NOT NULL,
    relation       TEXT    NOT NULL DEFAULT 'related',
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(item_id, linked_item_id)
  );

  CREATE INDEX IF NOT EXISTS idx_media_items_pinned_updated ON media_items(pinned DESC, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_media_history_item_id      ON media_status_history(item_id);
  CREATE INDEX IF NOT EXISTS idx_media_links_item_id        ON media_links(item_id);
`;

export const MIGRATIONS: SqlMigration[] = [];
// When adding columns after v1.0, replace with:
// export const MIGRATIONS: SqlMigration[] = [
//   createMigration('media_items', 'newColumn', 'ALTER TABLE media_items ADD COLUMN newColumn TEXT'),
// ];
