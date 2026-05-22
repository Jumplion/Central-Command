import { useState, useEffect, useCallback, useMemo } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { WidgetLoading } from "../_shared";

import type { SavedJob, CompanyFeed, FeedJob } from "./types";
import { DEFAULT_FEEDS, SEED_VERSION } from "./constants";
import { INIT_SQL } from "./schema";
import { SearchTab } from "./SearchTab";
import { SavedTab } from "./SavedTab";
import { BoardsTab } from "./BoardsTab";

// ─── Main component ───────────────────────────────────────────────────────────

function JobAggregator({ api, settings }: WidgetProps) {
  const [tab, setTab] = useState<"search" | "saved" | "boards">("search");

  const ready = useSqlInit(api, INIT_SQL);

  // Shared state lifted up so tabs can read/trigger refreshes
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const savedIds = useMemo(
    () => new Set(savedJobs.map((r) => r.job_id)),
    [savedJobs],
  );
  const [feeds, setFeeds] = useState<CompanyFeed[]>([]);
  const [feedJobs, setFeedJobs] = useState<Record<number, FeedJob[]>>({});

  const loadSaved = useCallback(async () => {
    const rows = await api.sql.all<SavedJob>(
      "SELECT * FROM saved_jobs ORDER BY saved_at DESC",
    );
    setSavedJobs(rows);
  }, [api]);

  const loadFeeds = useCallback(async () => {
    const rows = await api.sql.all<CompanyFeed>(
      "SELECT * FROM company_feeds ORDER BY name ASC",
    );
    setFeeds(rows);
    const allJobs = await api.sql.all<FeedJob>(
      "SELECT * FROM feed_jobs WHERE ignored = 0 ORDER BY feed_id, date_posted DESC, fetched_at DESC",
    );
    const grouped: Record<number, FeedJob[]> = {};
    for (const job of allJobs) (grouped[job.feed_id] ??= []).push(job);
    setFeedJobs(grouped);
  }, [api]);

  const seedDefaultFeeds = useCallback(async () => {
    const stored = await api.kv.get<number>("seedVersion");
    if (stored === SEED_VERSION) return;
    for (const f of DEFAULT_FEEDS) {
      await api.sql.run(
        `INSERT INTO company_feeds (name, url, feed_type, company_type, enabled, added_at)
         SELECT ?, ?, ?, ?, 1, ? WHERE NOT EXISTS
           (SELECT 1 FROM company_feeds WHERE name = ?)`,
        [f.name, f.url, f.feed_type, f.company_type, Date.now(), f.name],
      );
      // Migrate company_type for feeds seeded before this field existed
      await api.sql.run(
        `UPDATE company_feeds SET company_type = ? WHERE name = ? AND company_type = 'other'`,
        [f.company_type, f.name],
      );
    }
    await api.kv.set("seedVersion", SEED_VERSION);
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    const init = async () => {
      await seedDefaultFeeds();
      await Promise.all([loadSaved(), loadFeeds()]);
    };
    void init();
  }, [ready]);

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
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {(["search", "saved", "boards"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              fontSize: 12,
              padding: "5px 0",
              border: "none",
              cursor: "pointer",
              background: tab === t ? "var(--accent)22" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            {t === "search"
              ? "Search"
              : t === "saved"
                ? `Saved (${savedJobs.length})`
                : `Boards (${feeds.length})`}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <SearchTab
          api={api}
          savedIds={savedIds}
          onSaved={loadSaved}
          defaultKeywords={(settings.defaultKeywords as string) || ""}
          defaultRemoteOnly={Boolean(settings.remoteOnly)}
        />
      )}

      {tab === "saved" && (
        <SavedTab api={api} savedJobs={savedJobs} onSavedChange={loadSaved} />
      )}

      {tab === "boards" && (
        <BoardsTab
          api={api}
          feeds={feeds}
          feedJobs={feedJobs}
          savedIds={savedIds}
          onFeedsChange={loadFeeds}
          onSaved={loadSaved}
        />
      )}
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "job-aggregator",
    name: "Job Aggregator",
    description:
      "Search Arbeitnow jobs. Monitor 40+ company boards (Lever, Greenhouse, RSS). Save and track listings.",
    version: "0.5.0",
    icon: "🔍",
    defaultSize: { w: 8, h: 10 },
    minSize: { w: 5, h: 7 },
    permissions: { sqlite: true },
    settings: [
      {
        kind: "string",
        key: "defaultKeywords",
        label: "Default search keywords",
        placeholder: "e.g. Software Engineer",
      },
      {
        kind: "boolean",
        key: "remoteOnly",
        label: "Remote only by default",
        default: false,
      },
    ],
  },
  Component: JobAggregator,
};

export default widget;
