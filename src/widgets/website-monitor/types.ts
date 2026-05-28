export interface SiteConfig {
  id: string;
  name: string;
  zoneId: string;
}

export interface StatusCodeEntry {
  status: number;
  requests: number;
}

export interface DailyBucket {
  date: string;
  requests: number;
  pageViews: number;
  uniques: number;
  threats: number;
  bytes: number;
  cachedRequests: number;
  statusCodes: StatusCodeEntry[];
}

export interface HourlyBucket {
  datetime: string;
  requests: number;
  pageViews: number;
  uniques: number;
  threats: number;
  statusCodes: StatusCodeEntry[];
}

export interface SiteData {
  siteId: string;
  daily: DailyBucket[];
  hourly: HourlyBucket[];
  error?: string;
}

export interface SiteTotals {
  uniques24h: number;
  requests24h: number;
  threats24h: number;
  uniques30d: number;
  requests30d: number;
  threats30d: number;
  bytes30d: number;
  cachedRequests30d: number;
  botRate30d: number;
  cacheRate30d: number;
}

export interface PingRecord {
  id: number;
  site_id: string;
  ts: number;
  latency_ms: number | null;
  status_code: number | null;
  is_up: number;
}

export interface SslInfo {
  domain: string;
  expiresAt?: Date;
  daysLeft?: number;
  issuer?: string;
  error?: string;
}

export type Tab = "overview" | "traffic" | "bots" | "health" | "sites";
export type Period = "30d" | "24h";
