import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFeed, searchArbeitnow } from './api';
import type { CompanyFeed, NetFetcher } from './types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchArbeitnow', () => {
  it('passes expected query params and maps response payload', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: JSON.stringify({
        data: [
          {
            slug: 'job-1',
            title: 'Engineer',
            company_name: 'Acme',
            location: 'Austin, TX',
            remote: true,
            created_at: 1704153600,
            url: 'https://example.com/jobs/1',
          }
        ],
      }),
    });

    const result = await searchArbeitnow(fetch, 'frontend engineer', true);
    const calledUrl = fetch.mock.calls[0][0];

    expect(calledUrl).toContain('search=frontend+engineer');
    expect(calledUrl).toContain('remote=true');
    expect(result[0]).toMatchObject({
      id: 'arbeitnow-job-1',
      title: 'Engineer',
      company: 'Acme',
      location: 'Austin, TX',
      isRemote: true,
      datePosted: '2024-01-02'
    });
  });

  it('throws a status error when the request fails', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: false,
      status: 403,
      body: 'forbidden',
    });

    await expect(searchArbeitnow(fetch, 'frontend', false)).rejects.toThrow('Arbeitnow error 403');
  });

  it('omits remote query param when remote is false', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: JSON.stringify({ data: [] }),
    });

    await searchArbeitnow(fetch, 'designer', false);
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('search=designer');
    expect(calledUrl).not.toContain('remote=');
  });
});

describe('fetchFeed', () => {
  it('fetches and stamps lever feeds', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: '<jobs><job><title>Backend Engineer</title><hostedUrl>https://example.com/jobs/2</hostedUrl></job></jobs>',
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
    expect(fetch).toHaveBeenCalledWith('https://api.lever.co/v0/postings/leverco?mode=xml');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ext_id: 'https://example.com/jobs/2',
      title: 'Backend Engineer',
      company: 'LeverCo',
      fetched_at: 1700000000000,
    });
  });

  it('fetches greenhouse feeds', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000100);
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: JSON.stringify({
        jobs: [
          {
            id: 'gh-1',
            title: 'Frontend Engineer',
            location: { name: 'Remote' },
            updated_at: '2024-05-01T12:00:00Z',
            absolute_url: 'https://example.com/gh-1',
          },
        ],
      }),
    });
    const feed: CompanyFeed = {
      id: 1,
      name: 'GreenhouseCo',
      url: 'greenhouseco',
      feed_type: 'greenhouse',
      company_type: 'tech',
      enabled: 1,
      added_at: 0,
    };

    const result = await fetchFeed(fetch, feed, '');
    expect(fetch).toHaveBeenCalledWith('https://api.greenhouse.io/v1/boards/greenhouseco/jobs');
    expect(result[0]).toMatchObject({
      ext_id: 'gh-1',
      title: 'Frontend Engineer',
      company: 'GreenhouseCo',
      location: 'Remote',
      date_posted: '2024-05-01',
      apply_link: 'https://example.com/gh-1',
      fetched_at: 1700000000100,
    });
  });

  it('uses rss parser when rss feed body is not lever xml', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000200);
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: '<rss><channel><item><title>Site Reliability Engineer</title><link>https://example.com/r1</link><description>Role</description></item></channel></rss>',
    });
    const feed: CompanyFeed = {
      id: 1,
      name: 'RssCo',
      url: 'https://example.com/jobs.rss',
      feed_type: 'rss',
      company_type: 'tech',
      enabled: 1,
      added_at: 0,
    };

    const result = await fetchFeed(fetch, feed, '');
    expect(fetch).toHaveBeenCalledWith('https://example.com/jobs.rss');
    expect(result[0]).toMatchObject({
      ext_id: 'https://example.com/r1',
      title: 'Site Reliability Engineer',
      company: 'RssCo',
      fetched_at: 1700000000200,
    });
  });

  it('uses lever parser for rss feeds that contain jobs xml', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000300);
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: true,
      status: 200,
      body: '<jobs><job><title>Platform Engineer</title><hostedUrl>https://example.com/jobs/9</hostedUrl></job></jobs>',
    });
    const feed: CompanyFeed = {
      id: 1,
      name: 'RssLever',
      url: 'https://example.com/jobs.xml',
      feed_type: 'rss',
      company_type: 'tech',
      enabled: 1,
      added_at: 0,
    };

    const result = await fetchFeed(fetch, feed, '');
    expect(result[0]).toMatchObject({
      ext_id: 'https://example.com/jobs/9',
      title: 'Platform Engineer',
      company: 'RssLever',
      fetched_at: 1700000000300,
    });
  });

  it('throws for disabled search feeds', async () => {
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

    await expect(fetchFeed(fetch, feed, '')).rejects.toThrow(
      'JSearch querying is disabled. Search feeds are no longer supported.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws for greenhouse request failures', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: false,
      status: 500,
      body: 'error',
    });
    const feed: CompanyFeed = {
      id: 1,
      name: 'GreenhouseCo',
      url: 'greenhouseco',
      feed_type: 'greenhouse',
      company_type: 'tech',
      enabled: 1,
      added_at: 0,
    };

    await expect(fetchFeed(fetch, feed, '')).rejects.toThrow('Greenhouse error 500');
  });

  it('throws for rss request failures', async () => {
    const fetch = vi.fn<NetFetcher>().mockResolvedValue({
      ok: false,
      status: 404,
      body: 'error',
    });
    const feed: CompanyFeed = {
      id: 1,
      name: 'RssCo',
      url: 'https://example.com/jobs.rss',
      feed_type: 'rss',
      company_type: 'tech',
      enabled: 1,
      added_at: 0,
    };

    await expect(fetchFeed(fetch, feed, '')).rejects.toThrow('RSS error 404');
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
