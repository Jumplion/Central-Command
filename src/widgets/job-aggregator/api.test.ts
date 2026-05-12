import { describe, expect, it, vi } from 'vitest';
import { fetchFeed, searchJSearch } from './api';
import type { CompanyFeed, NetFetcher } from './types';

describe('searchJSearch', () => {
  it('passes expected query params and maps response payload', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: JSON.stringify({
        data: [
          {
            job_id: 'job-1',
            job_title: 'Engineer',
            employer_name: 'Acme',
            job_city: 'Austin',
            job_state: 'TX',
            job_country: 'US',
            job_is_remote: true,
            job_employment_type: 'FULLTIME',
            job_min_salary: 100000,
            job_max_salary: 150000,
            job_salary_currency: 'USD',
            job_salary_period: 'YEAR',
            job_posted_at_datetime_utc: '2024-01-02T00:00:00Z',
            job_apply_link: 'https://example.com/jobs/1',
            job_publisher: 'JSearch',
            job_description: 'Build product'
          }
        ]
      })
    });

    const result = await searchJSearch(fetch, 'abc', 'frontend engineer', true, 'fulltime');
    const calledUrl = fetch.mock.calls[0][0];

    expect(calledUrl).toContain('query=frontend+engineer');
    expect(calledUrl).toContain('remote_jobs_only=true');
    expect(calledUrl).toContain('employment_types=FULLTIME');
    expect(result[0]).toMatchObject({
      id: 'job-1',
      title: 'Engineer',
      company: 'Acme',
      location: 'Austin, TX, US',
      isRemote: true,
      salaryMin: 100000,
      salaryMax: 150000,
      datePosted: '2024-01-02'
    });
  });

  it('surfaces API message when present', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: false,
      status: 403,
      body: JSON.stringify({ message: 'Forbidden' })
    });

    await expect(searchJSearch(fetch, 'abc', 'frontend', false, 'all')).rejects.toThrow('Forbidden');
  });
});

describe('fetchFeed', () => {
  it('fetches and stamps lever feeds', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: '<jobs><job><title>Backend Engineer</title><hostedUrl>https://example.com/jobs/2</hostedUrl></job></jobs>'
    });
    const feed: CompanyFeed = {
      id: 1,
      name: 'LeverCo',
      url: 'leverco',
      feed_type: 'lever',
      company_type: 'tech',
      enabled: 1,
      added_at: 0
    };

    const result = await fetchFeed(fetch, feed, '');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ext_id: 'https://example.com/jobs/2',
      title: 'Backend Engineer',
      company: 'LeverCo'
    });
    expect(typeof result[0].fetched_at).toBe('number');
  });

  it('requires API key for search feeds', async () => {
    const fetch = vi.fn<NetFetcher>();
    const feed: CompanyFeed = {
      id: 1,
      name: 'SearchCo',
      url: 'engineer',
      feed_type: 'search',
      company_type: 'tech',
      enabled: 1,
      added_at: 0
    };

    await expect(fetchFeed(fetch, feed, '')).rejects.toThrow('JSearch API key required');
  });

  it('throws for unknown feed types', async () => {
    const fetch = vi.fn<NetFetcher>();
    const feed = {
      id: 1,
      name: 'Unknown',
      url: 'unknown',
      feed_type: 'unknown',
      company_type: 'other',
      enabled: 1,
      added_at: 0
    } as unknown as CompanyFeed;

    await expect(fetchFeed(fetch, feed, 'key')).rejects.toThrow('Unknown feed type: unknown');
  });
});
