export interface Measurement {
  id: number;
  ts: number;
  latency_ms: number | null;
  down_mbps: number | null;
  is_online: number;
  endpoint: string;
}
