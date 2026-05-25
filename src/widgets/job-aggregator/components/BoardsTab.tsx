import { useState, useCallback, useMemo } from "react";
import type { WidgetApi } from "@renderer/plugins/api";
import type {
  CompanyFeed,
  CompanyType,
  FeedJob,
  FeedType,
  StampedFeedJob,
} from "../types";
import {
  FEED_LABELS,
  COMPANY_TYPE_LABELS,
  COMPANY_TYPE_COLORS,
  COMPANY_TYPE_ORDER,
} from "../constants";
import {
  INSERT_SAVED_JOB,
  INSERT_COMPANY_FEED,
  INSERT_FEED_JOB,
} from "../queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import { inp, buttonDefault } from "../../_shared/styles";
import { fetchFeed } from "../api";
import { AddFeedForm, BoardSection } from "./components";

interface Props {
  api: WidgetApi;
  feeds: CompanyFeed[];
  feedJobs: Record<number, FeedJob[]>;
  savedIds: Set<string>;
  onFeedsChange: () => void;
  onSaved: () => void;
}

export function BoardsTab({
  api,
  feeds,
  feedJobs,
  savedIds,
  onFeedsChange,
  onSaved,
}: Props) {
  const [feedLoading, setFeedLoading] = useState<Record<number, boolean>>({});
  const [feedErrors, setFeedErrors] = useState<Record<number, string>>({});
  const [showAddFeed, setShowAddFeed] = useState(false);

  // ── Company-level filters ────────────────────────────────────────────────
  const [feedSearch, setFeedSearch] = useState("");
  const [feedTypeFilter, setFeedTypeFilter] = useState<FeedType | "all">("all");
  const [companyTypeFilter, setCompanyTypeFilter] = useState<
    CompanyType | "all"
  >("all");
  const [showEmptyCompanies, setShowEmptyCompanies] = useState(false);

  // ── Job-level filters ────────────────────────────────────────────────────
  const [jobTitleFilter, setJobTitleFilter] = useState("");

  const [groupCollapsed, setGroupCollapsed] = useState<
    Partial<Record<CompanyType, boolean>>
  >({});

  const handleAddFeed = async (
    name: string,
    url: string,
    feedType: FeedType,
    companyType: CompanyType,
  ) => {
    await api.sql.run(
      ...namedSql(INSERT_COMPANY_FEED, {
        name,
        url,
        feed_type: feedType,
        company_type: companyType,
        added_at: Date.now(),
      }),
    );
    onFeedsChange();
    setShowAddFeed(false);
  };

  const handleDeleteFeed = async (feedId: number) => {
    await api.sql.run("DELETE FROM feed_jobs WHERE feed_id=?", [feedId]);
    await api.sql.run("DELETE FROM company_feeds WHERE id=?", [feedId]);
    onFeedsChange();
  };

  const handleRefreshFeed = useCallback(
    async (feed: CompanyFeed) => {
      setFeedLoading((l) => ({ ...l, [feed.id]: true }));
      setFeedErrors((e) => ({ ...e, [feed.id]: "" }));
      try {
        const jobs: StampedFeedJob[] = await fetchFeed(api.net.fetch, feed, "");
        await api.sql.run("DELETE FROM feed_jobs WHERE feed_id=?", [feed.id]);
        if (jobs.length > 0) {
          await api.sql.runBatch(
            jobs.map((job) => {
              const [sql, params] = namedSql(INSERT_FEED_JOB, {
                feed_id: feed.id,
                ext_id: job.ext_id,
                title: job.title,
                company: job.company,
                location: job.location,
                date_posted: job.date_posted,
                apply_link: job.apply_link,
                description: job.description,
                fetched_at: job.fetched_at,
              });
              return { sql, params };
            }),
          );
        }
        onFeedsChange();
      } catch (e) {
        setFeedErrors((err) => ({
          ...err,
          [feed.id]: e instanceof Error ? e.message : "Fetch failed",
        }));
      } finally {
        setFeedLoading((l) => ({ ...l, [feed.id]: false }));
      }
    },
    [api, onFeedsChange],
  );

  const handleRefreshAll = () =>
    void Promise.all(feeds.map((feed) => handleRefreshFeed(feed)));

  const handleSaveFeedJob = async (job: FeedJob, feed: CompanyFeed) => {
    const jobId = `feed-${feed.id}-${job.ext_id}`;
    await api.sql.run(
      ...namedSql(INSERT_SAVED_JOB, {
        job_id: jobId,
        title: job.title,
        company: job.company,
        location: job.location,
        is_remote: 0,
        employment_type: "",
        salary_min: null,
        salary_max: null,
        salary_currency: "",
        salary_period: "",
        date_posted: job.date_posted,
        apply_link: job.apply_link,
        source: feed.name,
        description: job.description,
        status: "Interested",
        notes: "",
        saved_at: Date.now(),
      }),
    );
    onSaved();
  };

  const handleIgnoreJob = async (job: FeedJob) => {
    await api.sql.run("UPDATE feed_jobs SET ignored = 1 WHERE id = ?", [
      job.id,
    ]);
    onFeedsChange();
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const visibleFeeds = useMemo(
    () =>
      feeds.filter((f) => {
        if (feedTypeFilter !== "all" && f.feed_type !== feedTypeFilter)
          return false;
        if (
          companyTypeFilter !== "all" &&
          (f.company_type ?? "other") !== companyTypeFilter
        )
          return false;
        if (feedSearch.trim())
          return f.name.toLowerCase().includes(feedSearch.trim().toLowerCase());
        return true;
      }),
    [feeds, feedTypeFilter, companyTypeFilter, feedSearch],
  );

  const jobQ = jobTitleFilter.trim().toLowerCase();

  // Per-feed filtered jobs; hide feeds whose cached jobs all fail the job filter
  const filteredFeedJobs = useMemo<Record<number, FeedJob[]>>(() => {
    const out: Record<number, FeedJob[]> = {};
    for (const feed of visibleFeeds) {
      const jobs = feedJobs[feed.id] ?? [];
      out[feed.id] = jobQ
        ? jobs.filter(
            (j) =>
              j.title.toLowerCase().includes(jobQ) ||
              j.company.toLowerCase().includes(jobQ) ||
              j.description.toLowerCase().includes(jobQ),
          )
        : jobs;
    }
    return out;
  }, [visibleFeeds, feedJobs, jobQ]);

  // When a job filter is active, hide companies that have cached jobs but none match
  // Also hide companies with no jobs unless showEmptyCompanies is enabled
  const filteredFeeds = useMemo(() => {
    let result = jobQ
      ? visibleFeeds.filter((f) => {
          const cached = (feedJobs[f.id] ?? []).length;
          return cached === 0 || filteredFeedJobs[f.id].length > 0;
        })
      : visibleFeeds;

    // Hide companies with no jobs unless showEmptyCompanies is enabled
    if (!showEmptyCompanies) {
      result = result.filter((f) => (feedJobs[f.id] ?? []).length > 0);
    }

    return result;
  }, [jobQ, visibleFeeds, feedJobs, filteredFeedJobs, showEmptyCompanies]);

  const totalMatchingJobs = useMemo(
    () =>
      jobQ
        ? filteredFeeds.reduce((n, f) => n + filteredFeedJobs[f.id].length, 0)
        : null,
    [jobQ, filteredFeeds, filteredFeedJobs],
  );

  const grouped = useMemo(
    () =>
      COMPANY_TYPE_ORDER.reduce<Record<CompanyType, CompanyFeed[]>>(
        (acc, t) => {
          acc[t] = filteredFeeds.filter(
            (f) => (f.company_type ?? "other") === t,
          );
          return acc;
        },
        {} as Record<CompanyType, CompanyFeed[]>,
      ),
    [filteredFeeds],
  );

  const toggleGroup = (type: CompanyType) =>
    setGroupCollapsed((g) => ({ ...g, [type]: !g[type] }));

  const allCollapsed = COMPANY_TYPE_ORDER.every((t) => groupCollapsed[t]);
  const toggleAll = () => {
    const next = !allCollapsed;
    setGroupCollapsed(
      Object.fromEntries(COMPANY_TYPE_ORDER.map((t) => [t, next])),
    );
  };

  const clearFilters = () => {
    setFeedSearch("");
    setFeedTypeFilter("all");
    setCompanyTypeFilter("all");
    setJobTitleFilter("");
    setShowEmptyCompanies(false);
  };
  const hasActiveFilter =
    feedSearch.trim() ||
    feedTypeFilter !== "all" ||
    companyTypeFilter !== "all" ||
    jobTitleFilter.trim() ||
    showEmptyCompanies;

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
        {/* ── Action bar ── */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            className="primary"
            style={buttonDefault}
            onClick={() => setShowAddFeed((x) => !x)}
          >
            {showAddFeed ? "Cancel" : "+ Add Company"}
          </button>
          <button
            className="ghost"
            style={buttonDefault}
            onClick={handleRefreshAll}
            title="Refresh all feeds"
          >
            ↻ Refresh All
          </button>
          <button className="ghost" style={buttonDefault} onClick={toggleAll}>
            {allCollapsed ? "▶ Expand All" : "▼ Collapse All"}
          </button>
          <button
            className="ghost"
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: showEmptyCompanies
                ? "var(--accent)22"
                : "transparent",
              border: showEmptyCompanies
                ? "1px solid var(--accent)55"
                : "1px solid var(--border)",
              color: showEmptyCompanies ? "var(--accent)" : "var(--text-dim)",
            }}
            onClick={() => setShowEmptyCompanies((x) => !x)}
            title="Toggle display of companies with no jobs"
          >
            Show Companies with No Jobs
          </button>
          {hasActiveFilter && (
            <button
              className="ghost"
              style={{
                fontSize: 11,
                padding: "2px 8px",
                marginLeft: "auto",
                color: "#f59e0b",
              }}
              onClick={clearFilters}
            >
              ✕ Clear filters
            </button>
          )}
          {feeds.filter((f) => f.feed_type === "search").length > 0 &&
            !hasActiveFilter && (
              <span
                style={{ fontSize: 11, color: "#f59e0b", marginLeft: "auto" }}
              >
                ⚠ Search feeds are no longer supported
              </span>
            )}
        </div>

        {/* ── Company search + feed-type chips ── */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder={`Search ${feeds.length} companies…`}
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
          />
          {(["all", "lever", "greenhouse", "rss", "search"] as const).map(
            (t) => {
              const active = feedTypeFilter === t;
              const label = t === "all" ? "All" : FEED_LABELS[t];
              const count =
                t === "all"
                  ? feeds.length
                  : feeds.filter((f) => f.feed_type === t).length;
              if (count === 0 && t !== "all") return null;
              return (
                <button
                  key={t}
                  onClick={() => setFeedTypeFilter(t)}
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 4,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    background: active ? "var(--accent)22" : "transparent",
                    border: active
                      ? "1px solid var(--accent)55"
                      : "1px solid var(--border)",
                    color: active ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {label} ({count})
                </button>
              );
            },
          )}
        </div>

        {/* ── Company-type chips ── */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["all", ...COMPANY_TYPE_ORDER] as const).map((t) => {
            const active = companyTypeFilter === t;
            const color =
              t === "all" ? "var(--accent)" : COMPANY_TYPE_COLORS[t];
            const count =
              t === "all"
                ? feeds.length
                : feeds.filter((f) => (f.company_type ?? "other") === t).length;
            if (count === 0 && t !== "all") return null;
            return (
              <button
                key={t}
                onClick={() => setCompanyTypeFilter(t)}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: active ? `${color}22` : "transparent",
                  border: active
                    ? `1px solid ${color}55`
                    : "1px solid transparent",
                  color: active ? color : "var(--text-dim)",
                }}
              >
                {t === "all" ? "All Industries" : COMPANY_TYPE_LABELS[t]} (
                {count})
              </button>
            );
          })}
        </div>

        {/* ── Job-title filter ── */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Filter jobs by title, company, or keyword…"
            value={jobTitleFilter}
            onChange={(e) => setJobTitleFilter(e.target.value)}
          />
          {jobQ && totalMatchingJobs !== null && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                whiteSpace: "nowrap",
              }}
            >
              {totalMatchingJobs} job{totalMatchingJobs !== 1 ? "s" : ""} in{" "}
              {
                filteredFeeds.filter((f) => filteredFeedJobs[f.id].length > 0)
                  .length
              }{" "}
              compan
              {filteredFeeds.filter((f) => filteredFeedJobs[f.id].length > 0)
                .length !== 1
                ? "ies"
                : "y"}
            </span>
          )}
        </div>
      </div>

      {showAddFeed && (
        <AddFeedForm
          onSave={handleAddFeed}
          onCancel={() => setShowAddFeed(false)}
        />
      )}

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {filteredFeeds.length === 0 ? (
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: 13,
              textAlign: "center",
              padding: "32px 0",
            }}
          >
            {feeds.length === 0
              ? 'No company feeds — click "+ Add Company" to get started.'
              : "No companies match your filters."}
          </div>
        ) : (
          COMPANY_TYPE_ORDER.map((type) => {
            const groupFeeds = grouped[type];
            if (groupFeeds.length === 0) return null;
            const color = COMPANY_TYPE_COLORS[type];
            const collapsed = groupCollapsed[type] ?? false;
            return (
              <div key={type} style={{ marginBottom: 4 }}>
                <div
                  onClick={() => toggleGroup(type)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 10px",
                    marginBottom: collapsed ? 0 : 4,
                    background: `${color}11`,
                    border: `1px solid ${color}33`,
                    borderRadius: 5,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>
                    {COMPANY_TYPE_LABELS[type]}
                  </span>
                  <span
                    style={{ fontSize: 11, color: "var(--text-dim)", flex: 1 }}
                  >
                    — {groupFeeds.length} compan
                    {groupFeeds.length !== 1 ? "ies" : "y"}
                    {jobQ &&
                      ` · ${groupFeeds.reduce((n, f) => n + filteredFeedJobs[f.id].length, 0)} matching job${groupFeeds.reduce((n, f) => n + filteredFeedJobs[f.id].length, 0) !== 1 ? "s" : ""}`}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                    {collapsed ? "▶" : "▼"}
                  </span>
                </div>
                {!collapsed &&
                  groupFeeds.map((feed) => (
                    <BoardSection
                      key={feed.id}
                      feed={feed}
                      jobs={filteredFeedJobs[feed.id] ?? []}
                      loading={feedLoading[feed.id] ?? false}
                      error={feedErrors[feed.id] ?? ""}
                      savedIds={savedIds}
                      onRefresh={() => void handleRefreshFeed(feed)}
                      onDelete={() => void handleDeleteFeed(feed.id)}
                      onSave={(job) => void handleSaveFeedJob(job, feed)}
                      onApply={(url) => void api.shell.openExternal(url)}
                      onIgnore={(job) => void handleIgnoreJob(job)}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
