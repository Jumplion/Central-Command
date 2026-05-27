export interface SiteConfig {
  id: string;
  name: string;
  zoneId: string;
}

export interface DailyBucket {
  date: string;
  requests: number;
  pageViews: number;
  uniques: number;
  threats: number;
  bytes: number;
  cachedRequests: number;
}

export interface HourlyBucket {
  datetime: string;
  requests: number;
  pageViews: number;
  uniques: number;
  threats: number;
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

export type Tab = "overview" | "traffic" | "bots" | "sites";
export type Period = "30d" | "24h";
