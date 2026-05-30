import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS widget_usage (
    widget_id         TEXT    NOT NULL,
    instance_id       TEXT    NOT NULL,
    mount_count       INTEGER NOT NULL DEFAULT 0,
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    last_accessed_at  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (widget_id, instance_id)
  );

  CREATE TABLE IF NOT EXISTS widget_usage_daily (
    widget_id         TEXT    NOT NULL,
    day               TEXT    NOT NULL,
    mount_count       INTEGER NOT NULL DEFAULT 0,
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (widget_id, day)
  );
`;

export const MIGRATIONS: SqlMigration[] = [];
