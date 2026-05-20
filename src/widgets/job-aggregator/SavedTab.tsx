import { useState } from "react";
import type { WidgetApi } from "@renderer/plugins/api";
import type { SavedJob, SavedStatus } from "./types";
import { STATUSES, STATUS_COLORS, thStyle, tdStyle } from "./constants";
import { inp } from "../_shared/styles";
import { formatSalary, relativeDate } from "./utils";
import { SourceBadge, SavedStatusFilter } from "./components";

interface Props {
  api: WidgetApi;
  savedJobs: SavedJob[];
  onSavedChange: () => void;
}

export function SavedTab({ api, savedJobs, onSavedChange }: Props) {
  const [savedFilter, setSavedFilter] = useState<SavedStatus | "All">("All");

  const filteredSaved =
    savedFilter === "All"
      ? savedJobs
      : savedJobs.filter((j) => j.status === savedFilter);

  const handleStatusChange = async (id: number, status: SavedStatus) => {
    await api.sql.run("UPDATE saved_jobs SET status=? WHERE id=?", [
      status,
      id,
    ]);
    onSavedChange();
  };

  const handleDelete = async (id: number) => {
    await api.sql.run("DELETE FROM saved_jobs WHERE id=?", [id]);
    onSavedChange();
  };

  return (
    <>
      <SavedStatusFilter
        savedJobs={savedJobs}
        savedFilter={savedFilter}
        onSelect={setSavedFilter}
      />
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {filteredSaved.length === 0 ? (
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: 13,
              textAlign: "center",
              padding: "32px 0",
            }}
          >
            {savedJobs.length === 0
              ? "No saved jobs yet — search or browse boards to save listings."
              : "No results for this filter."}
          </div>
        ) : (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr style={{ color: "var(--text-dim)" }}>
                <th style={thStyle}>Role / Company</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Salary</th>
                <th style={thStyle}>Saved</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {filteredSaved.map((job) => (
                <tr
                  key={job.id}
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
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, lineHeight: 1.3 }}>
                      {job.title}
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: 11 }}>
                      {job.company}
                      {job.location && ` · ${job.location}`}
                      {Boolean(job.is_remote) && " · Remote"}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <SourceBadge source={job.source} />
                  </td>
                  <td style={tdStyle}>
                    <select
                      style={{
                        ...inp,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: STATUS_COLORS[job.status],
                        fontWeight: 600,
                        fontSize: 11,
                        padding: 0,
                      }}
                      value={job.status}
                      onChange={(e) =>
                        void handleStatusChange(
                          job.id,
                          e.target.value as SavedStatus,
                        )
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontSize: 11,
                      color: "#34d399",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatSalary(
                      job.salary_min,
                      job.salary_max,
                      job.salary_currency,
                      job.salary_period,
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontSize: 11,
                      color: "var(--text-dim)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {relativeDate(
                      new Date(job.saved_at).toISOString().slice(0, 10),
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {job.status !== "Applied" && (
                      <button
                        className="ghost"
                        style={{
                          fontSize: 11,
                          padding: "1px 6px",
                          color: STATUS_COLORS["Applied"],
                          borderColor: `${STATUS_COLORS["Applied"]}55`,
                        }}
                        title="Mark as Applied"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleStatusChange(job.id, "Applied");
                        }}
                      >
                        ✓ Applied
                      </button>
                    )}
                    {job.apply_link && (
                      <button
                        className="ghost"
                        style={{ fontSize: 11, padding: "1px 6px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void api.shell.openExternal(job.apply_link);
                        }}
                      >
                        ↗
                      </button>
                    )}
                    <button
                      className="ghost danger"
                      style={{ fontSize: 11, padding: "1px 6px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(job.id);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
