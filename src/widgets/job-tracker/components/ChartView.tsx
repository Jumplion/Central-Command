import { useState, useMemo } from "react";
import { StackedBarChart } from "@widgets/_shared/StackedBarChart";
import { LineChart } from "@widgets/_shared/LineChart";
import { PieChart } from "@widgets/_shared/PieChart";
import type { PieSlice } from "@widgets/_shared/PieChart";
import type { Application } from "../types";
import { STATUSES, STATUS_COLOR } from "../types";

// ─── ChartView ────────────────────────────────────────────────────────────

type ChartType = "bar" | "line" | "pie";
type TimeRange = "2w" | "4w" | "8w" | "3m" | "6m" | "all";
type Grouping = "day" | "week" | "month";
type DataMode = "event" | "applied";
type PieDimension = "status" | "source";

const TIME_RANGE_DAYS: Record<Exclude<TimeRange, "all">, number> = {
  "2w": 14,
  "4w": 28,
  "8w": 56,
  "3m": 90,
  "6m": 180,
};

function bucketKey(d: Date, grouping: Grouping): string {
  if (grouping === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (grouping === "week") {
    const sun = new Date(d);
    sun.setDate(d.getDate() - d.getDay());
    sun.setHours(0, 0, 0, 0);
    return sun.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key: string, grouping: Grouping): string {
  if (grouping === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }
  // Parse YYYY-MM-DD avoiding timezone shift
  const [y, mo, day] = key.split("-").map(Number);
  const d = new Date(y, mo - 1, day);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function generateBucketKeys(
  start: Date,
  end: Date,
  grouping: Grouping,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endMs = end.getTime();
  while (cur.getTime() <= endMs) {
    const k = bucketKey(cur, grouping);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
    if (grouping === "day") cur.setDate(cur.getDate() + 1);
    else if (grouping === "week") cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

function buildTimeSeriesData(
  apps: Application[],
  timeRange: TimeRange,
  grouping: Grouping,
  dataMode: DataMode,
): Array<Record<string, string | number>> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let start: Date;
  if (timeRange === "all") {
    const earliest = apps.reduce<number | null>((min, a) => {
      const t = new Date(a.applied_at).getTime();
      return min === null || t < min ? t : min;
    }, null);
    start = earliest ? new Date(earliest) : new Date();
  } else {
    start = new Date(today);
    start.setDate(today.getDate() - TIME_RANGE_DAYS[timeRange]);
  }
  start.setHours(0, 0, 0, 0);

  const buckets: Record<string, Record<string, number>> = {};
  const keys = generateBucketKeys(start, today, grouping);
  for (const k of keys) {
    buckets[k] = {};
    for (const s of STATUSES) buckets[k][s] = 0;
  }

  for (const app of apps) {
    if (dataMode === "applied") {
      // Cohort view: bucket by applied_at, count by current status
      const appDate = new Date(app.applied_at);
      if (appDate < start || appDate > today) continue;
      const k = bucketKey(appDate, grouping);
      if (k in buckets)
        buckets[k][app.status] = (buckets[k][app.status] ?? 0) + 1;
    } else {
      // Event view: "Applied" event at applied_at; status-change event at last_updated
      const appDate = new Date(app.applied_at);
      if (appDate >= start && appDate <= today) {
        const k = bucketKey(appDate, grouping);
        if (k in buckets)
          buckets[k]["Applied"] = (buckets[k]["Applied"] ?? 0) + 1;
      }
      if (app.status !== "Applied") {
        const eventDate = new Date(app.last_updated); // ms timestamp
        if (eventDate >= start && eventDate <= today) {
          const k = bucketKey(eventDate, grouping);
          if (k in buckets)
            buckets[k][app.status] = (buckets[k][app.status] ?? 0) + 1;
        }
      }
    }
  }

  return keys.map((k) => ({
    label: bucketLabel(k, grouping),
    ...buckets[k],
  }));
}

function CtrlBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 4,
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text-dim)",
        cursor: "pointer",
        lineHeight: 1.4,
      }}
    >
      {children}
    </button>
  );
}

export function ChartView({ apps }: { apps: Application[] }) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [timeRange, setTimeRange] = useState<TimeRange>("8w");
  const [grouping, setGrouping] = useState<Grouping>("week");
  const [dataMode, setDataMode] = useState<DataMode>("event");
  const [pieDim, setPieDim] = useState<PieDimension>("status");

  const series = useMemo(
    () => STATUSES.map((s) => ({ key: s, color: STATUS_COLOR[s] })),
    [],
  );

  const timeSeriesData = useMemo(
    () =>
      chartType !== "pie"
        ? buildTimeSeriesData(apps, timeRange, grouping, dataMode)
        : [],
    [apps, chartType, timeRange, grouping, dataMode],
  );

  const pieData = useMemo<PieSlice[]>(() => {
    if (chartType !== "pie") return [];
    if (pieDim === "status") {
      return STATUSES.map((s) => ({
        label: s,
        value: apps.filter((a) => a.status === s).length,
        color: STATUS_COLOR[s],
      })).filter((s) => s.value > 0);
    }
    // by source
    const counts: Record<string, number> = {};
    for (const a of apps) {
      const src = a.source || "Unknown";
      counts[src] = (counts[src] ?? 0) + 1;
    }
    const palette = [
      "#6ea8ff",
      "#a78bfa",
      "#34d399",
      "#f59e0b",
      "#ff6e6e",
      "#06b6d4",
      "#ec4899",
      "#84cc16",
      "#f97316",
      "#6b7280",
    ];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: palette[i % palette.length],
      }));
  }, [apps, chartType, pieDim]);

  if (apps.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontSize: 13,
        }}
      >
        No applications yet
      </div>
    );
  }

  const isTimeSeries = chartType !== "pie";

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Controls row 1: chart type + time range / pie dimension */}
      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 2 }}>
          {(["bar", "line", "pie"] as ChartType[]).map((t) => (
            <CtrlBtn
              key={t}
              active={chartType === t}
              onClick={() => setChartType(t)}
            >
              {t === "bar" ? "Bar" : t === "line" ? "Line" : "Pie"}
            </CtrlBtn>
          ))}
        </div>
        <div
          style={{
            width: 1,
            height: 14,
            background: "var(--border)",
            margin: "0 2px",
          }}
        />
        {isTimeSeries ? (
          <div style={{ display: "flex", gap: 2 }}>
            {(["2w", "4w", "8w", "3m", "6m", "all"] as TimeRange[]).map((r) => (
              <CtrlBtn
                key={r}
                active={timeRange === r}
                onClick={() => setTimeRange(r)}
              >
                {r}
              </CtrlBtn>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 2 }}>
            {(["status", "source"] as PieDimension[]).map((d) => (
              <CtrlBtn
                key={d}
                active={pieDim === d}
                onClick={() => setPieDim(d)}
              >
                {d === "status" ? "By Status" : "By Source"}
              </CtrlBtn>
            ))}
          </div>
        )}
      </div>

      {/* Controls row 2: grouping + data mode (time series only) */}
      {isTimeSeries && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {(["day", "week", "month"] as Grouping[]).map((g) => (
              <CtrlBtn
                key={g}
                active={grouping === g}
                onClick={() => setGrouping(g)}
              >
                {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
              </CtrlBtn>
            ))}
          </div>
          <div
            style={{
              width: 1,
              height: 14,
              background: "var(--border)",
              margin: "0 2px",
            }}
          />
          <div style={{ display: "flex", gap: 2 }}>
            <CtrlBtn
              active={dataMode === "event"}
              onClick={() => setDataMode("event")}
            >
              By Event
            </CtrlBtn>
            <CtrlBtn
              active={dataMode === "applied"}
              onClick={() => setDataMode("applied")}
            >
              By Applied
            </CtrlBtn>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartType === "bar" && (
        <StackedBarChart data={timeSeriesData} series={series} />
      )}
      {chartType === "line" && (
        <LineChart data={timeSeriesData} series={series} />
      )}
      {chartType === "pie" && <PieChart data={pieData} />}
    </div>
  );
}
