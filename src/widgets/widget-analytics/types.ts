export interface UsageRow {
  widget_id: string;
  mount_count: number;
  total_duration_ms: number;
  last_accessed_at: number;
}

export interface DailyRow {
  day: string;
  mount_count: number;
}
