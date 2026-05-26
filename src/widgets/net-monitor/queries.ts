export const INSERT_MEASUREMENT =
  "INSERT INTO measurements (ts, latency_ms, down_mbps, is_online, endpoint) VALUES (:ts, :latency_ms, :down_mbps, :is_online, :endpoint)";

export const LOAD_HISTORY =
  "SELECT * FROM measurements WHERE ts > ? ORDER BY ts ASC";

export const PRUNE_OLD = "DELETE FROM measurements WHERE ts < ?";
