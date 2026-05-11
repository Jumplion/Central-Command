import type { JobListing, CompanyFeed, NetFetcher, StampedFeedJob, ParsedFeedJob } from './types';
import { parseLeverXML, parseRSSXML, parseGreenhouseJSON } from './parsers';

// ─── JSearch (RapidAPI) ───────────────────────────────────────────────────────

export async function searchJSearch(
  fetch: NetFetcher,
  key: string,
  query: string,
  remote: boolean,
  empType: string,
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

// ─── Arbeitnow (free, no key) ─────────────────────────────────────────────────

export async function searchArbeitnow(fetch: NetFetcher, query: string, remote: boolean): Promise<JobListing[]> {
  const p = new URLSearchParams({ search: query });
  if (remote) p.set('remote', 'true');
  const resp = await fetch(`https://www.arbeitnow.com/api/job-board-api?${p}`);
  if (!resp.ok) throw new Error(`Arbeitnow error ${resp.status}`);
  const data = JSON.parse(resp.body) as { data?: Record<string, unknown>[] };
  return (data.data ?? []).slice(0, 25).map((j): JobListing => ({
    id:             `arbeitnow-${String(j.slug ?? Math.random())}`,
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

// ─── Company feed fetcher ─────────────────────────────────────────────────────

export async function fetchFeed(
  fetch: NetFetcher,
  feed: CompanyFeed,
  apiKey: string,
): Promise<StampedFeedJob[]> {
  const ts = Date.now();
  const stamp = (jobs: ParsedFeedJob[]): StampedFeedJob[] => jobs.map((j) => ({ ...j, fetched_at: ts }));

  if (feed.feed_type === 'lever') {
    const resp = await fetch(`https://api.lever.co/v0/postings/${feed.url}?mode=xml`);
    if (!resp.ok) throw new Error(`Lever error ${resp.status}`);
    return stamp(parseLeverXML(resp.body, feed.name));
  }
  if (feed.feed_type === 'greenhouse') {
    const resp = await fetch(`https://api.greenhouse.io/v1/boards/${feed.url}/jobs`);
    if (!resp.ok) throw new Error(`Greenhouse error ${resp.status}`);
    return stamp(parseGreenhouseJSON(resp.body, feed.name));
  }
  if (feed.feed_type === 'rss') {
    const resp = await fetch(feed.url);
    if (!resp.ok) throw new Error(`RSS error ${resp.status}`);
    // Try Lever XML first (uses <jobs> root), then generic RSS/Atom
    return stamp(resp.body.includes('<jobs>') ? parseLeverXML(resp.body, feed.name) : parseRSSXML(resp.body, feed.name));
  }
  if (feed.feed_type === 'search') {
    if (!apiKey) throw new Error('JSearch API key required for keyword-search feeds. Add it in widget settings.');
    const jobs = await searchJSearch(fetch, apiKey, feed.url, false, 'all');
    return jobs.slice(0, 25).map((j) => ({
      ext_id:      j.id,
      title:       j.title,
      company:     j.company,
      location:    j.location,
      date_posted: j.datePosted,
      apply_link:  j.applyLink,
      description: j.description,
      fetched_at:  ts,
    }));
  }
  throw new Error(`Unknown feed type: ${feed.feed_type}`);
}
