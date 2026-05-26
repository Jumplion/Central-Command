import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS measurements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         INTEGER NOT NULL,
    latency_ms REAL,
    down_mbps  REAL,
    is_online  INTEGER NOT NULL DEFAULT 0,
    endpoint   TEXT NOT NULL DEFAULT ''
  );
`;

export const MIGRATIONS: SqlMigration[] = [];

export const CHART_WINDOW_MINS = 10;
export const HISTORY_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_INTERVAL_SEC = 30;
export const DEFAULT_LATENCY_HOST = "https://1.1.1.1";
export const DEFAULT_SPEED_URL =
  "https://speed.cloudflare.com/__down?bytes=500000";

export const LATENCY_GOOD_MS = 80;
export const LATENCY_WARN_MS = 200;
