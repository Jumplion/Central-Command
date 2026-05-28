import type { SiteData, DailyBucket, HourlyBucket, SslInfo } from "./types";
import { CF_GRAPHQL_URL } from "./constants";

type NetFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; body: string }>;

// ── SQL query strings ─────────────────────────────────────────────────────────

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

// ── Cloudflare REST API ───────────────────────────────────────────────────────

export interface CFZone {
  id: string;
  name: string;
  status: string;
}

export async function fetchZones(
  netFetch: NetFetch,
  token: string,
): Promise<{ zones?: CFZone[]; error?: string }> {
  const allZones: CFZone[] = [];
  let page = 1;
  try {
    while (true) {
      const res = await netFetch(
        `https://api.cloudflare.com/client/v4/zones?per_page=50&status=active&page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const json = JSON.parse(res.body) as {
        success: boolean;
        result?: CFZone[];
        result_info?: { page: number; total_pages: number };
        errors?: { message: string }[];
      };
      if (!json.success) {
        return { error: json.errors?.[0]?.message ?? "Request failed" };
      }
      allZones.push(...(json.result ?? []));
      const info = json.result_info;
      if (!info || info.page >= info.total_pages) break;
      page++;
    }
    return { zones: allZones };
  } catch {
    return { error: "Failed to connect to Cloudflare" };
  }
}

// ── Cloudflare GraphQL analytics ──────────────────────────────────────────────

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

// ── SSL certificate expiry ────────────────────────────────────────────────────

export async function fetchSslExpiry(
  netFetch: NetFetch,
  token: string,
  domain: string,
  zoneId: string,
): Promise<SslInfo> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();

  // Prefer Cloudflare's certificate_packs API — returns the live serving cert.
  // Falls back to crt.sh if the token lacks SSL:Read permission (403).
  try {
    const res = await netFetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/ssl/certificate_packs`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const json = JSON.parse(res.body) as {
        success: boolean;
        result?: {
          certificates: {
            id: string;
            issuer: string;
            expires_on: string;
            status: string;
          }[];
          primary_certificate: string;
        }[];
      };
      if (json.success && json.result?.length) {
        const now = Date.now();
        let bestExpiry: Date | null = null;
        let bestIssuer: string | undefined;
        for (const pack of json.result) {
          const cert =
            pack.certificates.find((c) => c.id === pack.primary_certificate) ??
            pack.certificates[0];
          if (!cert || cert.status !== "active") continue;
          const expiresAt = new Date(cert.expires_on);
          if (
            expiresAt.getTime() > now &&
            (!bestExpiry || expiresAt > bestExpiry)
          ) {
            bestExpiry = expiresAt;
            bestIssuer = cert.issuer;
          }
        }
        if (bestExpiry) {
          const daysLeft = Math.floor(
            (bestExpiry.getTime() - now) / 86_400_000,
          );
          return {
            domain: cleanDomain,
            expiresAt: bestExpiry,
            daysLeft,
            issuer: bestIssuer,
          };
        }
      }
    }
    // 403 = token lacks SSL:Read — fall through to crt.sh
  } catch {
    // network error — fall through to crt.sh
  }

  // Fall back: crt.sh certificate transparency log
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

    if (valid.length === 0) {
      return { domain: cleanDomain, error: "No valid cert found" };
    }

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
