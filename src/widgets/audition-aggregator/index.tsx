import { useState, useEffect, useCallback, useRef } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import type {
  Audition,
  AuditionFormData,
  CastingSite,
  ProjectType,
  Status,
} from "./types";
import { PROJECT_TYPES, STATUSES, CSV_HEADERS } from "./constants";
import { INIT_SQL } from "./schema";
import { INSERT_AUDITION, UPDATE_AUDITION } from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import { parseCSVLine, today } from "@shared/csv";
import { exportCsv } from "@renderer/utils/csv";
import { buttonDefault, WidgetLoading } from "../_shared";
import {
  AuditionForm,
  DeadlineCell,
  SiteRow,
  StatusBar,
  StatusBadge,
  Td,
  Th,
  TypeBar,
  WeeklyChart,
} from "./components";

// ─── Main widget ───────────────────────────────────────────────────────────────

function AuditionAggregator({ api }: WidgetProps) {
  const [auds, setAuds] = useState<Audition[]>([]);
  const [siteChecks, setSiteChecks] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "All">("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"list" | "chart">("list");
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const ready = useSqlInit(api, INIT_SQL);

  const load = useCallback(async () => {
    const rows = await api.sql.all<Audition>(
      "SELECT * FROM auditions ORDER BY last_updated DESC",
    );
    setAuds(rows);
  }, [api]);

  const loadSiteChecks = useCallback(async () => {
    const rows = await api.sql.all<{ site_id: string; last_checked: number }>(
      "SELECT site_id, last_checked FROM site_checks",
    );
    setSiteChecks(
      Object.fromEntries(rows.map((r) => [r.site_id, r.last_checked])),
    );
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    void Promise.all([load(), loadSiteChecks()]);
  }, [ready]);

  const statusCounts = STATUSES.reduce<Record<Status, number>>(
    (acc, s) => {
      acc[s] = auds.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<Status, number>,
  );
  const typeCounts = PROJECT_TYPES.reduce<Record<ProjectType, number>>(
    (acc, t) => {
      acc[t] = auds.filter((a) => a.project_type === t).length;
      return acc;
    },
    {} as Record<ProjectType, number>,
  );

  const filtered = auds.filter(
    (a) =>
      (statusFilter === "All" || a.status === statusFilter) &&
      (typeFilter === "All" || a.project_type === typeFilter),
  );

  const handleVisitSite = useCallback(
    async (site: CastingSite) => {
      const now = Date.now();
      setSiteChecks((prev) => ({ ...prev, [site.id]: now }));
      await api.shell.openExternal(site.url);
      await api.sql.run(
        `INSERT INTO site_checks (site_id, last_checked) VALUES (?, ?)
       ON CONFLICT(site_id) DO UPDATE SET last_checked = excluded.last_checked`,
        [site.id, now],
      );
    },
    [api],
  );

  const handleAdd = async (data: AuditionFormData) => {
    await api.sql.run(
      ...namedSql(INSERT_AUDITION, { ...data, last_updated: Date.now() }),
    );
    await load();
    setShowAdd(false);
  };

  const handleEdit = (aud: Audition) => async (data: AuditionFormData) => {
    await api.sql.run(
      ...namedSql(UPDATE_AUDITION, {
        ...data,
        last_updated: Date.now(),
        id: aud.id,
      }),
    );
    await load();
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    await api.sql.run("DELETE FROM auditions WHERE id=?", [id]);
    await load();
  };

  const handleExportCSV = () => {
    const rows = auds.map((a) => CSV_HEADERS.map((h) => a[h] ?? ""));
    exportCsv([...CSV_HEADERS], rows, "auditions.csv");
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
        if (fields.length < 1 || !fields[0]) continue;
        const [
          project_title,
          role = "",
          project_type_raw = "Film",
          status_raw = "Interested",
          casting_studio = "",
          location = "",
          pay_rate = "",
          submitted_at = "",
          submission_deadline = "",
          shoot_date = "",
          link = "",
          notes = "",
        ] = fields;
        const project_type = (PROJECT_TYPES as string[]).includes(
          project_type_raw,
        )
          ? project_type_raw
          : "Film";
        const status = (STATUSES as string[]).includes(status_raw)
          ? status_raw
          : "Interested";
        await api.sql.run(
          ...namedSql(INSERT_AUDITION, {
            project_title,
            role,
            project_type,
            status,
            casting_studio,
            location,
            pay_rate,
            submitted_at: submitted_at || today(),
            submission_deadline,
            shoot_date,
            link,
            notes,
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
      <SiteRow checks={siteChecks} onVisit={handleVisitSite} />
      <StatusBar
        counts={statusCounts}
        total={auds.length}
        filter={statusFilter}
        onFilter={setStatusFilter}
      />
      <TypeBar
        counts={typeCounts}
        filter={typeFilter}
        onFilter={setTypeFilter}
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
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {(["list", "chart"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                background: view === v ? "var(--accent)22" : "transparent",
                color: view === v ? "var(--accent)" : "var(--text-dim)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {v === "list" ? "List" : "Chart"}
            </button>
          ))}
        </div>
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
        <AuditionForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {view === "chart" ? (
        <WeeklyChart auditions={auds} />
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
              {auds.length === 0
                ? "No auditions yet — click + Add to log your first breakdown."
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
                  <Th>Project</Th>
                  <Th>Role</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Casting</Th>
                  <Th>Location</Th>
                  <Th>Pay</Th>
                  <Th>Deadline</Th>
                  <Th>Shoot</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((aud) =>
                  editingId === aud.id ? (
                    <tr key={aud.id}>
                      <td colSpan={10} style={{ padding: "4px 0" }}>
                        <AuditionForm
                          initial={aud}
                          onSave={handleEdit(aud)}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={aud.id}
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <Td>{aud.project_title}</Td>
                      <Td dim={!aud.role}>{aud.role || "—"}</Td>
                      <Td>{aud.project_type}</Td>
                      <Td>
                        <StatusBadge status={aud.status} />
                      </Td>
                      <Td dim={!aud.casting_studio}>
                        {aud.casting_studio || "—"}
                      </Td>
                      <Td dim={!aud.location}>{aud.location || "—"}</Td>
                      <Td dim={!aud.pay_rate}>{aud.pay_rate || "—"}</Td>
                      <DeadlineCell date={aud.submission_deadline} />
                      <Td dim={!aud.shoot_date}>{aud.shoot_date || "—"}</Td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {aud.link && (
                          <button
                            className="ghost"
                            style={{ fontSize: 11, padding: "1px 6px" }}
                            onClick={() =>
                              void api.shell.openExternal(aud.link)
                            }
                            title="Open link"
                          >
                            ↗
                          </button>
                        )}
                        <button
                          className="ghost"
                          style={{ fontSize: 11, padding: "1px 6px" }}
                          onClick={() => setEditingId(aud.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost danger"
                          style={{ fontSize: 11, padding: "1px 6px" }}
                          onClick={() => handleDelete(aud.id)}
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

// ─── Widget export ─────────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "audition-aggregator",
    name: "Audition Aggregator",
    description:
      "Track acting auditions by project type, casting studio, deadline, shoot date, and pay rate. Status pipeline from Interested through Booked.",
    version: "0.1.0",
    icon: "🎭",
    defaultSize: { w: 9, h: 8 },
    minSize: { w: 6, h: 6 },
    permissions: { sqlite: true },
  },
  Component: AuditionAggregator,
};

export default widget;
