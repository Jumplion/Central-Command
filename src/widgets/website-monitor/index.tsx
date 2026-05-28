import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { namedSql } from "@renderer/plugins/sqlParams";
import { TabBar, LineChart, WidgetLoading } from "../_shared";
import {
  buttonDefault,
  buttonSmall,
  buttonTiny,
  inputBase,
} from "../_shared/styles";
import {
  SITE_COLORS,
  KV_SITES_KEY,
  SECRET_TOKEN_KEY,
  REFRESH_INTERVAL_MS,
  PING_INTERVAL_MS,
  PING_HISTORY_MS,
} from "./constants";
import { INIT_SQL, MIGRATIONS } from "./schema";
import { INSERT_PING, LOAD_PINGS, PRUNE_PINGS } from "./queries";
import type {
  SiteConfig,
  SiteData,
  SiteTotals,
  PingRecord,
  SslInfo,
  Tab,
  Period,
} from "./types";
import { fetchSiteData, fetchZones, fetchSslExpiry } from "./queries";
import type { CFZone } from "./queries";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtPct(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}

function fmtHour(dtStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dtStr));
}

function computeTotals(data: SiteData): SiteTotals {
  const sum24h = data.hourly.reduce(
    (a, h) => ({
      requests: a.requests + h.requests,
      uniques: a.uniques + h.uniques,
      threats: a.threats + h.threats,
    }),
    { requests: 0, uniques: 0, threats: 0 },
  );
  const sum30d = data.daily.reduce(
    (a, d) => ({
      requests: a.requests + d.requests,
      uniques: a.uniques + d.uniques,
      threats: a.threats + d.threats,
      bytes: a.bytes + d.bytes,
      cachedRequests: a.cachedRequests + d.cachedRequests,
    }),
    { requests: 0, uniques: 0, threats: 0, bytes: 0, cachedRequests: 0 },
  );
  return {
    uniques24h: sum24h.uniques,
    requests24h: sum24h.requests,
    threats24h: sum24h.threats,
    uniques30d: sum30d.uniques,
    requests30d: sum30d.requests,
    threats30d: sum30d.threats,
    bytes30d: sum30d.bytes,
    cachedRequests30d: sum30d.cachedRequests,
    botRate30d: sum30d.requests > 0 ? sum30d.threats / sum30d.requests : 0,
    cacheRate30d:
      sum30d.requests > 0 ? sum30d.cachedRequests / sum30d.requests : 0,
  };
}

type DailyMetric = "uniques" | "requests" | "threats" | "pageViews";
type HourlyMetric = "uniques" | "requests" | "threats";

function buildDailyChart(
  sites: SiteConfig[],
  dataMap: Record<string, SiteData>,
  metric: DailyMetric,
): Array<Record<string, string | number>> {
  const dateSet = new Set<string>();
  for (const site of sites) {
    dataMap[site.id]?.daily.forEach((d) => dateSet.add(d.date));
  }
  return Array.from(dateSet)
    .sort()
    .map((date) => {
      const point: Record<string, string | number> = { label: fmtDate(date) };
      for (const site of sites) {
        point[site.id] =
          dataMap[site.id]?.daily.find((d) => d.date === date)?.[metric] ?? 0;
      }
      return point;
    });
}

function buildHourlyChart(
  sites: SiteConfig[],
  dataMap: Record<string, SiteData>,
  metric: HourlyMetric,
): Array<Record<string, string | number>> {
  const dtSet = new Set<string>();
  for (const site of sites) {
    dataMap[site.id]?.hourly.forEach((h) => dtSet.add(h.datetime));
  }
  return Array.from(dtSet)
    .sort()
    .map((dt) => {
      const point: Record<string, string | number> = { label: fmtHour(dt) };
      for (const site of sites) {
        point[site.id] =
          dataMap[site.id]?.hourly.find((h) => h.datetime === dt)?.[metric] ??
          0;
      }
      return point;
    });
}

function buildBotRateChart(
  sites: SiteConfig[],
  dataMap: Record<string, SiteData>,
): Array<Record<string, string | number>> {
  const dateSet = new Set<string>();
  for (const site of sites) {
    dataMap[site.id]?.daily.forEach((d) => dateSet.add(d.date));
  }
  return Array.from(dateSet)
    .sort()
    .map((date) => {
      const point: Record<string, string | number> = { label: fmtDate(date) };
      for (const site of sites) {
        const b = dataMap[site.id]?.daily.find((d) => d.date === date);
        point[site.id] =
          b && b.requests > 0
            ? Math.round((b.threats / b.requests) * 10_000) / 100
            : 0;
      }
      return point;
    });
}

function buildErrorRateChart(
  sites: SiteConfig[],
  dataMap: Record<string, SiteData>,
): Array<Record<string, string | number>> {
  const dateSet = new Set<string>();
  for (const site of sites) {
    dataMap[site.id]?.daily.forEach((d) => dateSet.add(d.date));
  }
  return Array.from(dateSet)
    .sort()
    .map((date) => {
      const point: Record<string, string | number> = { label: fmtDate(date) };
      for (const site of sites) {
        const b = dataMap[site.id]?.daily.find((d) => d.date === date);
        if (!b || b.requests === 0) {
          point[site.id] = 0;
          continue;
        }
        const errors = b.statusCodes
          .filter((s) => s.status >= 400)
          .reduce((a, s) => a + s.requests, 0);
        point[site.id] = Math.round((errors / b.requests) * 10_000) / 100;
      }
      return point;
    });
}

function buildPingChart(
  sites: SiteConfig[],
  pingsMap: Record<string, PingRecord[]>,
): Array<Record<string, string | number>> {
  const now = Date.now();
  const baseHour = Math.floor(now / 3_600_000) * 3_600_000;
  return Array.from({ length: 24 }, (_, i) => {
    const start = baseHour - (23 - i) * 3_600_000;
    const point: Record<string, string | number> = {
      label:
        i % 4 === 0
          ? new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(start))
          : "",
    };
    for (const site of sites) {
      const inBucket = (pingsMap[site.id] ?? []).filter(
        (p) => p.ts >= start && p.ts < start + 3_600_000 && p.is_up === 1,
      );
      point[site.id] =
        inBucket.length > 0
          ? Math.round(
              inBucket.reduce((a, p) => a + (p.latency_ms ?? 0), 0) /
                inBucket.length,
            )
          : 0;
    }
    return point;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SiteLegend({ sites }: { sites: SiteConfig[] }) {
  return (
    <div
      style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
    >
      {sites.map((site, i) => (
        <div
          key={site.id}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: SITE_COLORS[i % SITE_COLORS.length],
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {site.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartSection({
  title,
  data,
  series,
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  series: { key: string; color: string }[];
}) {
  const hasData = data.some((d) =>
    series.some(({ key }) => (d[key] as number) > 0),
  );
  return (
    <div
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 2,
          flexShrink: 0,
        }}
      >
        {title}
      </div>
      {hasData ? (
        <LineChart data={data} series={series} />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-dim)",
            fontSize: 11,
          }}
        >
          No data
        </div>
      )}
    </div>
  );
}

// ── API Key Setup ─────────────────────────────────────────────────────────────

function ApiKeySetup({
  onConnect,
}: {
  onConnect: (token: string) => Promise<string | null>;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!token.trim()) return;
    setConnecting(true);
    setError(null);
    const err = await onConnect(token.trim());
    if (err) setError(err);
    setConnecting(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        padding: "0 24px",
      }}
    >
      <div style={{ fontSize: 22 }}>🌐</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Connect to Cloudflare</div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          textAlign: "center",
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        Enter a Cloudflare API token with{" "}
        <strong>Zone Analytics:Read</strong> and{" "}
        <strong>Zone:Read</strong> permissions.
      </div>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Cloudflare API token"
        style={{
          ...inputBase,
          width: "100%",
          maxWidth: 300,
          boxSizing: "border-box" as const,
        }}
        onKeyDown={(e) => e.key === "Enter" && void handleConnect()}
        autoFocus
      />
      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>
      )}
      <button
        style={buttonDefault}
        onClick={() => void handleConnect()}
        disabled={connecting || !token.trim()}
      >
        {connecting ? "Connecting…" : "Connect"}
      </button>
    </div>
  );
}

// ── Zone Picker ───────────────────────────────────────────────────────────────

function ZonePicker({
  availableZones,
  currentZoneIds,
  onAdd,
  onClose,
}: {
  availableZones: CFZone[];
  currentZoneIds: Set<string>;
  onAdd: (zone: CFZone) => void;
  onClose: () => void;
}) {
  const filtered = availableZones.filter((z) => !currentZoneIds.has(z.id));
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-2)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600 }}>Add a Zone</span>
        <button className="ghost" style={buttonTiny} onClick={onClose}>
          ✕
        </button>
      </div>
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 12,
            fontSize: 11,
            color: "var(--text-dim)",
            textAlign: "center",
          }}
        >
          All zones are already added.
        </div>
      ) : (
        filtered.map((zone) => (
          <div
            key={zone.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 12 }}>{zone.name}</span>
            <button
              className="ghost"
              style={buttonTiny}
              onClick={() => onAdd(zone)}
            >
              + Add
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  sites,
  dataMap,
  pingsMap,
  sslMap,
}: {
  sites: SiteConfig[];
  dataMap: Record<string, SiteData>;
  pingsMap: Record<string, PingRecord[]>;
  sslMap: Record<string, SslInfo>;
}) {
  const totals = sites.map((s) =>
    dataMap[s.id] ? computeTotals(dataMap[s.id]) : null,
  );

  const gridCols = `110px ${sites.map(() => "1fr").join(" ")}`;

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-dim)",
    display: "flex",
    alignItems: "center",
  };
  const valueStyle: React.CSSProperties = {
    textAlign: "center",
    fontSize: 13,
    fontWeight: 600,
  };
  const sectionStyle: React.CSSProperties = {
    gridColumn: "1 / -1",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-dim)",
    paddingTop: 4,
  };

  const Row = ({
    label,
    values,
  }: {
    label: string;
    values: (string | null)[];
  }) => (
    <>
      <div style={labelStyle}>{label}</div>
      {values.map((v, i) => (
        <div key={i} style={valueStyle}>
          {v ?? "—"}
        </div>
      ))}
    </>
  );

  return (
    <div style={{ padding: "2px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          rowGap: 5,
          columnGap: 8,
        }}
      >
        {/* Column headers */}
        <div />
        {sites.map((site, i) => (
          <div
            key={site.id}
            style={{
              fontSize: 11,
              color: "var(--text)",
              textAlign: "center",
              paddingBottom: 4,
              borderBottom: `2px solid ${SITE_COLORS[i % SITE_COLORS.length]}`,
              fontWeight: 600,
            }}
          >
            {site.name}
          </div>
        ))}

        {/* API errors */}
        {sites.some((s) => dataMap[s.id]?.error) && (
          <>
            <div style={labelStyle}>Status</div>
            {sites.map((s) => (
              <div key={s.id} style={{ textAlign: "center", fontSize: 11 }}>
                {dataMap[s.id]?.error ? (
                  <span style={{ color: "var(--danger)", fontSize: 10 }}>
                    {dataMap[s.id].error}
                  </span>
                ) : (
                  <span style={{ color: "#34d399", fontSize: 10 }}>OK</span>
                )}
              </div>
            ))}
          </>
        )}

        {/* 24h section */}
        <div style={sectionStyle}>24 HOURS</div>
        <Row
          label="Visitors"
          values={totals.map((t) => (t ? fmtNum(t.uniques24h) : null))}
        />
        <Row
          label="Requests"
          values={totals.map((t) => (t ? fmtNum(t.requests24h) : null))}
        />
        <Row
          label="Threats"
          values={totals.map((t) => (t ? fmtNum(t.threats24h) : null))}
        />

        <div
          style={{
            gridColumn: "1 / -1",
            borderTop: "1px solid var(--border)",
            marginTop: 2,
          }}
        />

        {/* 30d section */}
        <div style={sectionStyle}>30 DAYS</div>
        <Row
          label="Visitors"
          values={totals.map((t) => (t ? fmtNum(t.uniques30d) : null))}
        />
        <Row
          label="Requests"
          values={totals.map((t) => (t ? fmtNum(t.requests30d) : null))}
        />
        <Row
          label="Bot Rate"
          values={totals.map((t) => (t ? fmtPct(t.botRate30d) : null))}
        />
        <Row
          label="Bandwidth"
          values={totals.map((t) => (t ? fmtBytes(t.bytes30d) : null))}
        />
        <Row
          label="Cache Hit"
          values={totals.map((t) => (t ? fmtPct(t.cacheRate30d) : null))}
        />

        <div
          style={{
            gridColumn: "1 / -1",
            borderTop: "1px solid var(--border)",
            marginTop: 2,
          }}
        />

        {/* Health section */}
        <div style={sectionStyle}>HEALTH</div>
        {/* Uptime ping row */}
        <div style={labelStyle}>Ping</div>
        {sites.map((site) => {
          const last = pingsMap[site.id]?.at(-1) ?? null;
          const isUp = last?.is_up === 1;
          const color = !last
            ? "var(--text-dim)"
            : isUp
              ? "#34d399"
              : "#ef4444";
          return (
            <div
              key={site.id}
              style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color }}
            >
              {!last
                ? "—"
                : isUp
                  ? last.latency_ms != null
                    ? `${last.latency_ms}ms`
                    : "Up"
                  : "Down"}
            </div>
          );
        })}
        {/* SSL expiry row */}
        <div style={labelStyle}>SSL</div>
        {sites.map((site) => {
          const ssl = sslMap[site.id];
          const days = ssl?.daysLeft;
          const color =
            days == null
              ? "var(--text-dim)"
              : days < 14
                ? "#ef4444"
                : days < 30
                  ? "#f59e0b"
                  : "var(--text)";
          return (
            <div
              key={site.id}
              style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color }}
            >
              {ssl?.error ? "—" : days != null ? `${days}d` : "—"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Traffic Tab ───────────────────────────────────────────────────────────────

function TrafficTab({
  sites,
  dataMap,
  period,
  onPeriodChange,
}: {
  sites: SiteConfig[];
  dataMap: Record<string, SiteData>;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const series = sites.map((s, i) => ({
    key: s.id,
    color: SITE_COLORS[i % SITE_COLORS.length],
  }));
  const visitorsData =
    period === "30d"
      ? buildDailyChart(sites, dataMap, "uniques")
      : buildHourlyChart(sites, dataMap, "uniques");
  const requestsData =
    period === "30d"
      ? buildDailyChart(sites, dataMap, "requests")
      : buildHourlyChart(sites, dataMap, "requests");

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
        <TabBar
          tabs={[
            { value: "30d", label: "30d" },
            { value: "24h", label: "24h" },
          ]}
          active={period}
          onChange={onPeriodChange}
          fontSize={10}
          padding="2px 8px"
        />
      </div>
      <ChartSection
        title={`Unique Visitors (${period})`}
        data={visitorsData}
        series={series}
      />
      <ChartSection
        title={`Page Requests (${period})`}
        data={requestsData}
        series={series}
      />
    </div>
  );
}

// ── Bots Tab ──────────────────────────────────────────────────────────────────

function BotsTab({
  sites,
  dataMap,
  period,
  onPeriodChange,
}: {
  sites: SiteConfig[];
  dataMap: Record<string, SiteData>;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const series = sites.map((s, i) => ({
    key: s.id,
    color: SITE_COLORS[i % SITE_COLORS.length],
  }));
  const threatsData =
    period === "30d"
      ? buildDailyChart(sites, dataMap, "threats")
      : buildHourlyChart(sites, dataMap, "threats");
  const botRateData = buildBotRateChart(sites, dataMap);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
        <TabBar
          tabs={[
            { value: "30d", label: "30d" },
            { value: "24h", label: "24h" },
          ]}
          active={period}
          onChange={onPeriodChange}
          fontSize={10}
          padding="2px 8px"
        />
      </div>
      <ChartSection
        title={`Bot/Threat Requests (${period})`}
        data={threatsData}
        series={series}
      />
      {period === "30d" && (
        <ChartSection
          title="Bot Rate % (30d)"
          data={botRateData}
          series={series}
        />
      )}
    </div>
  );
}

// ── Health Tab ────────────────────────────────────────────────────────────────

function HealthTab({
  sites,
  pingsMap,
  sslMap,
  dataMap,
  series,
}: {
  sites: SiteConfig[];
  pingsMap: Record<string, PingRecord[]>;
  sslMap: Record<string, SslInfo>;
  dataMap: Record<string, SiteData>;
  series: { key: string; color: string }[];
}) {
  const pingChartData = buildPingChart(sites, pingsMap);
  const errorRateData = buildErrorRateChart(sites, dataMap);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10 }}
    >
      {/* Live ping status row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexShrink: 0,
          flexWrap: "wrap",
          padding: "2px 0",
        }}
      >
        {sites.map((site) => {
          const last = pingsMap[site.id]?.at(-1) ?? null;
          const isUp = last?.is_up === 1;
          const dotColor = !last
            ? "var(--text-dim)"
            : isUp
              ? "#34d399"
              : "#ef4444";
          return (
            <div
              key={site.id}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: dotColor,
                  boxShadow: last ? `0 0 6px ${dotColor}` : "none",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{site.name}</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {!last
                  ? "No data yet"
                  : isUp
                    ? last.latency_ms != null
                      ? `${last.latency_ms} ms`
                      : "Up"
                    : `Down${last.status_code ? ` (${last.status_code})` : ""}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Ping latency chart */}
      <ChartSection
        title="Response Latency — 24h (ms)"
        data={pingChartData}
        series={series}
      />

      {/* Error rate chart */}
      <ChartSection
        title="Error Rate % — 30d (4xx + 5xx)"
        data={errorRateData}
        series={series}
      />

      {/* SSL certificates table */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            marginBottom: 5,
            fontWeight: 700,
          }}
        >
          SSL CERTIFICATES
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 130px 52px",
            rowGap: 4,
            columnGap: 10,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Site</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Expires</div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              textAlign: "right",
            }}
          >
            Days
          </div>
          {sites.map((site) => {
            const ssl = sslMap[site.id];
            const days = ssl?.daysLeft;
            const expiryColor =
              days == null
                ? "var(--text-dim)"
                : days < 14
                  ? "#ef4444"
                  : days < 30
                    ? "#f59e0b"
                    : "var(--text)";
            return (
              <Fragment key={site.id}>
                <div style={{ fontSize: 11 }}>{site.name}</div>
                <div style={{ fontSize: 11, color: expiryColor }}>
                  {!ssl
                    ? "Checking…"
                    : ssl.error
                      ? ssl.error
                      : ssl.expiresAt
                        ? ssl.expiresAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: expiryColor,
                    textAlign: "right",
                  }}
                >
                  {days != null ? `${days}d` : "—"}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sites Tab ─────────────────────────────────────────────────────────────────

function SitesTab({
  sites,
  onRemoveSite,
  onAddSite,
  onDisconnect,
  loadZones,
}: {
  sites: SiteConfig[];
  onRemoveSite: (id: string) => void;
  onAddSite: (zone: CFZone) => void;
  onDisconnect: () => void;
  loadZones: () => Promise<{ zones?: CFZone[]; error?: string }>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [availableZones, setAvailableZones] = useState<CFZone[] | null>(null);
  const [loadingZones, setLoadingZones] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);

  const currentZoneIds = new Set(sites.map((s) => s.zoneId));

  const handleShowPicker = async () => {
    setShowPicker(true);
    if (!availableZones && !loadingZones) {
      setLoadingZones(true);
      setZonesError(null);
      const result = await loadZones();
      if (result.error) setZonesError(result.error);
      else setAvailableZones(result.zones ?? []);
      setLoadingZones(false);
    }
  };

  return (
    <div style={{ overflow: "auto" }}>
      {/* API token status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 8,
          marginBottom: 10,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            Cloudflare API Token
          </div>
          <div style={{ fontSize: 10, color: "#34d399" }}>● Connected</div>
        </div>
        <button
          className="ghost"
          style={{ ...buttonSmall, color: "var(--danger)" }}
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      </div>

      {/* Site list */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 6,
          color: "var(--text-dim)",
        }}
      >
        MONITORED SITES
      </div>
      {sites.length === 0 ? (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            marginBottom: 10,
          }}
        >
          No sites added yet.
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {sites.map((site, i) => (
            <div
              key={site.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: SITE_COLORS[i % SITE_COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 12 }}>{site.name}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-dim)",
                      fontFamily: "monospace",
                    }}
                  >
                    {site.zoneId}
                  </div>
                </div>
              </div>
              <button
                className="ghost"
                style={{ ...buttonTiny, color: "var(--danger)" }}
                onClick={() => onRemoveSite(site.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!showPicker && (
        <button style={buttonSmall} onClick={() => void handleShowPicker()}>
          + Add Site
        </button>
      )}

      {showPicker &&
        (loadingZones ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              padding: "8px 0",
            }}
          >
            Loading zones…
          </div>
        ) : zonesError ? (
          <div style={{ fontSize: 11, padding: "8px 0" }}>
            <span style={{ color: "var(--danger)" }}>{zonesError}</span>
            <button
              className="ghost"
              style={{ ...buttonTiny, marginLeft: 8 }}
              onClick={() => void handleShowPicker()}
            >
              Retry
            </button>
            <button
              className="ghost"
              style={{ ...buttonTiny, marginLeft: 4 }}
              onClick={() => setShowPicker(false)}
            >
              Cancel
            </button>
          </div>
        ) : availableZones ? (
          <ZonePicker
            availableZones={availableZones}
            currentZoneIds={currentZoneIds}
            onAdd={(zone) => {
              onAddSite(zone);
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        ) : null)}
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

type SetupStep = "init" | "token-input" | "dashboard";

function WebsiteMonitor({ api, setTitle }: WidgetProps) {
  const sqlReady = useSqlInit(api, INIT_SQL, MIGRATIONS);

  const [step, setStep] = useState<SetupStep>("init");
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [dataMap, setDataMap] = useState<Record<string, SiteData>>({});
  const [pingsMap, setPingsMap] = useState<Record<string, PingRecord[]>>({});
  const [sslMap, setSslMap] = useState<Record<string, SslInfo>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState<Period>("30d");

  const sitesRef = useRef<SiteConfig[]>([]);
  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  const loadSitesFromKv = useCallback(async (): Promise<SiteConfig[]> => {
    const raw = await api.kv.get(KV_SITES_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw as string) as SiteConfig[];
    } catch {
      return [];
    }
  }, [api]);

  const saveSites = useCallback(
    async (newSites: SiteConfig[]) => {
      await api.kv.set(KV_SITES_KEY, JSON.stringify(newSites));
    },
    [api],
  );

  const fetchAll = useCallback(
    async (token: string, siteList: SiteConfig[]) => {
      const active = siteList.filter((s) => s.zoneId);
      if (active.length === 0) return;
      setLoading(true);
      const results = await Promise.all(
        active.map((s) => fetchSiteData(api.net.fetch, token, s.zoneId, s.id)),
      );
      const map: Record<string, SiteData> = {};
      for (const r of results) map[r.siteId] = r;
      setDataMap(map);
      setLastUpdated(new Date());
      setLoading(false);
    },
    [api],
  );

  const fetchAllSsl = useCallback(
    async (siteList: SiteConfig[]) => {
      const active = siteList.filter((s) => s.zoneId);
      if (active.length === 0) return;
      const token = (await api.secrets.get(SECRET_TOKEN_KEY)) as string | null;
      if (!token) return;
      const results = await Promise.allSettled(
        active.map(async (s) => ({
          siteId: s.id,
          info: await fetchSslExpiry(api.net.fetch, token, s.name, s.zoneId),
        })),
      );
      setSslMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled") next[r.value.siteId] = r.value.info;
        }
        return next;
      });
    },
    [api],
  );

  const loadAllPings = useCallback(
    async (siteList: SiteConfig[]) => {
      const active = siteList.filter((s) => s.zoneId);
      if (active.length === 0) return;
      const cutoff = Date.now() - PING_HISTORY_MS;
      const map: Record<string, PingRecord[]> = {};
      for (const s of active) {
        map[s.id] = await api.sql.all<PingRecord>(LOAD_PINGS, [s.id, cutoff]);
      }
      setPingsMap(map);
    },
    [api],
  );

  const runAllPings = useCallback(
    async (siteList: SiteConfig[]) => {
      const active = siteList.filter((s) => s.zoneId);
      if (active.length === 0) return;

      await Promise.all(
        active.map(async (site) => {
          const ts = Date.now();
          let latency_ms: number | null = null;
          let status_code: number | null = null;
          let is_up = 0;
          try {
            const url = `https://${site.name.replace(/^https?:\/\//, "")}`;
            const t0 = performance.now();
            const res = await api.net.fetch(url);
            latency_ms = Math.round(performance.now() - t0);
            status_code = res.status;
            is_up = res.status >= 200 && res.status < 400 ? 1 : 0;
          } catch {
            // unreachable — is_up stays 0
          }
          await api.sql.run(
            ...namedSql(INSERT_PING, {
              site_id: site.id,
              ts,
              latency_ms,
              status_code,
              is_up,
            }),
          );
        }),
      );

      await api.sql.run(PRUNE_PINGS, [Date.now() - PING_HISTORY_MS]);
      await loadAllPings(siteList);
    },
    [api, loadAllPings],
  );

  // Initial load
  useEffect(() => {
    const init = async () => {
      const hasToken = await api.secrets.has(SECRET_TOKEN_KEY);
      if (!hasToken) {
        setStep("token-input");
        return;
      }
      const loaded = await loadSitesFromKv();
      setSites(loaded);
      setStep("dashboard");
      const token = (await api.secrets.get(SECRET_TOKEN_KEY)) as string;
      void fetchAll(token, loaded);
      void fetchAllSsl(loaded);
    };
    void init();
  }, [api, loadSitesFromKv, fetchAll, fetchAllSsl]);

  // CF data auto-refresh
  useEffect(() => {
    if (step !== "dashboard") return;
    const id = setInterval(async () => {
      const token = (await api.secrets.get(SECRET_TOKEN_KEY)) as string | null;
      if (token) void fetchAll(token, sitesRef.current);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [step, api, fetchAll]);

  // Ping loop (starts once SQLite is ready and we're in dashboard)
  useEffect(() => {
    if (!sqlReady || step !== "dashboard") return;
    void loadAllPings(sitesRef.current);
    void runAllPings(sitesRef.current);
    const id = setInterval(
      () => void runAllPings(sitesRef.current),
      PING_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [sqlReady, step, loadAllPings, runAllPings]);

  // Title badge on errors
  useEffect(() => {
    const errors = Object.values(dataMap).filter((d) => d.error).length;
    const downSites = Object.values(pingsMap).filter((ps) => {
      const last = ps.at(-1);
      return last && last.is_up === 0;
    }).length;
    const totalIssues = errors + downSites;
    setTitle?.(
      totalIssues > 0 ? `⚠ ${totalIssues} issue${totalIssues > 1 ? "s" : ""}` : undefined,
    );
  }, [dataMap, pingsMap, setTitle]);

  const handleConnect = useCallback(
    async (token: string): Promise<string | null> => {
      const result = await fetchZones(api.net.fetch, token);
      if (result.error) return result.error;
      await api.secrets.set(SECRET_TOKEN_KEY, token);
      const loaded = await loadSitesFromKv();
      setSites(loaded);
      setStep("dashboard");
      void fetchAll(token, loaded);
      void fetchAllSsl(loaded);
      return null;
    },
    [api, loadSitesFromKv, fetchAll, fetchAllSsl],
  );

  const handleDisconnect = useCallback(async () => {
    await api.secrets.del(SECRET_TOKEN_KEY);
    setSites([]);
    setDataMap({});
    setPingsMap({});
    setSslMap({});
    setStep("token-input");
  }, [api]);

  const handleRemoveSite = useCallback(
    async (id: string) => {
      const newSites = sites.filter((s) => s.id !== id);
      setSites(newSites);
      await saveSites(newSites);
      setDataMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPingsMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSslMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [sites, saveSites],
  );

  const handleAddSite = useCallback(
    async (zone: CFZone) => {
      const newSite: SiteConfig = {
        id: `site-${Date.now()}`,
        name: zone.name,
        zoneId: zone.id,
      };
      const newSites = [...sites, newSite];
      setSites(newSites);
      await saveSites(newSites);
      const token = (await api.secrets.get(SECRET_TOKEN_KEY)) as string | null;
      if (token) {
        void fetchSiteData(api.net.fetch, token, zone.id, newSite.id).then(
          (data) => setDataMap((prev) => ({ ...prev, [newSite.id]: data })),
        );
        void fetchSslExpiry(api.net.fetch, token, zone.name, zone.id).then(
          (info) => setSslMap((prev) => ({ ...prev, [newSite.id]: info })),
        );
      }
      if (sqlReady) void runAllPings([newSite]);
    },
    [sites, saveSites, api, sqlReady, runAllPings],
  );

  const handleRefresh = useCallback(async () => {
    const token = (await api.secrets.get(SECRET_TOKEN_KEY)) as string | null;
    if (token) void fetchAll(token, sites);
    void fetchAllSsl(sites);
  }, [api, sites, fetchAll, fetchAllSsl]);

  const loadZones = useCallback(async () => {
    const token = (await api.secrets.get(SECRET_TOKEN_KEY)) as string | null;
    if (!token) return { error: "No API token found" };
    return fetchZones(api.net.fetch, token);
  }, [api]);

  if (step === "init") return <WidgetLoading />;
  if (step === "token-input") return <ApiKeySetup onConnect={handleConnect} />;

  const activeSites = sites.filter((s) => s.zoneId);
  const hasActiveSites = activeSites.length > 0;
  const series = activeSites.map((s, i) => ({
    key: s.id,
    color: SITE_COLORS[i % SITE_COLORS.length],
  }));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "8px 10px",
        gap: 8,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <SiteLegend sites={activeSites} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          {lastUpdated && (
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {lastUpdated.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            className="ghost"
            style={buttonSmall}
            onClick={() => void handleRefresh()}
            disabled={loading || !hasActiveSites}
            title="Refresh data"
          >
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "traffic", label: "Traffic" },
          { value: "bots", label: "Bots" },
          { value: "health", label: "Health" },
          { value: "sites", label: "Sites" },
        ]}
        active={tab}
        onChange={setTab}
        containerStyle={{ flexShrink: 0 }}
        equalWidth
      />

      {/* Tab content */}
      <div
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        {tab === "sites" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <SitesTab
              sites={sites}
              onRemoveSite={(id) => void handleRemoveSite(id)}
              onAddSite={(zone) => void handleAddSite(zone)}
              onDisconnect={() => void handleDisconnect()}
              loadZones={loadZones}
            />
          </div>
        )}

        {tab !== "sites" && !hasActiveSites && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "var(--text-dim)",
            }}
          >
            <div style={{ fontSize: 12 }}>No sites configured.</div>
            <button style={buttonSmall} onClick={() => setTab("sites")}>
              Go to Sites →
            </button>
          </div>
        )}

        {tab === "overview" && hasActiveSites && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <OverviewTab
              sites={activeSites}
              dataMap={dataMap}
              pingsMap={pingsMap}
              sslMap={sslMap}
            />
          </div>
        )}

        {tab === "traffic" && hasActiveSites && (
          <TrafficTab
            sites={activeSites}
            dataMap={dataMap}
            period={period}
            onPeriodChange={setPeriod}
          />
        )}

        {tab === "bots" && hasActiveSites && (
          <BotsTab
            sites={activeSites}
            dataMap={dataMap}
            period={period}
            onPeriodChange={setPeriod}
          />
        )}

        {tab === "health" && hasActiveSites && (
          <HealthTab
            sites={activeSites}
            pingsMap={pingsMap}
            sslMap={sslMap}
            dataMap={dataMap}
            series={series}
          />
        )}
      </div>
    </div>
  );
}

// ── Widget export ─────────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "website-monitor",
    name: "Website Monitor",
    description:
      "Monitor Cloudflare-hosted sites: visitors, traffic, bot activity, bandwidth, uptime pings, SSL expiry, and error rates.",
    version: "0.2.0",
    icon: "🌐",
    defaultSize: { w: 10, h: 11 },
    minSize: { w: 6, h: 7 },
    permissions: { sqlite: true },
  },
  Component: WebsiteMonitor,
};

export default widget;
