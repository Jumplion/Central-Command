import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const PING_SCHEMA = `
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

export const PING_MIGRATIONS: SqlMigration[] = [];

export const INSERT_PING = `
INSERT INTO pings (site_id, ts, latency_ms, status_code, is_up)
VALUES (:site_id, :ts, :latency_ms, :status_code, :is_up)
`;

export const LOAD_PINGS = `
SELECT id, site_id, ts, latency_ms, status_code, is_up
FROM pings
WHERE site_id = ? AND ts >= ?
ORDER BY ts ASC
`;

export const PRUNE_PINGS = `DELETE FROM pings WHERE ts < ?`;
