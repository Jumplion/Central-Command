import { useState, useMemo, useRef } from "react";
import { StackedBarChart } from "@widgets/_shared/StackedBarChart";
import { LineChart } from "@widgets/_shared/LineChart";
import { PieChart } from "@widgets/_shared/PieChart";
import type { PieSlice } from "@widgets/_shared/PieChart";
import { buttonDefault, inp } from "@widgets/_shared/styles";
import { StatusBadge, Td } from "@widgets/_shared/table";
import type { Application, AppFormData, Status } from "../types";
import { STATUSES, STATUS_COLOR } from "../types";

export { INIT_SQL, EMAIL_INIT_SQL, SCHEMA_MIGRATIONS } from "../schema";
export { StatusBadge, Td };

import { today } from "@shared/csv";

// ─── AppForm ──────────────────────────────────────────────────────────────

const COMMON_SOURCES = [
  "LinkedIn",
  "Indeed",
  "Glassdoor",
  "ZipRecruiter",
  "Monster",
  "Dice",
  "Built In",
  "Wellfound",
  "AngelList",
  "Y Combinator",
  "Greenhouse",
  "Lever",
  "Workday",
  "iCIMS",
  "SimplyHired",
  "CareerBuilder",
  "Remote OK",
  "We Work Remotely",
  "Hired",
  "Referral",
  "Company Website",
  "Robert Half Technologies",
];

const LINK_SOURCE_MAP: [RegExp, string][] = [
  [/linkedin\.com/i, "LinkedIn"],
  [/indeed\.com/i, "Indeed"],
  [/glassdoor\.com/i, "Glassdoor"],
  [/ziprecruiter\.com/i, "ZipRecruiter"],
  [/monster\.com/i, "Monster"],
  [/dice\.com/i, "Dice"],
  [/builtin\.com/i, "Built In"],
  [/wellfound\.com/i, "Wellfound"],
  [/angel\.co/i, "AngelList"],
  [/workatastartup\.com|ycombinator\.com/i, "Y Combinator"],
  [/greenhouse\.io/i, "Greenhouse"],
  [/lever\.co/i, "Lever"],
  [/myworkdayjobs\.com|workday\.com/i, "Workday"],
  [/icims\.com/i, "iCIMS"],
  [/simplyhired\.com/i, "SimplyHired"],
  [/careerbuilder\.com/i, "CareerBuilder"],
  [/remoteok\.com/i, "Remote OK"],
  [/weworkremotely\.com/i, "We Work Remotely"],
  [/hired\.com/i, "Hired"],
  [/roberthalf\.com/i, "Robert Half Technologies"],
];

function deriveSourceFromLink(url: string): string {
  for (const [pattern, source] of LINK_SOURCE_MAP) {
    if (pattern.test(url)) return source;
  }
  return "";
}

const normalizePrefix = (value: string) => value.trim().toLowerCase();

function getSuggestion(items: string[] | undefined, value: string): string {
  const prefix = normalizePrefix(value);
  if (!items?.length || !prefix) return "";
  return (
    items.find((item) => {
      const candidate = normalizePrefix(item);
      return candidate.startsWith(prefix) && candidate !== prefix;
    }) ?? ""
  );
}

export function AppForm({
  initial,
  onSave,
  onCancel,
  companySuggestions,
  roleSuggestions,
  locationSuggestions,
}: {
  initial?: Application;
  onSave: (data: AppFormData) => Promise<void>;
  onCancel: () => void;
  companySuggestions?: string[];
  roleSuggestions?: string[];
  locationSuggestions?: string[];
}) {
  const [form, setForm] = useState<AppFormData>({
    company: initial?.company ?? "",
    role: initial?.role ?? "",
    status: initial?.status ?? "Applied",
    applied_at: initial?.applied_at ?? today(),
    location: initial?.location ?? "",
    source: initial?.source ?? "",
    link: initial?.link ?? "",
    notes: initial?.notes ?? "",
    req_number: initial?.req_number ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof AppFormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const [activeField, setActiveField] = useState<
    "company" | "role" | "location" | null
  >(null);
  const blurTimer = useRef<number | null>(null);

  const companySuggestion = useMemo(
    () => getSuggestion(companySuggestions, form.company),
    [companySuggestions, form.company],
  );

  const roleSuggestion = useMemo(
    () => getSuggestion(roleSuggestions, form.role),
    [roleSuggestions, form.role],
  );

  const locationSuggestion = useMemo(
    () => getSuggestion(locationSuggestions, form.location),
    [locationSuggestions, form.location],
  );

  const matchingCompanySuggestions = useMemo(
    () =>
      companySuggestions
        ?.filter((item) => {
          const prefix = normalizePrefix(form.company);
          const candidate = normalizePrefix(item);
          return prefix && candidate.startsWith(prefix) && candidate !== prefix;
        })
        .slice(0, 5) ?? [],
    [companySuggestions, form.company],
  );

  const matchingRoleSuggestions = useMemo(
    () =>
      roleSuggestions
        ?.filter((item) => {
          const prefix = normalizePrefix(form.role);
          const candidate = normalizePrefix(item);
          return prefix && candidate.startsWith(prefix) && candidate !== prefix;
        })
        .slice(0, 5) ?? [],
    [roleSuggestions, form.role],
  );

  const matchingLocationSuggestions = useMemo(
    () =>
      locationSuggestions
        ?.filter((item) => {
          const prefix = normalizePrefix(form.location);
          const candidate = normalizePrefix(item);
          return prefix && candidate.startsWith(prefix) && candidate !== prefix;
        })
        .slice(0, 5) ?? [],
    [locationSuggestions, form.location],
  );

  const completeSuggestion =
    (key: "company" | "role" | "location", suggestion: string) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Tab" || e.shiftKey || !suggestion) return;
      e.preventDefault();
      setForm((f) => ({ ...f, [key]: suggestion }));
    };

  const hideSuggestions = () => {
    blurTimer.current = window.setTimeout(() => {
      setActiveField(null);
      blurTimer.current = null;
    }, 100);
  };

  const keepSuggestions = () => {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const link = e.target.value;
    setForm((f) => {
      const derived = deriveSourceFromLink(link);
      return {
        ...f,
        link,
        source: f.source === "" && derived ? derived : f.source,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}
      >
        <div
          style={{ position: "relative" }}
          onMouseEnter={keepSuggestions}
          onMouseLeave={hideSuggestions}
        >
          <input
            style={inp}
            placeholder="Company *"
            value={form.company}
            onChange={(e) => {
              set("company")(e);
              setActiveField("company");
            }}
            onFocus={() => {
              keepSuggestions();
              setActiveField("company");
            }}
            onBlur={hideSuggestions}
            onKeyDown={completeSuggestion("company", companySuggestion)}
            autoComplete="off"
            required
          />
          {activeField === "company" &&
            matchingCompanySuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "100%",
                  marginTop: 6,
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
                  zIndex: 20,
                  overflow: "hidden",
                }}
              >
                {matchingCompanySuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setForm((f) => ({ ...f, company: item }));
                      setActiveField(null);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      font: "inherit",
                      color: "var(--text)",
                      background: "transparent",
                      border: "none",
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
        </div>
        <div
          style={{ position: "relative" }}
          onMouseEnter={keepSuggestions}
          onMouseLeave={hideSuggestions}
        >
          <input
            style={inp}
            placeholder="Role *"
            value={form.role}
            onChange={(e) => {
              set("role")(e);
              setActiveField("role");
            }}
            onFocus={() => {
              keepSuggestions();
              setActiveField("role");
            }}
            onBlur={hideSuggestions}
            onKeyDown={completeSuggestion("role", roleSuggestion)}
            autoComplete="off"
            required
          />
          {activeField === "role" && matchingRoleSuggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "100%",
                marginTop: 6,
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              {matchingRoleSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setForm((f) => ({ ...f, role: item }));
                    setActiveField(null);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    font: "inherit",
                    color: "var(--text)",
                    background: "transparent",
                    border: "none",
                    padding: "8px 10px",
                    cursor: "pointer",
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        <select style={inp} value={form.status} onChange={set("status")}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          style={inp}
          type="date"
          value={form.applied_at}
          onChange={set("applied_at")}
        />
        <div
          style={{ position: "relative" }}
          onMouseEnter={keepSuggestions}
          onMouseLeave={hideSuggestions}
        >
          <input
            style={inp}
            placeholder="Location (optional)"
            value={form.location}
            onChange={(e) => {
              set("location")(e);
              setActiveField("location");
            }}
            onFocus={() => {
              keepSuggestions();
              setActiveField("location");
            }}
            onBlur={hideSuggestions}
            onKeyDown={completeSuggestion("location", locationSuggestion)}
            autoComplete="off"
          />
          {activeField === "location" &&
            matchingLocationSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "100%",
                  marginTop: 6,
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
                  zIndex: 20,
                  overflow: "hidden",
                }}
              >
                {matchingLocationSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setForm((f) => ({ ...f, location: item }));
                      setActiveField(null);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      font: "inherit",
                      color: "var(--text)",
                      background: "transparent",
                      border: "none",
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
        </div>
        <input
          style={inp}
          placeholder="Source (LinkedIn, referral…)"
          value={form.source}
          onChange={set("source")}
          list="job-sources"
          autoComplete="off"
        />
        <datalist id="job-sources">
          {COMMON_SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          style={inp}
          placeholder="Link"
          value={form.link}
          onChange={handleLinkChange}
        />
        <input
          style={inp}
          placeholder="Req # (optional)"
          value={form.req_number}
          onChange={set("req_number")}
        />
      </div>
      <datalist id="job-company-suggestions">
        {companySuggestions?.map((company) => (
          <option key={company} value={company} />
        ))}
      </datalist>
      <datalist id="job-role-suggestions">
        {roleSuggestions?.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
      <textarea
        style={{ ...inp, resize: "vertical", minHeight: 44 }}
        placeholder="Notes"
        value={form.notes}
        onChange={set("notes")}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="submit"
          className="primary"
          style={buttonDefault}
          disabled={saving}
        >
          {initial ? "Save" : "Add"}
        </button>
        <button
          type="button"
          className="ghost"
          style={buttonDefault}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

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

// Keep WeeklyChart as alias for backwards compatibility
export { ChartView as WeeklyChart };

// ─── Table helpers ────────────────────────────────────────────────────────

export function Th({
  children,
  onClick,
  sortIndicator,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  sortIndicator?: "asc" | "desc" | null;
}) {
  const isClickable = Boolean(onClick);
  return (
    <th
      onClick={onClick}
      style={{
        padding: "4px 6px",
        fontWeight: 500,
        fontSize: 11,
        textAlign: "left",
        borderBottom: "1px solid var(--border)",
        cursor: isClickable ? "pointer" : "default",
        userSelect: "none",
        backgroundColor: isClickable ? "var(--hover-bg)" : "transparent",
        transition: "background-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = "rgba(110, 168, 255, 0.12)";
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = "var(--hover-bg)";
        } else {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {children}
        {sortIndicator && (
          <span style={{ fontSize: "10px", opacity: 0.7 }}>
            {sortIndicator === "asc" ? "↑" : "↓"}
          </span>
        )}
      </span>
    </th>
  );
}
