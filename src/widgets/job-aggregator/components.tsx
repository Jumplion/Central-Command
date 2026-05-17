import { useState } from 'react';
import type { JobListing, CompanyFeed, FeedJob, FeedType, CompanyType, SavedStatus } from './types';
import { SOURCE_COLORS, STATUS_COLORS, FEED_COLORS, FEED_LABELS, COMPANY_TYPE_LABELS, COMPANY_TYPE_ORDER, STATUSES, inp, thStyle, tdStyle } from './constants';
import { buttonDefault, buttonSmall, buttonTiny, badgePill, dimText, smallDimText } from '../_shared/styles';
import { formatSalary, relativeDate, empTypeLabel } from './utils';

// ─── SourceBadge ──────────────────────────────────────────────────────────────

export function SourceBadge({ source }: { source: string }) {
  const color = SOURCE_COLORS[source] ?? '#888';
  return (
    <span style={{
      ...badgePill,
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {source}
    </span>
  );
}

// ─── FeedTypeBadge ────────────────────────────────────────────────────────────

export function FeedTypeBadge({ type }: { type: FeedType }) {
  const color = FEED_COLORS[type];
  return (
    <span style={{
      ...badgePill,
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {FEED_LABELS[type]}
    </span>
  );
}

// ─── JobCard ──────────────────────────────────────────────────────────────────

export function JobCard({
  job, isSaved, onSave, onApply,
}: {
  job: JobListing;
  isSaved: boolean;
  onSave: () => void;
  onApply: () => void;
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 6,
      padding: '8px 10px', marginBottom: 6, background: 'var(--panel-2)',
      transition: 'background-color 0.15s',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(110, 168, 255, 0.07)'}
    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, lineHeight: 1.3 }}>{job.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
            {job.company}
            {job.location && ` · ${job.location}`}
            {job.isRemote && <> · <span style={{ color: '#34d399' }}>Remote</span></>}
            {job.employmentType && ` · ${empTypeLabel(job.employmentType)}`}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <SourceBadge source={job.source} />
            {salary && <span style={{ fontSize: 11, color: '#34d399' }}>{salary}</span>}
            {job.datePosted && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{relativeDate(job.datePosted)}</span>
            )}
          </div>
          {job.description && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
              {job.description.length > 160 ? `${job.description.slice(0, 160)}…` : job.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <button className="ghost" style={buttonSmall} onClick={(e) => { e.stopPropagation(); onApply(); }}>Apply ↗</button>
          <button
            className={isSaved ? 'ghost' : 'primary'}
            style={buttonSmall}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            disabled={isSaved}
          >
            {isSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AddFeedForm ──────────────────────────────────────────────────────────────

const ADD_FEED_META: Record<FeedType, { placeholder: string; hint: string }> = {
  lever:      { placeholder: 'e.g. netflix  (from jobs.lever.co/netflix)',                    hint: 'Find it in the jobs.lever.co/YOUR-HANDLE URL' },
  greenhouse: { placeholder: 'e.g. squarespace  (from boards.greenhouse.io/squarespace)',     hint: 'Find it in the boards.greenhouse.io/YOUR-TOKEN URL' },
  rss:        { placeholder: 'https://example.com/jobs/feed.xml',                             hint: 'Any public RSS or Atom XML feed' },
  search:     { placeholder: 'e.g. Toyota Motor  (aggregates from LinkedIn, Indeed, etc.)',   hint: 'Requires a RapidAPI key in widget settings' },
};

export function AddFeedForm({ onSave, onCancel }: {
  onSave: (name: string, url: string, feedType: FeedType, companyType: CompanyType) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName]               = useState('');
  const [feedType, setFeedType]       = useState<FeedType>('lever');
  const [companyType, setCompanyType] = useState<CompanyType>('tech');
  const [url, setUrl]                 = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try { await onSave(name.trim(), url.trim(), feedType, companyType); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      border: '1px solid var(--border)', borderRadius: 6,
      padding: 10, background: 'var(--panel-2)',
      display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <input style={inp} placeholder="Company name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <select style={{ ...inp, cursor: 'pointer' }} value={companyType} onChange={(e) => setCompanyType(e.target.value as CompanyType)}>
          {COMPANY_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>{COMPANY_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={feedType} onChange={(e) => setFeedType(e.target.value as FeedType)}>
          <option value="lever">Lever (public XML feed)</option>
          <option value="greenhouse">Greenhouse (public JSON API)</option>
          <option value="rss">RSS / Atom XML</option>
          <option value="search">JSearch keyword search</option>
        </select>
      </div>
      <input
        style={inp}
        placeholder={ADD_FEED_META[feedType].placeholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{ADD_FEED_META[feedType].hint}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" className="primary" style={buttonDefault} disabled={saving}>
          {saving ? 'Adding…' : 'Add Feed'}
        </button>
        <button type="button" className="ghost" style={buttonDefault} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── BoardSection ─────────────────────────────────────────────────────────────

export function BoardSection({
  feed, jobs, loading, error, savedIds,
  onRefresh, onDelete, onSave, onApply, onIgnore,
}: {
  feed: CompanyFeed;
  jobs: FeedJob[];
  loading: boolean;
  error: string;
  savedIds: Set<string>;
  onRefresh: () => void;
  onDelete: () => void;
  onSave: (job: FeedJob) => void;
  onApply: (url: string) => void;
  onIgnore: (job: FeedJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lastFetch = jobs[0]?.fetched_at;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--panel-2)', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded((x) => !x)}
      >
        <span style={{ fontSize: 12, flex: 1, fontWeight: 500 }}>{feed.name}</span>
        <FeedTypeBadge type={feed.feed_type} />
        {!loading && jobs.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        )}
        {loading && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Fetching…</span>}
        {lastFetch && !loading && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }} title={new Date(lastFetch).toLocaleString()}>
            {relativeDate(new Date(lastFetch).toISOString().slice(0, 10))}
          </span>
        )}
        <button
          className="ghost"
          style={buttonTiny}
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          title="Refresh"
          disabled={loading}
        >↻</button>
        <button
          className="ghost danger"
          style={buttonTiny}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Remove feed"
        >✕</button>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '6px 10px 10px' }}>
          {error && <div style={{ fontSize: 11, color: '#ff6e6e', marginBottom: 6 }}>{error}</div>}
          {!loading && !error && jobs.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 0' }}>
              No jobs cached — click ↻ to fetch.
              {feed.feed_type === 'search' && ' (Requires RapidAPI key in settings.)'}
            </div>
          )}
          {jobs.map((job) => {
            const savedKey = `feed-${feed.id}-${job.ext_id}`;
            return (
              <div
                key={job.id}
                style={{
                  display: 'flex', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-start',
                  transition: 'background-color 0.15s, padding 0.15s',
                  paddingLeft: '4px', paddingRight: '4px', marginLeft: '-4px', marginRight: '-4px', borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(110, 168, 255, 0.07)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, lineHeight: 1.3 }}>{job.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {job.company}
                    {job.location && ` · ${job.location}`}
                    {job.date_posted && ` · ${relativeDate(job.date_posted)}`}
                  </div>
                  {job.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                      {job.description.length > 130 ? `${job.description.slice(0, 130)}…` : job.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {job.apply_link && (
                    <button className="ghost" style={buttonTiny} onClick={(e) => { e.stopPropagation(); onApply(job.apply_link); }} title="Open posting">↗</button>
                  )}
                  <button
                    className={savedIds.has(savedKey) ? 'ghost' : 'primary'}
                    style={buttonTiny}
                    onClick={(e) => { e.stopPropagation(); onSave(job); }}
                    disabled={savedIds.has(savedKey)}
                    title={savedIds.has(savedKey) ? 'Already saved' : 'Save to tracker'}
                  >
                    {savedIds.has(savedKey) ? '✓' : 'Save'}
                  </button>
                  <button
                    className="ghost"
                    style={{ ...buttonTiny, color: 'var(--text-dim)' }}
                    onClick={(e) => { e.stopPropagation(); onIgnore(job); }}
                    title="Ignore this job"
                  >🚫</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SavedStatusFilter ────────────────────────────────────────────────────────

export function SavedStatusFilter({
  savedJobs, savedFilter, onSelect,
}: {
  savedJobs: { status: SavedStatus }[];
  savedFilter: SavedStatus | 'All';
  onSelect: (s: SavedStatus | 'All') => void;
}) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {(['All', ...STATUSES] as const).map((s) => {
        const count  = s === 'All' ? savedJobs.length : savedJobs.filter((j) => j.status === s).length;
        const color  = s === 'All' ? 'var(--accent)' : STATUS_COLORS[s];
        const active = savedFilter === s;
        return (
          <button key={s} onClick={() => onSelect(s)} style={{
            ...buttonSmall,
            cursor: 'pointer',
            borderRadius: 4,
            background: active ? `${color}22` : 'transparent',
            border:     active ? `1px solid ${color}55` : '1px solid transparent',
            color:      active ? color : 'var(--text-dim)',
          }}>
            {s} ({count})
          </button>
        );
      })}
    </div>
  );
}
