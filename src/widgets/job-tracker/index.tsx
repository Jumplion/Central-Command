import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { STATUSES, STATUS_COLOR } from "./types";
import type { Application, AppFormData, Status } from "./types";
import { parseCSVLine } from "@shared/csv";
import { today } from "@shared/date";
import { exportCsv } from "@renderer/utils/csv";
import { buttonDefault, WidgetLoading, TabBar, StatusBar } from "../_shared";
import {
  INIT_SQL,
  EMAIL_INIT_SQL,
  SCHEMA_MIGRATIONS,
  AppForm,
  ChartView,
  Th,
  Td,
  StatusBadge,
} from "./components/components";
import { EmailsTab } from "./components/EmailsTab";
import {
  INSERT_APPLICATION,
  UPDATE_APPLICATION,
  DELETE_APPLICATION,
} from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
function JobTracker({ api }: WidgetProps) {
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Status | "All">("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"list" | "chart" | "emails">("list");
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState<keyof Application>("last_updated");
  const [sortAsc, setSortAsc] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const ready = useSqlInit(api, INIT_SQL + EMAIL_INIT_SQL, SCHEMA_MIGRATIONS);

  const load = useCallback(async () => {
    const rows = await api.sql.all<
      Application & Partial<Pick<Application, "location">>
    >("SELECT * FROM applications ORDER BY last_updated DESC");
    setApps(rows.map((row) => ({ ...row, location: row.location ?? "" })));
  }, [api]);

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  const counts = useMemo(() => {
    const acc = STATUSES.reduce<Record<Status, number>>(
      (a, s) => {
        a[s] = 0;
        return a;
      },
      {} as Record<Status, number>,
    );
    for (const a of apps) if (a.status in acc) acc[a.status as Status]++;
    return acc;
  }, [apps]);

  const filtered = useMemo(
    () => (filter === "All" ? apps : apps.filter((a) => a.status === filter)),
    [apps, filter],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortAsc ? -1 : 1;
      if (bVal == null) return sortAsc ? 1 : -1;

      // Numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return copy;
  }, [filtered, sortBy, sortAsc]);

  const companySuggestions = useMemo(
    () => [...new Set(apps.map((a) => a.company).filter(Boolean))],
    [apps],
  );

  const roleSuggestions = useMemo(
    () => [...new Set(apps.map((a) => a.role).filter(Boolean))],
    [apps],
  );

  const locationSuggestions = useMemo(
    () => [...new Set(apps.map((a) => a.location).filter(Boolean))],
    [apps],
  );

  const handleSortColumn = (column: keyof Application) => {
    if (sortBy === column) {
      // Toggle ascending/descending if same column clicked
      setSortAsc(!sortAsc);
    } else {
      // Switch to new column, default to ascending
      setSortBy(column);
      setSortAsc(true);
    }
  };

  const handleAdd = async (data: AppFormData) => {
    await api.sql.run(
      ...namedSql(INSERT_APPLICATION, {
        ...data,
        last_updated: Date.now(),
      }),
    );
    await load();
    setShowAdd(false);
  };

  const handleEdit = (app: Application) => async (data: AppFormData) => {
    await api.sql.run(
      ...namedSql(UPDATE_APPLICATION, {
        ...data,
        last_updated: Date.now(),
        id: app.id,
      }),
    );
    await load();
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    await api.sql.run(DELETE_APPLICATION, [id]);
    await load();
  };

  const handleExportCSV = () => {
    const headers = [
      "company",
      "role",
      "status",
      "applied_at",
      "location",
      "source",
      "link",
      "notes",
      "req_number",
    ];
    const rows = apps.map((a) => [
      a.company,
      a.role,
      a.status,
      a.applied_at,
      a.location,
      a.source,
      a.link,
      a.notes,
      a.req_number,
    ]);
    exportCsv(headers, rows, "applications.csv");
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) return;
      for (const line of lines.slice(1)) {
        const fields = parseCSVLine(line);
        if (fields.length < 4) continue;
        const [company, role, status, applied_at] = fields;
        const [location, source, link, notes, req_number] =
          fields.length === 9
            ? (fields.slice(4) as [string, string, string, string, string])
            : [
                "",
                fields[4] ?? "",
                fields[5] ?? "",
                fields[6] ?? "",
                fields[7] ?? "",
              ];
        if (!company || !role) continue;
        const safeStatus = (STATUSES as string[]).includes(status)
          ? status
          : "Applied";
        await api.sql.run(
          ...namedSql(INSERT_APPLICATION, {
            company,
            role,
            status: safeStatus,
            applied_at: applied_at || today(),
            location,
            source,
            link,
            notes,
            req_number,
            last_updated: Date.now(),
          }),
        );
      }
      await load();
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  if (!ready) return <WidgetLoading />;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 8,
      }}
    >
      <StatusBar
        allLabel="All"
        allCount={apps.length}
        selected={filter}
        onSelect={setFilter}
        items={STATUSES.map((s) => ({
          value: s,
          label: s,
          count: counts[s],
          color: STATUS_COLOR[s],
        }))}
      />

      <div
        style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}
      >
        <button
          className="primary"
          style={buttonDefault}
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
            setView("list");
          }}
        >
          + Add
        </button>
        <TabBar
          tabs={[
            { value: "list", label: "List" },
            { value: "chart", label: "Chart" },
            { value: "emails", label: "Emails" },
          ]}
          active={view}
          onChange={setView}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <input
            ref={importRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleImportCSV}
          />
          <button
            style={buttonDefault}
            onClick={() => importRef.current?.click()}
            disabled={importing}
            title="Import CSV"
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <button
            style={buttonDefault}
            onClick={handleExportCSV}
            title="Export all as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      {showAdd && (
        <AppForm
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          companySuggestions={companySuggestions}
          roleSuggestions={roleSuggestions}
          locationSuggestions={locationSuggestions}
        />
      )}

      {view === "emails" ? (
        <EmailsTab
          api={api}
          apps={apps}
          onAppAdded={load}
          onAppUpdated={load}
        />
      ) : view === "chart" ? (
        <ChartView apps={apps} />
      ) : (
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                color: "var(--text-dim)",
                padding: "16px 0",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              {apps.length === 0
                ? "No applications yet — click + Add to get started."
                : "No results for this filter."}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ color: "var(--text-dim)" }}>
                  <Th
                    onClick={() => handleSortColumn("company")}
                    sortIndicator={
                      sortBy === "company" ? (sortAsc ? "asc" : "desc") : null
                    }
                  >
                    Company
                  </Th>
                  <Th
                    onClick={() => handleSortColumn("role")}
                    sortIndicator={
                      sortBy === "role" ? (sortAsc ? "asc" : "desc") : null
                    }
                  >
                    Role
                  </Th>
                  <Th
                    onClick={() => handleSortColumn("location")}
                    sortIndicator={
                      sortBy === "location" ? (sortAsc ? "asc" : "desc") : null
                    }
                  >
                    Location
                  </Th>
                  <Th
                    onClick={() => handleSortColumn("status")}
                    sortIndicator={
                      sortBy === "status" ? (sortAsc ? "asc" : "desc") : null
                    }
                  >
                    Status
                  </Th>
                  <Th
                    onClick={() => handleSortColumn("applied_at")}
                    sortIndicator={
                      sortBy === "applied_at"
                        ? sortAsc
                          ? "asc"
                          : "desc"
                        : null
                    }
                  >
                    Applied
                  </Th>
                  <Th
                    onClick={() => handleSortColumn("req_number")}
                    sortIndicator={
                      sortBy === "req_number"
                        ? sortAsc
                          ? "asc"
                          : "desc"
                        : null
                    }
                  >
                    Req #
                  </Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((app) =>
                  editingId === app.id ? (
                    <tr key={app.id}>
                      <td colSpan={7} style={{ padding: "4px 0" }}>
                        <AppForm
                          initial={app}
                          onSave={handleEdit(app)}
                          onCancel={() => setEditingId(null)}
                          companySuggestions={companySuggestions}
                          roleSuggestions={roleSuggestions}
                          locationSuggestions={locationSuggestions}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={app.id}
                      style={{
                        borderTop: "1px solid var(--border)",
                        transition: "background-color 0.15s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "rgba(110, 168, 255, 0.07)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "")
                      }
                    >
                      <Td>{app.company}</Td>
                      <Td>{app.role}</Td>
                      <Td>{app.location}</Td>
                      <Td>
                        <StatusBadge
                          label={app.status}
                          color={STATUS_COLOR[app.status]}
                        />
                      </Td>
                      <Td>{app.applied_at}</Td>
                      <Td>{app.req_number}</Td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {app.link && (
                          <button
                            className="ghost"
                            style={{ fontSize: 11, padding: "1px 6px" }}
                            onClick={() =>
                              void api.shell.openExternal(app.link)
                            }
                            title="Open link"
                          >
                            ↗
                          </button>
                        )}
                        <button
                          className="ghost"
                          style={{ fontSize: 11, padding: "1px 6px" }}
                          onClick={() => setEditingId(app.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost danger"
                          style={{ fontSize: 11, padding: "1px 6px" }}
                          onClick={() => handleDelete(app.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "job-tracker",
    name: "Job Tracker",
    description:
      "Track job applications with status, weekly chart, and CSV import/export.",
    version: "0.2.0",
    icon: "💼",
    defaultSize: { w: 8, h: 8 },
    minSize: { w: 5, h: 5 },
    permissions: { sqlite: true, google: true },
  },
  Component: JobTracker,
};

export default widget;
