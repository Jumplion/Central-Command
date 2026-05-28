import { useState, useEffect, useCallback, useRef } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { namedSql } from "@renderer/plugins/sqlParams";
import { LineChart, WidgetLoading } from "../_shared";
import {
  INIT_SQL,
  MIGRATIONS,
  CHART_WINDOW_MINS,
  HISTORY_WINDOW_MS,
  DEFAULT_INTERVAL_SEC,
  DEFAULT_LATENCY_HOST,
  DEFAULT_SPEED_URL,
  LATENCY_GOOD_MS,
  LATENCY_WARN_MS,
} from "./constants";
import { INSERT_MEASUREMENT, LOAD_HISTORY, PRUNE_OLD } from "./queries";
import type { Measurement } from "./types";

function latencyColor(ms: number | null): string {
  if (ms === null) return "var(--text-dim)";
  if (ms < LATENCY_GOOD_MS) return "#34d399";
  if (ms < LATENCY_WARN_MS) return "#f59e0b";
  return "#ef4444";
}

function fmtLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${Math.round(ms)} ms`;
}

function fmtSpeed(mbps: number | null): string {
  if (mbps === null) return "—";
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  return `${(mbps * 1000).toFixed(0)} Kbps`;
}

function fmtTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

function fmtTimeChart(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function floorToMinute(ts: number): number {
  return Math.floor(ts / 60_000) * 60_000;
}

function bucketByMinute(
  items: Measurement[],
  windowMins: number,
  now: number,
): { label: string; latency: number; speed: number }[] {
  const base = floorToMinute(now);
  const avgArr = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  return Array.from({ length: windowMins + 1 }, (_, i) => {
    const bucketTs = base - (windowMins - i) * 60_000;
    const inBucket = items.filter(
      (m) => m.ts >= bucketTs && m.ts < bucketTs + 60_000,
    );
    const online = inBucket.filter((m) => m.is_online === 1);
    const lats = online
      .map((m) => m.latency_ms)
      .filter((v): v is number => v !== null);
    const spds = online
      .map((m) => m.down_mbps)
      .filter((v): v is number => v !== null);
    // Label every 2 minutes to avoid crowding
    const label = i % 2 === 0 ? fmtTimeChart(bucketTs) : "";
    return { label, latency: avgArr(lats), speed: avgArr(spds) };
  });
}

interface Stats {
  latency: number | null;
  speed: number | null;
  uptime: number | null;
}

function computeWindowStats(items: Measurement[]): Stats {
  if (items.length === 0) return { latency: null, speed: null, uptime: null };
  const online = items.filter((m) => m.is_online === 1);
  const lats = online
    .map((m) => m.latency_ms)
    .filter((v): v is number => v !== null);
  const spds = online
    .map((m) => m.down_mbps)
    .filter((v): v is number => v !== null);
  const avgArr = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    latency: avgArr(lats),
    speed: avgArr(spds),
    uptime: Math.round((online.length / items.length) * 100),
  };
}

function winUpColor(pct: number | null): string {
  if (pct === null) return "var(--text-dim)";
  if (pct >= 99) return "#34d399";
  if (pct >= 95) return "#f59e0b";
  return "#ef4444";
}

function NetMonitor({ api, settings, setTitle }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCheckAtRef = useRef<number | null>(null);

  const checkingRef = useRef(false);
  const latencyHostRef = useRef(DEFAULT_LATENCY_HOST);
  const speedUrlRef = useRef(DEFAULT_SPEED_URL);
  const enableSpeedRef = useRef(true);

  const intervalSec = Math.max(
    10,
    Number(settings.interval ?? DEFAULT_INTERVAL_SEC),
  );
  const latencyHost = String(settings.latencyHost ?? DEFAULT_LATENCY_HOST);
  const speedUrl = String(settings.speedUrl ?? DEFAULT_SPEED_URL);
  const enableSpeed = settings.enableSpeed !== false;

  useEffect(() => {
    latencyHostRef.current = latencyHost;
  }, [latencyHost]);
  useEffect(() => {
    speedUrlRef.current = speedUrl;
  }, [speedUrl]);
  useEffect(() => {
    enableSpeedRef.current = enableSpeed;
  }, [enableSpeed]);

  const loadHistory = useCallback(async () => {
    const rows = await api.sql.all<Measurement>(LOAD_HISTORY, [
      Date.now() - HISTORY_WINDOW_MS,
    ]);
    setMeasurements(rows);
  }, [api]);

  const runCheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);

    const host = latencyHostRef.current;
    const sUrl = speedUrlRef.current;
    const doSpeed = enableSpeedRef.current;
    const ts = Date.now();
    let latency_ms: number | null = null;
    let down_mbps: number | null = null;
    let is_online = 0;

    try {
      const t0 = performance.now();
      const resp = await api.net.fetch(host, { method: "GET" });
      if (resp.status < 500) {
        latency_ms = performance.now() - t0;
        is_online = 1;
      }
    } catch {
      is_online = 0;
    }

    if (is_online && doSpeed) {
      try {
        const t0 = performance.now();
        const resp = await api.net.fetch(sUrl);
        if (resp.ok && resp.body.length > 0) {
          const elapsed = (performance.now() - t0) / 1000;
          const bytes = resp.body.length;
          down_mbps = (bytes * 8) / (elapsed * 1_000_000);
        }
      } catch {
        // Speed test failed; keep null
      }
    }

    try {
      await api.sql.run(
        ...namedSql(INSERT_MEASUREMENT, {
          ts,
          latency_ms,
          down_mbps,
          is_online,
          endpoint: host,
        }),
      );
      await api.sql.run(PRUNE_OLD, [Date.now() - HISTORY_WINDOW_MS]);
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    }

    checkingRef.current = false;
    setChecking(false);
    lastCheckAtRef.current = Date.now();
  }, [api, loadHistory]);

  useEffect(() => {
    if (!ready) return;
    void loadHistory();
    void runCheck();
  }, [ready, loadHistory, runCheck]);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => void runCheck(), intervalSec * 1000);
    return () => clearInterval(id);
  }, [ready, intervalSec, runCheck]);

  useEffect(() => {
    const id = setInterval(() => {
      const last = lastCheckAtRef.current;
      if (last === null || checking) {
        setCountdown(null);
        return;
      }
      const remaining = Math.max(
        0,
        Math.ceil((last + intervalSec * 1000 - Date.now()) / 1000),
      );
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [intervalSec, checking]);

  const latest = measurements.at(-1) ?? null;
  const isOnline = latest?.is_online === 1;

  const nowMs = Date.now();
  const last5 = measurements.filter((m) => m.ts >= nowMs - 5 * 60_000);
  const nowStats = computeWindowStats(latest ? [latest] : []);
  const last5Stats = computeWindowStats(last5);
  const hrStats = computeWindowStats(measurements);

  useEffect(() => {
    if (!latest) return;
    if (!isOnline) setTitle("⚠ Offline");
    else setTitle(undefined);
  }, [isOnline, latest, setTitle]);

  const hasLatency = measurements.some((m) => m.is_online === 1);
  const hasSpeed = measurements.some((m) => m.down_mbps !== null);
  const chartData = bucketByMinute(measurements, CHART_WINDOW_MINS, nowMs);

  if (!ready) return <WidgetLoading />;

  if (error) {
    return (
      <div style={{ padding: 12, color: "var(--error)", fontSize: 12 }}>
        {error}
      </div>
    );
  }

  const statusColor = !latest
    ? "var(--text-dim)"
    : isOnline
      ? "#34d399"
      : "#ef4444";
  const statusLabel = !latest ? "Checking…" : isOnline ? "Online" : "Offline";

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
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{statusLabel}</span>
          {latest && (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {latencyHost.replace(/^https?:\/\//, "")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {latest && (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {fmtTime(latest.ts)}
            </span>
          )}
          {countdown !== null && !checking && (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              next in {countdown}s
            </span>
          )}
          <button
            style={{ fontSize: 11, padding: "2px 8px" }}
            disabled={checking}
            onClick={() => void runCheck()}
          >
            {checking ? "…" : "↺"}
          </button>
        </div>
      </div>

      {/* ── Stats table ────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "52px 1fr 1fr 1fr",
          rowGap: 3,
          flexShrink: 0,
        }}
      >
        {/* Column headers */}
        <div />
        {(["Now", "5 min", "1 hr"] as const).map((h) => (
          <div
            key={h}
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              textAlign: "center",
              paddingBottom: 3,
              borderBottom: "1px solid var(--border)",
            }}
          >
            {h}
          </div>
        ))}
        {/* Latency row */}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            display: "flex",
            alignItems: "center",
          }}
        >
          Latency
        </div>
        {([nowStats, last5Stats, hrStats] as const).map((s, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              color: latencyColor(s.latency),
            }}
          >
            {fmtLatency(s.latency)}
          </div>
        ))}
        {/* Speed row */}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            display: "flex",
            alignItems: "center",
          }}
        >
          Speed
        </div>
        {([nowStats, last5Stats, hrStats] as const).map((s, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              color: "#60a5fa",
            }}
          >
            {fmtSpeed(s.speed)}
          </div>
        ))}
        {/* Uptime row */}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            display: "flex",
            alignItems: "center",
          }}
        >
          Uptime
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            color: statusColor,
          }}
        >
          {statusLabel}
        </div>
        {([last5Stats, hrStats] as const).map((s, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              color: winUpColor(s.uptime),
            }}
          >
            {s.uptime !== null ? `${s.uptime}%` : "—"}
          </div>
        ))}
      </div>

      {/* ── Side-by-side charts ────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 8,
        }}
      >
        {/* Latency chart */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              marginBottom: 2,
              flexShrink: 0,
            }}
          >
            Latency (ms)
          </div>
          {hasLatency ? (
            <LineChart
              data={chartData}
              series={[{ key: "latency", color: "#34d399" }]}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-dim)",
                fontSize: 12,
              }}
            >
              Gathering data…
            </div>
          )}
        </div>

        {/* Speed chart */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              marginBottom: 2,
              flexShrink: 0,
            }}
          >
            Speed (Mbps)
          </div>
          {hasSpeed ? (
            <LineChart
              data={chartData}
              series={[{ key: "speed", color: "#60a5fa" }]}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-dim)",
                fontSize: 12,
              }}
            >
              {enableSpeed ? "Gathering speed data…" : "Speed test disabled"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: "net-monitor",
    name: "Network Monitor",
    description:
      "Live internet dashboard: connection status, latency, download speed, and history charts",
    version: "0.1.0",
    icon: "📡",
    defaultSize: { w: 8, h: 8 },
    minSize: { w: 4, h: 5 },
    settings: [
      {
        kind: "number",
        key: "interval",
        label: "Check interval (seconds)",
        default: DEFAULT_INTERVAL_SEC,
        min: 10,
        max: 3600,
        step: 5,
      },
      {
        kind: "string",
        key: "latencyHost",
        label: "Latency test host",
        default: DEFAULT_LATENCY_HOST,
        placeholder: "https://1.1.1.1",
      },
      {
        kind: "boolean",
        key: "enableSpeed",
        label: "Enable speed test",
        default: true,
      },
      {
        kind: "string",
        key: "speedUrl",
        label: "Speed test URL",
        default: DEFAULT_SPEED_URL,
        placeholder: "https://speed.cloudflare.com/__down?bytes=500000",
      },
    ],
    permissions: { sqlite: true },
  },
  Component: NetMonitor,
};

export default widget;
