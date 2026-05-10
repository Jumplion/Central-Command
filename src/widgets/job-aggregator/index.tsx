import { useState, useEffect, useCallback } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  salaryPeriod: string;
  datePosted: string;
  applyLink: string;
  source: string;
  description: string;
}

type SavedStatus = 'Interested' | 'Applied' | 'Phone' | 'Onsite' | 'Offer' | 'Rejected';

interface SavedJob {
  id: number;
  job_id: string;
  title: string;
  company: string;
  location: string;
  is_remote: number;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  date_posted: string;
  apply_link: string;
  source: string;
  status: SavedStatus;
  notes: string;
  saved_at: number;
}

type NetFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; body: string }>;

const STATUSES: SavedStatus[] = ['Interested', 'Applied', 'Phone', 'Onsite', 'Offer', 'Rejected'];

const STATUS_COLORS: Record<SavedStatus, string> = {
  Interested: '#6ea8ff',
  Applied:    '#a78bfa',
  Phone:      '#f59e0b',
  Onsite:     '#ff9f40',
  Offer:      '#34d399',
  Rejected:   '#ff6e6e',
};

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn:    '#0a66c2',
  Indeed:      '#003a9b',
  Glassdoor:   '#0caa41',
  ZipRecruiter:'#59bd66',
  'Google Jobs':'#4285f4',
  Monster:     '#6e2d8e',
  Arbeitnow:   '#6ea8ff',
};

const EMP_TYPES = [
  { value: 'all',        label: 'All Types' },
  { value: 'fulltime',   label: 'Full-time' },
  { value: 'parttime',   label: 'Part-time' },
  { value: 'contractor', label: 'Contract' },
  { value: 'intern',     label: 'Internship' },
];

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS saved_jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    company         TEXT    NOT NULL,
    location        TEXT    NOT NULL DEFAULT '',
    is_remote       INTEGER NOT NULL DEFAULT 0,
    employment_type TEXT    NOT NULL DEFAULT '',
    salary_min      REAL,
    salary_max      REAL,
    salary_currency TEXT    NOT NULL DEFAULT '',
    salary_period   TEXT    NOT NULL DEFAULT '',
    date_posted     TEXT    NOT NULL DEFAULT '',
    apply_link      TEXT    NOT NULL DEFAULT '',
    source          TEXT    NOT NULL DEFAULT '',
    description     TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'Interested',
    notes           TEXT    NOT NULL DEFAULT '',
    saved_at        INTEGER NOT NULL
  );
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(
  min?: number | null,
  max?: number | null,
  currency = 'USD',
  period = 'YEAR'
): string {
  if (!min && !max) return '';
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : `${currency} `;
  const sfx = period === 'YEAR' ? '/yr' : period === 'HOUR' ? '/hr' : period === 'MONTH' ? '/mo' : '';
  if (min && max) return `${sym}${fmt(min)}–${fmt(max)}${sfx}`;
  if (min) return `${sym}${fmt(min)}+${sfx}`;
  return `Up to ${sym}${fmt(max!)}${sfx}`;
}

function relativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function empTypeLabel(t: string): string {
  const map: Record<string, string> = {
    FULLTIME: 'Full-time', PARTTIME: 'Part-time',
    CONTRACTOR: 'Contract', INTERN: 'Intern',
    fulltime: 'Full-time', parttime: 'Part-time',
    contractor: 'Contract', intern: 'Intern',
  };
  return map[t] || t;
}

// ─── API adapters ─────────────────────────────────────────────────────────────

async function searchJSearch(
  fetch: NetFetcher,
  key: string,
  query: string,
  remote: boolean,
  empType: string
): Promise<JobListing[]> {
  const p = new URLSearchParams({ query, num_pages: '1', page: '1' });
  if (remote) p.set('remote_jobs_only', 'true');
  if (empType !== 'all') p.set('employment_types', empType.toUpperCase());

  const resp = await fetch(`https://jsearch.p.rapidapi.com/search?${p}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
  });

  if (!resp.ok) {
    let msg = `JSearch error ${resp.status}`;
    try { msg = (JSON.parse(resp.body) as { message?: string }).message ?? msg; } catch {}
    throw new Error(msg);
  }

  const data = JSON.parse(resp.body) as { data?: Record<string, unknown>[] };
  return (data.data ?? []).map((j): JobListing => ({
    id:             String(j.job_id ?? Math.random()),
    title:          String(j.job_title ?? ''),
    company:        String(j.employer_name ?? ''),
    location:       [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
    isRemote:       Boolean(j.job_is_remote),
    employmentType: String(j.job_employment_type ?? ''),
    salaryMin:      typeof j.job_min_salary === 'number' ? j.job_min_salary : undefined,
    salaryMax:      typeof j.job_max_salary === 'number' ? j.job_max_salary : undefined,
    salaryCurrency: String(j.job_salary_currency ?? 'USD'),
    salaryPeriod:   String(j.job_salary_period ?? 'YEAR'),
    datePosted:     String(j.job_posted_at_datetime_utc ?? '').slice(0, 10),
    applyLink:      String(j.job_apply_link ?? ''),
    source:         String(j.job_publisher ?? 'JSearch'),
    description:    String(j.job_description ?? '').slice(0, 400),
  }));
}

async function searchArbeitnow(
  fetch: NetFetcher,
  query: string,
  remote: boolean
): Promise<JobListing[]> {
  const p = new URLSearchParams({ search: query });
  if (remote) p.set('remote', 'true');

  const resp = await fetch(`https://www.arbeitnow.com/api/job-board-api?${p}`);
  if (!resp.ok) throw new Error(`Arbeitnow error ${resp.status}`);

  const data = JSON.parse(resp.body) as { data?: Record<string, unknown>[] };
  return (data.data ?? []).slice(0, 25).map((j): JobListing => ({
    id:             `arbeitnow-${j.slug ?? Math.random()}`,
    title:          String(j.title ?? ''),
    company:        String(j.company_name ?? ''),
    location:       String(j.location ?? (j.remote ? 'Remote' : '')),
    isRemote:       Boolean(j.remote),
    employmentType: '',
    salaryCurrency: '',
    salaryPeriod:   '',
    datePosted:     typeof j.created_at === 'number'
      ? new Date(j.created_at * 1000).toISOString().slice(0, 10)
      : '',
    applyLink:      String(j.url ?? ''),
    source:         'Arbeitnow',
    description:    '',
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inp: React.CSSProperties = { fontSize: 12, padding: '4px 6px' };

function SourceBadge({ source }: { source: string }) {
  const color = SOURCE_COLORS[source] ?? '#888';
  return (
    <span style={{
      fontSize: 10, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
      background: `${color}22`, color, border: `1px solid ${color}44`, fontWeight: 600,
    }}>
      {source}
    </span>
  );
}

function StatusBadge({ status }: { status: SavedStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3,
      background: `${color}22`, color, fontWeight: 600,
    }}>
      {status}
    </span>
  );
}

function JobCard({
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
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, lineHeight: 1.3 }}>
            {job.title}
          </div>
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
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {relativeDate(job.datePosted)}
              </span>
            )}
          </div>
          {job.description && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
              {job.description.length > 160
                ? `${job.description.slice(0, 160)}…`
                : job.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <button
            className="ghost"
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={onApply}
            title="Open application link"
          >
            Apply ↗
          </button>
          <button
            className={isSaved ? 'ghost' : 'primary'}
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={onSave}
            disabled={isSaved}
            title={isSaved ? 'Already saved' : 'Save this job'}
          >
            {isSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '4px 6px', fontWeight: 500, fontSize: 11,
  textAlign: 'left', borderBottom: '1px solid var(--border)',
};
const tdStyle: React.CSSProperties = { padding: '5px 6px', verticalAlign: 'middle' };

function JobAggregator({ api, settings }: WidgetProps) {
  const [tab, setTab]               = useState<'search' | 'saved'>('search');
  const [keywords, setKeywords]     = useState((settings.defaultKeywords as string) || '');
  const [location, setLocation]     = useState((settings.defaultLocation as string) || '');
  const [remoteOnly, setRemoteOnly] = useState(Boolean(settings.remoteOnly));
  const [empType, setEmpType]       = useState('all');
  const [results, setResults]       = useState<JobListing[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const [savedJobs, setSavedJobs]   = useState<SavedJob[]>([]);
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set());
  const [savedFilter, setSavedFilter] = useState<SavedStatus | 'All'>('All');
  const [ready, setReady]           = useState(false);

  const apiKey = (settings.rapidApiKey as string) || '';

  const loadSaved = useCallback(async () => {
    const rows = await api.sql.all<SavedJob>('SELECT * FROM saved_jobs ORDER BY saved_at DESC');
    setSavedJobs(rows);
    setSavedIds(new Set(rows.map((r) => r.job_id)));
  }, [api]);

  useEffect(() => {
    api.sql.exec(INIT_SQL).then(() => {
      loadSaved();
      setReady(true);
    });
  }, []);

  const handleSearch = async () => {
    const q = keywords.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const jobs = apiKey
        ? await searchJSearch(
            api.net.fetch,
            apiKey,
            location.trim() ? `${q} in ${location.trim()}` : q,
            remoteOnly,
            empType
          )
        : await searchArbeitnow(api.net.fetch, q, remoteOnly);
      setResults(jobs);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async (job: JobListing) => {
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
      ]
    );
    await loadSaved();
  };

  const handleStatusChange = async (id: number, status: SavedStatus) => {
    await api.sql.run('UPDATE saved_jobs SET status=? WHERE id=?', [status, id]);
    await loadSaved();
  };

  const handleDelete = async (id: number) => {
    await api.sql.run('DELETE FROM saved_jobs WHERE id=?', [id]);
    await loadSaved();
  };

  const filteredSaved =
    savedFilter === 'All' ? savedJobs : savedJobs.filter((j) => j.status === savedFilter);

  if (!ready) return <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', flexShrink: 0,
        border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden',
      }}>
        {(['search', 'saved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, fontSize: 12, padding: '5px 0', border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--accent)22' : 'transparent',
              color:      tab === t ? 'var(--accent)'   : 'var(--text-dim)',
            }}
          >
            {t === 'search' ? 'Search' : `Saved (${savedJobs.length})`}
          </button>
        ))}
      </div>

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!apiKey && (
              <div style={{
                fontSize: 11, padding: '5px 8px', borderRadius: 4,
                background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b',
              }}>
                No API key — showing Arbeitnow results (remote/tech). Add a free RapidAPI key in
                widget settings for full LinkedIn, Indeed, ZipRecruiter, and Glassdoor coverage.
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
                  placeholder="Location (e.g. New York, NY)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                />
              )}
              <button
                className="primary"
                style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => void handleSearch()}
                disabled={searching || !keywords.trim()}
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {apiKey && (
                <select
                  style={{ ...inp, cursor: 'pointer' }}
                  value={empType}
                  onChange={(e) => setEmpType(e.target.value)}
                >
                  {EMP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
              <label style={{
                fontSize: 12, display: 'flex', gap: 4,
                alignItems: 'center', color: 'var(--text-dim)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                />
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
            {searchError && (
              <div style={{ fontSize: 12, color: '#ff6e6e', padding: '8px 0' }}>
                {searchError}
              </div>
            )}
            {!searching && !searchError && results.length === 0 && (
              <div style={{
                color: 'var(--text-dim)', fontSize: 13,
                textAlign: 'center', padding: '32px 0',
              }}>
                {keywords.trim()
                  ? 'No results — try different keywords or remove filters.'
                  : 'Enter keywords and press Search to find jobs.'}
              </div>
            )}
            {results.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                onSave={() => void handleSave(job)}
                onApply={() => job.applyLink && void api.shell.openExternal(job.applyLink)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Saved tab ── */}
      {tab === 'saved' && (
        <>
          {/* Status filter chips */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['All', ...STATUSES] as const).map((s) => {
              const count = s === 'All'
                ? savedJobs.length
                : savedJobs.filter((j) => j.status === s).length;
              const color = s === 'All' ? 'var(--accent)' : STATUS_COLORS[s];
              const active = savedFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setSavedFilter(s)}
                  style={{
                    fontSize: 11, padding: '2px 8px', cursor: 'pointer', borderRadius: 4,
                    background: active ? `${color}22` : 'transparent',
                    border:     active ? `1px solid ${color}55` : '1px solid transparent',
                    color:      active ? color : 'var(--text-dim)',
                  }}
                >
                  {s} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {filteredSaved.length === 0 ? (
              <div style={{
                color: 'var(--text-dim)', fontSize: 13,
                textAlign: 'center', padding: '32px 0',
              }}>
                {savedJobs.length === 0
                  ? 'No saved jobs yet — search and save interesting listings.'
                  : 'No results for this filter.'}
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
                          {job.company}
                          {job.location && ` · ${job.location}`}
                          {Boolean(job.is_remote) && ' · Remote'}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <SourceBadge source={job.source} />
                      </td>
                      <td style={tdStyle}>
                        <select
                          style={{
                            ...inp,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: STATUS_COLORS[job.status], fontWeight: 600, fontSize: 11,
                            padding: 0,
                          }}
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
                          <button
                            className="ghost"
                            style={{ fontSize: 11, padding: '1px 6px' }}
                            onClick={() => void api.shell.openExternal(job.apply_link)}
                            title="Open application link"
                          >
                            ↗
                          </button>
                        )}
                        <button
                          className="ghost danger"
                          style={{ fontSize: 11, padding: '1px 6px' }}
                          onClick={() => void handleDelete(job.id)}
                          title="Remove"
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
      )}
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'job-aggregator',
    name: 'Job Aggregator',
    description: 'Search LinkedIn, Indeed, ZipRecruiter, Glassdoor, and more. Save and track interesting listings.',
    version: '0.1.0',
    icon: '🔍',
    defaultSize: { w: 8, h: 9 },
    minSize:     { w: 5, h: 6 },
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
