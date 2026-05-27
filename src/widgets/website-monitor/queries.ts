import type { SiteData, DailyBucket, HourlyBucket, SslInfo } from "./types";
import { CF_GRAPHQL_URL, CF_ZONES_URL } from "./constants";

type NetFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; body: string }>;

export interface CFZone {
  id: string;
  name: string;
  status: string;
}

export async function fetchZones(
  netFetch: NetFetch,
  token: string,
): Promise<{ zones?: CFZone[]; error?: string }> {
  try {
    const res = await netFetch(CF_ZONES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = JSON.parse(res.body) as {
      success: boolean;
      result?: CFZone[];
      errors?: { message: string }[];
    };
    if (!json.success) {
      return { error: json.errors?.[0]?.message ?? "Request failed" };
    }
    return { zones: json.result ?? [] };
  } catch {
    return { error: "Failed to connect to Cloudflare" };
  }
}

function getDateRanges() {
  const now = new Date();
  const dailyUntil = now.toISOString().slice(0, 10);
  const dailySince = new Date(now.getTime() - 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const hourlyUntil = now.toISOString().replace(/\.\d+Z$/, "Z");
  const hourlySince = new Date(now.getTime() - 24 * 3_600_000)
    .toISOString()
    .replace(/\.\d+Z$/, "Z");
  return { dailySince, dailyUntil, hourlySince, hourlyUntil };
}

export async function fetchSiteData(
  netFetch: NetFetch,
  token: string,
  zoneId: string,
  siteId: string,
): Promise<SiteData> {
  const { dailySince, dailyUntil, hourlySince, hourlyUntil } = getDateRanges();

  const query = `{
    viewer {
      zones(filter: {zoneTag: "${zoneId}"}) {
        httpRequests1dGroups(
          limit: 30
          filter: {date_geq: "${dailySince}", date_leq: "${dailyUntil}"}
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum {
            requests pageViews bytes threats cachedRequests
            responseStatusMap { edgeResponseStatus requests }
          }
          uniq { uniques }
        }
        httpRequests1hGroups(
          limit: 25
          filter: {datetime_geq: "${hourlySince}", datetime_leq: "${hourlyUntil}"}
          orderBy: [datetime_ASC]
        ) {
          dimensions { datetime }
          sum {
            requests pageViews bytes threats
            responseStatusMap { edgeResponseStatus requests }
          }
          uniq { uniques }
        }
      }
    }
  }`;

  try {
    const res = await netFetch(CF_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return { siteId, daily: [], hourly: [], error: `HTTP ${res.status}` };
    }

    const json = JSON.parse(res.body) as {
      errors?: { message: string }[];
      data?: { viewer?: { zones?: Record<string, unknown>[] } };
    };

    if (json.errors?.length) {
      return { siteId, daily: [], hourly: [], error: json.errors[0].message };
    }

    const zones = json.data?.viewer?.zones ?? [];
    if (zones.length === 0) {
      return { siteId, daily: [], hourly: [], error: "Zone not found" };
    }

    const zone = zones[0] as {
      httpRequests1dGroups?: {
        dimensions: { date: string };
        sum: {
          requests: number;
          pageViews: number;
          bytes: number;
          threats: number;
          cachedRequests: number;
          responseStatusMap?: { edgeResponseStatus: number; requests: number }[];
        };
        uniq: { uniques: number };
      }[];
      httpRequests1hGroups?: {
        dimensions: { datetime: string };
        sum: {
          requests: number;
          pageViews: number;
          bytes: number;
          threats: number;
          responseStatusMap?: { edgeResponseStatus: number; requests: number }[];
        };
        uniq: { uniques: number };
      }[];
    };

    const daily: DailyBucket[] = (zone.httpRequests1dGroups ?? []).map(
      (g) => ({
        date: g.dimensions.date,
        requests: g.sum.requests ?? 0,
        pageViews: g.sum.pageViews ?? 0,
        uniques: g.uniq.uniques ?? 0,
        threats: g.sum.threats ?? 0,
        bytes: g.sum.bytes ?? 0,
        cachedRequests: g.sum.cachedRequests ?? 0,
        statusCodes: (g.sum.responseStatusMap ?? []).map((s) => ({
          status: s.edgeResponseStatus,
          requests: s.requests,
        })),
      }),
    );

    const hourly: HourlyBucket[] = (zone.httpRequests1hGroups ?? []).map(
      (g) => ({
        datetime: g.dimensions.datetime,
        requests: g.sum.requests ?? 0,
        pageViews: g.sum.pageViews ?? 0,
        uniques: g.uniq.uniques ?? 0,
        threats: g.sum.threats ?? 0,
        statusCodes: (g.sum.responseStatusMap ?? []).map((s) => ({
          status: s.edgeResponseStatus,
          requests: s.requests,
        })),
      }),
    );

    return { siteId, daily, hourly };
  } catch (e) {
    return {
      siteId,
      daily: [],
      hourly: [],
      error: (e as Error).message ?? "Unknown error",
    };
  }
}

export async function fetchSslExpiry(
  netFetch: NetFetch,
  domain: string,
): Promise<SslInfo> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
  try {
    const res = await netFetch(
      `https://crt.sh/?q=${encodeURIComponent(cleanDomain)}&output=json&deduplicate=Y`,
    );
    if (!res.ok) return { domain: cleanDomain, error: `HTTP ${res.status}` };

    const entries = JSON.parse(res.body) as Array<{
      not_before: string;
      not_after: string;
      name_value: string;
      issuer_name?: string;
    }>;

    const now = Date.now();
    const valid = entries
      .filter((c) => new Date(c.not_after).getTime() > now)
      .sort(
        (a, b) =>
          new Date(b.not_before).getTime() - new Date(a.not_before).getTime(),
      );

    if (valid.length === 0) return { domain: cleanDomain, error: "No valid cert found" };

    const cert = valid[0];
    const expiresAt = new Date(cert.not_after);
    const daysLeft = Math.floor((expiresAt.getTime() - now) / 86_400_000);
    const issuer = cert.issuer_name
      ? (/O=([^,]+)/.exec(cert.issuer_name)?.[1]?.trim() ?? cert.issuer_name)
      : undefined;

    return { domain: cleanDomain, expiresAt, daysLeft, issuer };
  } catch {
    return { domain: cleanDomain, error: "Check failed" };
  }
}
