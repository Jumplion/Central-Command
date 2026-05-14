import { useState } from 'react';
import type { WidgetApi } from '@renderer/plugins/api';
import type { JobListing } from './types';
import { EMP_TYPES, inp } from './constants';
import { searchArbeitnow } from './api';
import { searchJSearch } from './jsearch';
import { JobCard } from './components';

interface Props {
  api: WidgetApi;
  apiKey: string;
  savedIds: Set<string>;
  onSaved: () => void;
  defaultKeywords: string;
  defaultLocation: string;
  defaultRemoteOnly: boolean;
}

export function SearchTab({ api, apiKey, savedIds, onSaved, defaultKeywords, defaultLocation, defaultRemoteOnly }: Props) {
  const [keywords, setKeywords]     = useState(defaultKeywords);
  const [location, setLocation]     = useState(defaultLocation);
  const [remoteOnly, setRemoteOnly] = useState(defaultRemoteOnly);
  const [empType, setEmpType]       = useState('all');
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
            onSave={() => void handleSave(job)}
            onApply={() => job.applyLink && void api.shell.openExternal(job.applyLink)}
          />
        ))}
      </div>
    </>
  );
}
