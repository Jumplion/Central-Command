export const UPSERT_USAGE = `INSERT INTO widget_usage (widget_id, instance_id, mount_count, total_duration_ms, last_accessed_at)
   VALUES (:widget_id, :instance_id, :mount_count, :total_duration_ms, :last_accessed_at)
   ON CONFLICT(widget_id, instance_id) DO UPDATE SET
     mount_count       = mount_count + excluded.mount_count,
     total_duration_ms = total_duration_ms + excluded.total_duration_ms,
     last_accessed_at  = excluded.last_accessed_at`;

export const UPSERT_DAILY = `INSERT INTO widget_usage_daily (widget_id, day, mount_count, total_duration_ms)
   VALUES (:widget_id, :day, :mount_count, :total_duration_ms)
   ON CONFLICT(widget_id, day) DO UPDATE SET
     mount_count       = mount_count + excluded.mount_count,
     total_duration_ms = total_duration_ms + excluded.total_duration_ms`;

export const SELECT_TOP_WIDGETS = `SELECT widget_id,
          SUM(mount_count)       AS mount_count,
          SUM(total_duration_ms) AS total_duration_ms,
          MAX(last_accessed_at)  AS last_accessed_at
   FROM widget_usage
   GROUP BY widget_id
   ORDER BY mount_count DESC
   LIMIT 20`;

export const SELECT_ALL_WIDGETS = `SELECT widget_id,
          SUM(mount_count)       AS mount_count,
          SUM(total_duration_ms) AS total_duration_ms,
          MAX(last_accessed_at)  AS last_accessed_at
   FROM widget_usage
   GROUP BY widget_id
   ORDER BY mount_count DESC`;

export const SELECT_DAILY_SERIES = `SELECT day, SUM(mount_count) AS mount_count
   FROM widget_usage_daily
   WHERE day >= :since_day
   GROUP BY day
   ORDER BY day ASC`;
