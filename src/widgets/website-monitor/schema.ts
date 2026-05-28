import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS pings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    TEXT    NOT NULL,
  ts         INTEGER NOT NULL,
  latency_ms REAL,
  status_code INTEGER,
  is_up      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pings_site_ts ON pings (site_id, ts);
`;

export const MIGRATIONS: SqlMigration[] = [];
