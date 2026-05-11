import { useState, useCallback } from 'react';
import type { WidgetApi } from '@renderer/plugins/api';
import type { CompanyFeed, FeedJob, FeedType, StampedFeedJob } from './types';
import { FEED_LABELS, inp } from './constants';
import { fetchFeed } from './api';
import { AddFeedForm, BoardSection } from './components';

interface Props {
  api: WidgetApi;
  apiKey: string;
  feeds: CompanyFeed[];
  feedJobs: Record<number, FeedJob[]>;
  savedIds: Set<string>;
  onFeedsChange: () => void;
  onSaved: () => void;
}

export function BoardsTab({ api, apiKey, feeds, feedJobs, savedIds, onFeedsChange, onSaved }: Props) {
  const [feedLoading, setFeedLoading] = useState<Record<number, boolean>>({});
  const [feedErrors, setFeedErrors]   = useState<Record<number, string>>({});
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedSearch, setFeedSearch]   = useState('');
  const [feedTypeFilter, setFeedTypeFilter] = useState<FeedType | 'all'>('all');

  const handleAddFeed = async (name: string, url: string, feedType: FeedType) => {
    await api.sql.run(
      'INSERT INTO company_feeds (name, url, feed_type, enabled, added_at) VALUES (?,?,?,1,?)',
      [name, url, feedType, Date.now()],
    );
    onFeedsChange();
    setShowAddFeed(false);
  };

  const handleDeleteFeed = async (feedId: number) => {
    await api.sql.run('DELETE FROM feed_jobs WHERE feed_id=?', [feedId]);
    await api.sql.run('DELETE FROM company_feeds WHERE id=?', [feedId]);
    onFeedsChange();
  };

  const handleRefreshFeed = useCallback(async (feed: CompanyFeed) => {
    setFeedLoading((l) => ({ ...l, [feed.id]: true }));
    setFeedErrors((e) => ({ ...e, [feed.id]: '' }));
    try {
      const jobs: StampedFeedJob[] = await fetchFeed(api.net.fetch, feed, apiKey);
      await api.sql.run('DELETE FROM feed_jobs WHERE feed_id=?', [feed.id]);
      if (jobs.length > 0) {
        await api.sql.runBatch(jobs.map((job) => ({
          sql: `INSERT OR IGNORE INTO feed_jobs
              (feed_id,ext_id,title,company,location,date_posted,apply_link,description,fetched_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
          params: [feed.id, job.ext_id, job.title, job.company, job.location, job.date_posted, job.apply_link, job.description, job.fetched_at],
        })));
      }
      onFeedsChange();
    } catch (e) {
      setFeedErrors((err) => ({ ...err, [feed.id]: e instanceof Error ? e.message : 'Fetch failed' }));
    } finally {
      setFeedLoading((l) => ({ ...l, [feed.id]: false }));
    }
  }, [api, apiKey, onFeedsChange]);

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
    onSaved();
  };

  const visibleFeeds = feeds.filter((f) => {
    if (feedTypeFilter !== 'all' && f.feed_type !== feedTypeFilter) return false;
    if (feedSearch.trim()) return f.name.toLowerCase().includes(feedSearch.trim().toLowerCase());
    return true;
  });

  return (
    <>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
  );
}
