import { useState } from "react";
import type { WidgetApi } from "@renderer/plugins/api";
import type { JobListing } from "./types";
import { inp } from "../_shared/styles";
import { searchArbeitnow } from "./api";
import { JobCard } from "./components";
import { buttonDefault, dimText, smallDimText } from "../_shared/styles";
import { INSERT_SAVED_JOB } from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";

interface Props {
  api: WidgetApi;
  savedIds: Set<string>;
  onSaved: () => void;
  defaultKeywords: string;
  defaultRemoteOnly: boolean;
}

export function SearchTab({
  api,
  savedIds,
  onSaved,
  defaultKeywords,
  defaultRemoteOnly,
}: Props) {
  const [keywords, setKeywords] = useState(defaultKeywords);
  const [remoteOnly, setRemoteOnly] = useState(defaultRemoteOnly);
  const [results, setResults] = useState<JobListing[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async () => {
    const q = keywords.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const jobs = await searchArbeitnow(api.net.fetch, q, remoteOnly);
      setResults(jobs);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async (job: JobListing) => {
    await api.sql.run(
      ...namedSql(INSERT_SAVED_JOB, {
        job_id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        is_remote: job.isRemote ? 1 : 0,
        employment_type: job.employmentType,
        salary_min: job.salaryMin ?? null,
        salary_max: job.salaryMax ?? null,
        salary_currency: job.salaryCurrency,
        salary_period: job.salaryPeriod,
        date_posted: job.datePosted,
        apply_link: job.applyLink,
        source: job.source,
        description: job.description,
        status: "Interested",
        notes: "",
        saved_at: Date.now(),
      }),
    );
    onSaved();
  };

  return (
    <>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            padding: "5px 8px",
            borderRadius: 4,
            background: "#f59e0b22",
            border: "1px solid #f59e0b44",
            color: "#f59e0b",
          }}
        >
          Using Arbeitnow for job search (remote/tech focused). JSearch querying
          is disabled.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Keywords (e.g. Software Engineer)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
          />
          <button
            className="primary"
            style={buttonDefault}
            onClick={() => void handleSearch()}
            disabled={searching || !keywords.trim()}
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label
            style={{
              fontSize: 12,
              display: "flex",
              gap: 4,
              alignItems: "center",
              ...dimText,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
            />
            Remote only
          </label>
          {results.length > 0 && (
            <span style={{ ...smallDimText, marginLeft: "auto" }}>
              {results.length} result{results.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {searchError && (
          <div style={{ fontSize: 12, color: "#ff6e6e", padding: "8px 0" }}>
            {searchError}
          </div>
        )}
        {!searching && !searchError && results.length === 0 && (
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: 13,
              textAlign: "center",
              padding: "32px 0",
            }}
          >
            {keywords.trim()
              ? "No results — try different keywords."
              : "Enter keywords and press Search."}
          </div>
        )}
        {results.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isSaved={savedIds.has(job.id)}
            onSave={() => void handleSave(job)}
            onApply={() => {
              if (job.applyLink) {
                void api.shell.openExternal(job.applyLink);
              }
            }}
          />
        ))}
      </div>
    </>
  );
}
