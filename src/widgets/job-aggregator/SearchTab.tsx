import { useState } from 'react';
import type { WidgetApi } from '@renderer/plugins/api';
import type { JobListing } from './types';
import { inp } from '../_shared/styles';
import { searchArbeitnow } from './api';
import { JobCard } from './components';
import { buttonDefault, dimText, smallDimText } from '../_shared/styles';

interface Props {
  api: WidgetApi;
  savedIds: Set<string>;
  onSaved: () => void;
  defaultKeywords: string;
  defaultRemoteOnly: boolean;
}

export function SearchTab({ api, savedIds, onSaved, defaultKeywords, defaultRemoteOnly }: Props) {
  const [keywords, setKeywords]     = useState(defaultKeywords);
  const [remoteOnly, setRemoteOnly] = useState(defaultRemoteOnly);
  const [results, setResults]       = useState<JobListing[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearch = async () => {
    const q = keywords.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const jobs = await searchArbeitnow(api.net.fetch, q, remoteOnly);
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
      ],
    );
    onSaved();
  };

  return (
    <>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, padding: '5px 8px', borderRadius: 4, background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
          Using Arbeitnow for job search (remote/tech focused). JSearch querying is disabled.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Keywords (e.g. Software Engineer)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
          />
          <button className="primary" style={buttonDefault} onClick={() => void handleSearch()} disabled={searching || !keywords.trim()}>
            {searching ? '…' : 'Search'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', ...dimText, cursor: 'pointer' }}>
            <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
            Remote only
          </label>
          {results.length > 0 && (
            <span style={{ ...smallDimText, marginLeft: 'auto' }}>
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
