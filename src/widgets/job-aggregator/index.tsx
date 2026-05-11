import { useState, useEffect, useCallback } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

import type { JobListing, SavedJob, FeedJob, CompanyFeed, FeedType, SavedStatus, StampedFeedJob } from './types';
import { STATUSES, STATUS_COLORS, EMP_TYPES, FEED_LABELS, DEFAULT_FEEDS, SEED_VERSION, INIT_SQL } from './constants';
import { formatSalary, relativeDate } from './utils';
import { searchJSearch, searchArbeitnow, fetchFeed } from './api';
import {
  inp, thStyle, tdStyle,
  SourceBadge, JobCard, AddFeedForm, BoardSection, SavedStatusFilter,
} from './components';

// ─── Main component ───────────────────────────────────────────────────────────

function JobAggregator({ api, settings }: WidgetProps) {
  // Search tab state
  const [tab, setTab]               = useState<'search' | 'saved' | 'boards'>('search');
  const [keywords, setKeywords]     = useState((settings.defaultKeywords as string) || '');
  const [location, setLocation]     = useState((settings.defaultLocation as string) || '');
  const [remoteOnly, setRemoteOnly] = useState(Boolean(settings.remoteOnly));
  const [empType, setEmpType]       = useState('all');
  const [results, setResults]       = useState<JobListing[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');

  // Saved tab state
  const [savedJobs, setSavedJobs]     = useState<SavedJob[]>([]);
  const [savedIds, setSavedIds]       = useState<Set<string>>(new Set());
  const [savedFilter, setSavedFilter] = useState<SavedStatus | 'All'>('All');

  // Boards tab state
  const [feeds, setFeeds]           = useState<CompanyFeed[]>([]);
  const [feedJobs, setFeedJobs]     = useState<Record<number, FeedJob[]>>({});
  const [feedLoading, setFeedLoading] = useState<Record<number, boolean>>({});
  const [feedErrors, setFeedErrors] = useState<Record<number, string>>({});
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedSearch, setFeedSearch] = useState('');
  const [feedTypeFilter, setFeedTypeFilter] = useState<FeedType | 'all'>('all');

  const [ready, setReady] = useState(false);
  const apiKey = (settings.rapidApiKey as string) || '';

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const loadSaved = useCallback(async () => {
    const rows = await api.sql.all<SavedJob>('SELECT * FROM saved_jobs ORDER BY saved_at DESC');
    setSavedJobs(rows);
    setSavedIds(new Set(rows.map((r) => r.job_id)));
  }, [api]);

  const loadFeeds = useCallback(async () => {
    const rows = await api.sql.all<CompanyFeed>('SELECT * FROM company_feeds ORDER BY name ASC');
    setFeeds(rows);
    // Single query for all feed jobs, then group by feed_id in JS
    const allJobs = await api.sql.all<FeedJob>(
      'SELECT * FROM feed_jobs ORDER BY feed_id, date_posted DESC, fetched_at DESC',
    );
    const grouped: Record<number, FeedJob[]> = {};
    for (const job of allJobs) (grouped[job.feed_id] ??= []).push(job);
    setFeedJobs(grouped);
  }, [api]);

  // Skips seeding entirely when the KV-stored version already matches SEED_VERSION.
  // Each new entry added to DEFAULT_FEEDS must be accompanied by a SEED_VERSION bump.
  const seedDefaultFeeds = useCallback(async () => {
    const stored = await api.kv.get<number>('seedVersion');
    if (stored === SEED_VERSION) return;
    for (const f of DEFAULT_FEEDS) {
      await api.sql.run(
        `INSERT INTO company_feeds (name, url, feed_type, enabled, added_at)
         SELECT ?, ?, ?, 1, ? WHERE NOT EXISTS
           (SELECT 1 FROM company_feeds WHERE name = ?)`,
        [f.name, f.url, f.feed_type, Date.now(), f.name],
      );
    }
    await api.kv.set('seedVersion', SEED_VERSION);
  }, [api]);

  useEffect(() => {
    api.sql.exec(INIT_SQL).then(async () => {
      await seedDefaultFeeds(); // idempotent — safe to run every mount
      await Promise.all([loadSaved(), loadFeeds()]);
      setReady(true);
    });
  }, []);

  // ── Search handlers ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    const q = keywords.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const jobs = apiKey
        ? await searchJSearch(api.net.fetch, apiKey, location.trim() ? `${q} in ${location.trim()}` : q, remoteOnly, empType)
        : await searchArbeitnow(api.net.fetch, q, remoteOnly);
      setResults(jobs);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearchJob = async (job: JobListing) => {
    await api.sql.run(
      `INSERT OR IGNORE INTO saved_jobs
        (job_id,title,company,location,is_remote,employment_type,
         salary_min,salary_max,salary_currency,salary_period,
         date_posted,apply_link,source,description,status,notes,saved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Interested','',?)`,
      [
        job.id, job.title, job.company, job.location, job.isRemote ? 1 : 0,
        job.employmentType, job.salaryMin ?? null, job.salaryMax ?? null,
        job.salaryCurrency, job.salaryPeriod, job.datePosted,
        job.applyLink, job.source, job.description, Date.now(),
      ],
    );
    await loadSaved();
  };

  // ── Saved handlers ───────────────────────────────────────────────────────────

  const handleStatusChange = async (id: number, status: SavedStatus) => {
    await api.sql.run('UPDATE saved_jobs SET status=? WHERE id=?', [status, id]);
    await loadSaved();
  };

  const handleDeleteSaved = async (id: number) => {
    await api.sql.run('DELETE FROM saved_jobs WHERE id=?', [id]);
    await loadSaved();
  };

  // ── Board handlers ───────────────────────────────────────────────────────────

  const handleAddFeed = async (name: string, url: string, feedType: FeedType) => {
    await api.sql.run(
      'INSERT INTO company_feeds (name, url, feed_type, enabled, added_at) VALUES (?,?,?,1,?)',
      [name, url, feedType, Date.now()],
    );
    await loadFeeds();
    setShowAddFeed(false);
  };

  const handleDeleteFeed = async (feedId: number) => {
    await api.sql.run('DELETE FROM feed_jobs WHERE feed_id=?', [feedId]);
    await api.sql.run('DELETE FROM company_feeds WHERE id=?', [feedId]);
    await loadFeeds();
  };

  const handleRefreshFeed = useCallback(async (feed: CompanyFeed) => {
    setFeedLoading((l) => ({ ...l, [feed.id]: true }));
    setFeedErrors((e) => ({ ...e, [feed.id]: '' }));
    try {
      const jobs: StampedFeedJob[] = await fetchFeed(api.net.fetch, feed, apiKey);
      await api.sql.run('DELETE FROM feed_jobs WHERE feed_id=?', [feed.id]);
      for (const job of jobs) {
        await api.sql.run(
          `INSERT OR IGNORE INTO feed_jobs
            (feed_id,ext_id,title,company,location,date_posted,apply_link,description,fetched_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [feed.id, job.ext_id, job.title, job.company, job.location, job.date_posted, job.apply_link, job.description, job.fetched_at],
        );
      }
      const updated = await api.sql.all<FeedJob>(
        'SELECT * FROM feed_jobs WHERE feed_id=? ORDER BY date_posted DESC, fetched_at DESC',
        [feed.id],
      );
      setFeedJobs((j) => ({ ...j, [feed.id]: updated }));
    } catch (e) {
      setFeedErrors((err) => ({ ...err, [feed.id]: e instanceof Error ? e.message : 'Fetch failed' }));
    } finally {
      setFeedLoading((l) => ({ ...l, [feed.id]: false }));
    }
  }, [api, apiKey]);

  const handleRefreshAll = () => void Promise.all(feeds.map((feed) => handleRefreshFeed(feed)));

  const handleSaveFeedJob = async (job: FeedJob, feed: CompanyFeed) => {
    const jobId = `feed-${feed.id}-${job.ext_id}`;
    await api.sql.run(
      `INSERT OR IGNORE INTO saved_jobs
        (job_id,title,company,location,is_remote,employment_type,
         salary_min,salary_max,salary_currency,salary_period,
         date_posted,apply_link,source,description,status,notes,saved_at)
       VALUES (?,?,?,?,0,'',NULL,NULL,'','',?,?,?,?,'Interested','',?)`,
      [jobId, job.title, job.company, job.location, job.date_posted, job.apply_link, feed.name, job.description, Date.now()],
    );
    await loadSaved();
  };

  const filteredSaved = savedFilter === 'All' ? savedJobs : savedJobs.filter((j) => j.status === savedFilter);

  const visibleFeeds = feeds.filter((f) => {
    if (feedTypeFilter !== 'all' && f.feed_type !== feedTypeFilter) return false;
    if (feedSearch.trim()) return f.name.toLowerCase().includes(feedSearch.trim().toLowerCase());
    return true;
  });

  if (!ready) return <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', flexShrink: 0, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        {(['search', 'saved', 'boards'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, fontSize: 12, padding: '5px 0', border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--accent)22' : 'transparent',
              color:      tab === t ? 'var(--accent)'   : 'var(--text-dim)',
            }}
          >
            {t === 'search' ? 'Search' : t === 'saved' ? `Saved (${savedJobs.length})` : `Boards (${feeds.length})`}
          </button>
        ))}
      </div>

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!apiKey && (
              <div style={{ fontSize: 11, padding: '5px 8px', borderRadius: 4, background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
                No API key — showing Arbeitnow (remote/tech). Add a free RapidAPI key in settings for LinkedIn, Indeed, ZipRecruiter, and Glassdoor coverage.
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...inp, flex: 2 }}
                placeholder="Keywords (e.g. Software Engineer)"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
              />
              {apiKey && (
                <input
                  style={{ ...inp, flex: 1 }}
                  placeholder="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                />
              )}
              <button className="primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => void handleSearch()} disabled={searching || !keywords.trim()}>
                {searching ? '…' : 'Search'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {apiKey && (
                <select style={{ ...inp, cursor: 'pointer' }} value={empType} onChange={(e) => setEmpType(e.target.value)}>
                  {EMP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )}
              <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                Remote only
              </label>
              {results.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {searchError && <div style={{ fontSize: 12, color: '#ff6e6e', padding: '8px 0' }}>{searchError}</div>}
            {!searching && !searchError && results.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                {keywords.trim() ? 'No results — try different keywords.' : 'Enter keywords and press Search.'}
              </div>
            )}
            {results.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                onSave={() => void handleSaveSearchJob(job)}
                onApply={() => job.applyLink && void api.shell.openExternal(job.applyLink)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Saved tab ── */}
      {tab === 'saved' && (
        <>
          <SavedStatusFilter savedJobs={savedJobs} savedFilter={savedFilter} onSelect={setSavedFilter} />
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {filteredSaved.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                {savedJobs.length === 0 ? 'No saved jobs yet — search or browse boards to save listings.' : 'No results for this filter.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'var(--text-dim)' }}>
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
                    <tr key={job.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{job.title}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                          {job.company}{job.location && ` · ${job.location}`}{Boolean(job.is_remote) && ' · Remote'}
                        </div>
                      </td>
                      <td style={tdStyle}><SourceBadge source={job.source} /></td>
                      <td style={tdStyle}>
                        <select
                          style={{ ...inp, background: 'transparent', border: 'none', cursor: 'pointer', color: STATUS_COLORS[job.status], fontWeight: 600, fontSize: 11, padding: 0 }}
                          value={job.status}
                          onChange={(e) => void handleStatusChange(job.id, e.target.value as SavedStatus)}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>
                        {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {relativeDate(new Date(job.saved_at).toISOString().slice(0, 10))}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {job.apply_link && (
                          <button className="ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={() => void api.shell.openExternal(job.apply_link)}>↗</button>
                        )}
                        <button className="ghost danger" style={{ fontSize: 11, padding: '1px 6px' }} onClick={() => void handleDeleteSaved(job.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Boards tab ── */}
      {tab === 'boards' && (
        <>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Action row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowAddFeed((x) => !x)}>
                {showAddFeed ? 'Cancel' : '+ Add Company'}
              </button>
              <button className="ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleRefreshAll} title="Refresh all feeds">
                ↻ Refresh All
              </button>
              {feeds.filter((f) => f.feed_type === 'search').length > 0 && !apiKey && (
                <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 'auto' }}>⚠ Search feeds need RapidAPI key</span>
              )}
            </div>

            {/* Search + type filter row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                style={{ ...inp, flex: 1 }}
                placeholder={`Search ${feeds.length} companies…`}
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
              />
              {(['all', 'lever', 'greenhouse', 'rss', 'search'] as const).map((t) => {
                const active = feedTypeFilter === t;
                const label  = t === 'all' ? 'All' : FEED_LABELS[t];
                const count  = t === 'all' ? feeds.length : feeds.filter((f) => f.feed_type === t).length;
                if (count === 0 && t !== 'all') return null;
                return (
                  <button
                    key={t}
                    onClick={() => setFeedTypeFilter(t)}
                    style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: active ? 'var(--accent)22' : 'transparent',
                      border:     active ? '1px solid var(--accent)55' : '1px solid var(--border)',
                      color:      active ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {showAddFeed && (
            <AddFeedForm onSave={handleAddFeed} onCancel={() => setShowAddFeed(false)} />
          )}

          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {visibleFeeds.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                {feeds.length === 0
                  ? 'No company feeds — click "+ Add Company" to get started.'
                  : 'No companies match your search.'}
              </div>
            ) : (
              visibleFeeds.map((feed) => (
                <BoardSection
                  key={feed.id}
                  feed={feed}
                  jobs={feedJobs[feed.id] ?? []}
                  loading={feedLoading[feed.id] ?? false}
                  error={feedErrors[feed.id] ?? ''}
                  savedIds={savedIds}
                  onRefresh={() => void handleRefreshFeed(feed)}
                  onDelete={() => void handleDeleteFeed(feed.id)}
                  onSave={(job) => void handleSaveFeedJob(job, feed)}
                  onApply={(url) => void api.shell.openExternal(url)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'job-aggregator',
    name: 'Job Aggregator',
    description: 'Search LinkedIn, Indeed, ZipRecruiter, and more. Monitor 40+ company boards (Lever, Greenhouse, RSS, JSearch). Save and track listings.',
    version: '0.4.0',
    icon: '🔍',
    defaultSize: { w: 8, h: 10 },
    minSize:     { w: 5, h: 7 },
    permissions: { sqlite: true },
    settings: [
      {
        kind: 'string',
        key: 'rapidApiKey',
        label: 'RapidAPI Key (JSearch)',
        placeholder: 'Sign up at rapidapi.com → search "JSearch" → subscribe to free plan',
      },
      {
        kind: 'string',
        key: 'defaultKeywords',
        label: 'Default search keywords',
        placeholder: 'e.g. Software Engineer',
      },
      {
        kind: 'string',
        key: 'defaultLocation',
        label: 'Default location',
        placeholder: 'e.g. New York, NY',
      },
      {
        kind: 'boolean',
        key: 'remoteOnly',
        label: 'Remote only by default',
        default: false,
      },
    ],
  },
  Component: JobAggregator,
};

export default widget;
