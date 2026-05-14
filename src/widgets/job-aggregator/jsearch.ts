import type { JobListing, NetFetcher } from './types';

// ─── JSearch (RapidAPI) ───────────────────────────────────────────────────────
// Kept for reference but not actively used by Job Aggregator

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
