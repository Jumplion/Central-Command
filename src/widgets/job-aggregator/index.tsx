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

type FeedType = 'rss' | 'lever' | 'greenhouse' | 'search';

interface CompanyFeed {
  id: number;
  name: string;
  url: string; // handle for lever/greenhouse, full URL for rss, search query for search
  feed_type: FeedType;
  enabled: number;
  added_at: number;
}

interface FeedJob {
  id: number;
  feed_id: number;
  ext_id: string;
  title: string;
  company: string;
  location: string;
  date_posted: string;
  apply_link: string;
  description: string;
  fetched_at: number;
}

type NetFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; body: string }>;

// ─── Constants ────────────────────────────────────────────────────────────────

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
  Lever:       '#5d5df8',
  Greenhouse:  '#24a47f',
};

const FEED_COLORS: Record<FeedType, string> = {
  rss:        '#f59e0b',
  lever:      '#5d5df8',
  greenhouse: '#24a47f',
  search:     '#6ea8ff',
};

const FEED_LABELS: Record<FeedType, string> = {
  rss:        'RSS',
  lever:      'Lever',
  greenhouse: 'Greenhouse',
  search:     'Search',
};

const EMP_TYPES = [
  { value: 'all',        label: 'All Types' },
  { value: 'fulltime',   label: 'Full-time' },
  { value: 'parttime',   label: 'Part-time' },
  { value: 'contractor', label: 'Contract' },
  { value: 'intern',     label: 'Internship' },
];

// Pre-seeded company feeds. Bump SEED_VERSION whenever new entries are added —
// the idempotent seeder will insert only names that don't already exist.
//
// Feed types:
//   lever       – public XML at api.lever.co/v0/postings/{handle}?mode=xml (no key)
//   greenhouse  – public JSON at api.greenhouse.io/v1/boards/{token}/jobs   (no key)
//   search      – JSearch keyword search (requires RapidAPI key in settings)
//                 Used for large enterprises on Workday/Taleo/proprietary ATS
//                 with no public feed endpoints.
export const SEED_VERSION = 3;

const DEFAULT_FEEDS: Array<{ name: string; url: string; feed_type: FeedType }> = [
  // ── Tech / SaaS — Lever ───────────────────────────────────────────────────
  { name: 'AppLovin',            url: 'applovin',            feed_type: 'lever' },
  { name: 'Eventbrite',          url: 'eventbrite',          feed_type: 'lever' },
  { name: 'Kabam',               url: 'kabam',               feed_type: 'lever' },
  { name: 'KPMG',                url: 'kpmg',                feed_type: 'lever' },
  { name: 'Netflix',             url: 'netflix',             feed_type: 'lever' },
  { name: 'Niantic',             url: 'niantic',             feed_type: 'lever' },
  { name: 'Palantir',            url: 'palantir',            feed_type: 'lever' },
  { name: 'People Can Fly',      url: 'peoplecanfly',        feed_type: 'lever' },
  { name: 'Scopely',             url: 'scopely',             feed_type: 'lever' },
  { name: 'Shield AI',           url: 'shieldai',            feed_type: 'lever' },
  { name: 'Shopify',             url: 'shopify',             feed_type: 'lever' },
  { name: 'Unity Technologies',  url: 'unity',               feed_type: 'lever' },

  // ── Texas Tech — Lever ────────────────────────────────────────────────────
  { name: 'HighLevel (Dallas)',   url: 'gohighlevel',         feed_type: 'lever' },
  { name: 'Jam City',            url: 'jamcity',             feed_type: 'lever' },

  // ── Gaming — Greenhouse ────────────────────────────────────────────────────
  { name: '2K Games',             url: '2k',                             feed_type: 'greenhouse' },
  { name: 'Avalanche Studios',    url: 'avalanchestudios',               feed_type: 'greenhouse' },
  { name: 'Bungie',               url: 'bungie',                         feed_type: 'greenhouse' },
  { name: 'CD Projekt Red',       url: 'cdprojektred',                   feed_type: 'greenhouse' },
  { name: 'Devolver Digital',     url: 'devolverdigital',                feed_type: 'greenhouse' },
  { name: 'Digital Extremes',     url: 'digitalextremes',                feed_type: 'greenhouse' },
  { name: 'Epic Games',           url: 'epicgames',                      feed_type: 'greenhouse' },
  { name: 'Frontier Developments', url: 'frontierdevelopments',          feed_type: 'greenhouse' },
  { name: 'Hi-Rez Studios',       url: 'hirezstudios',                   feed_type: 'greenhouse' },
  { name: 'Insomniac Games',      url: 'insomniac',                      feed_type: 'greenhouse' },
  { name: 'IO Interactive',       url: 'iointeractive',                  feed_type: 'greenhouse' },
  { name: 'Iron Galaxy',          url: 'irongalaxy',                     feed_type: 'greenhouse' },
  { name: 'Jagex',                url: 'jagex',                          feed_type: 'greenhouse' },
  { name: 'Naughty Dog',          url: 'naughtydog',                     feed_type: 'greenhouse' },
  { name: 'Paradox Interactive',  url: 'paradoxinteractive',             feed_type: 'greenhouse' },
  { name: 'PlayStation / Sony IE', url: 'sonyinteractiveentertainmentglobal', feed_type: 'greenhouse' },
  { name: 'Riot Games',           url: 'riotgames',                      feed_type: 'greenhouse' },
  { name: 'Rockstar Games',       url: 'rockstargames',                  feed_type: 'greenhouse' },
  { name: 'Take-Two Interactive', url: 'taketwo',                        feed_type: 'greenhouse' },
  { name: 'Team17',               url: 'team17',                         feed_type: 'greenhouse' },
  { name: 'Turtle Rock Studios',  url: 'turtlerock',                     feed_type: 'greenhouse' },
  { name: 'Wargaming',            url: 'wargaming',                      feed_type: 'greenhouse' },
  { name: 'Wizards of the Coast', url: 'wizardsofthecoast',              feed_type: 'greenhouse' },

  // ── Tech — Greenhouse (verified tokens) ───────────────────────────────────
  { name: 'Anthropic',            url: 'anthropic',           feed_type: 'greenhouse' },
  { name: 'GitLab',               url: 'gitlab',              feed_type: 'greenhouse' },
  { name: 'Reddit',               url: 'reddit',              feed_type: 'greenhouse' },

  // ── Texas Fortune 500 — JSearch (Workday / proprietary ATS) ───────────────
  { name: 'American Airlines',    url: 'American Airlines',              feed_type: 'search' },
  { name: 'AT&T',                 url: 'AT&T software engineer jobs',    feed_type: 'search' },
  { name: 'Bank of America',      url: 'Bank of America',                feed_type: 'search' },
  { name: 'Dell Technologies',    url: 'Dell Technologies',              feed_type: 'search' },
  { name: 'ExxonMobil',           url: 'ExxonMobil Houston Texas',       feed_type: 'search' },
  { name: 'Southwest Airlines',   url: 'Southwest Airlines Dallas',      feed_type: 'search' },
  { name: 'Texas Instruments',    url: 'Texas Instruments Dallas',       feed_type: 'search' },
  { name: 'Toyota',               url: 'Toyota Motor',                   feed_type: 'search' },
  { name: 'USAA',                 url: 'USAA San Antonio Texas',         feed_type: 'search' },

  // ── Defense / Aerospace Texas — JSearch ───────────────────────────────────
  { name: 'Boeing',               url: 'Boeing engineer Texas',          feed_type: 'search' },
  { name: 'L3Harris',             url: 'L3Harris engineer Texas',        feed_type: 'search' },
  { name: 'Lockheed Martin',      url: 'Lockheed Martin Fort Worth Texas', feed_type: 'search' },
  { name: 'Raytheon',             url: 'Raytheon Texas',                 feed_type: 'search' },

  // ── Cybersecurity (Texas presence) — JSearch ──────────────────────────────
  { name: 'CrowdStrike',          url: 'CrowdStrike Austin Texas',       feed_type: 'search' },
  { name: 'Forcepoint',           url: 'Forcepoint Austin Texas',        feed_type: 'search' },
  { name: 'Palo Alto Networks',   url: 'Palo Alto Networks cybersecurity', feed_type: 'search' },
  { name: 'SentinelOne',          url: 'SentinelOne cybersecurity',      feed_type: 'search' },
  { name: 'Trellix',              url: 'Trellix Plano Texas cybersecurity', feed_type: 'search' },

  // ── Gaming Publishers — JSearch (Workday / proprietary ATS) ─────────────
  { name: 'Activision Blizzard',  url: 'Activision Blizzard',            feed_type: 'search' },
  { name: 'Bandai Namco',         url: 'Bandai Namco game developer',    feed_type: 'search' },
  { name: 'Capcom',               url: 'Capcom game developer',          feed_type: 'search' },
  { name: 'Electronic Arts (EA)', url: 'Electronic Arts',                feed_type: 'search' },
  { name: 'Gearbox Software',     url: 'Gearbox Software Frisco Texas',  feed_type: 'search' },
  { name: 'Nintendo',             url: 'Nintendo developer',             feed_type: 'search' },
  { name: 'Sega',                 url: 'Sega game developer',            feed_type: 'search' },
  { name: 'Square Enix',          url: 'Square Enix game developer',     feed_type: 'search' },
  { name: 'Ubisoft',              url: 'Ubisoft',                        feed_type: 'search' },
  { name: 'Warner Bros Games',    url: 'Warner Bros Games developer',    feed_type: 'search' },
  { name: 'Xbox Game Studios',    url: 'Xbox Game Studios developer',    feed_type: 'search' },
];

// ─── SQL ──────────────────────────────────────────────────────────────────────

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
  CREATE TABLE IF NOT EXISTS company_feeds (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    url        TEXT    NOT NULL,
    feed_type  TEXT    NOT NULL DEFAULT 'rss',
    enabled    INTEGER NOT NULL DEFAULT 1,
    added_at   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feed_jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id     INTEGER NOT NULL,
    ext_id      TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    company     TEXT    NOT NULL DEFAULT '',
    location    TEXT    NOT NULL DEFAULT '',
    date_posted TEXT    NOT NULL DEFAULT '',
    apply_link  TEXT    NOT NULL DEFAULT '',
    description TEXT    NOT NULL DEFAULT '',
    fetched_at  INTEGER NOT NULL,
    UNIQUE(feed_id, ext_id)
  );
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(
  min?: number | null,
  max?: number | null,
  currency = 'USD',
  period = 'YEAR',
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
    FULLTIME: 'Full-time', PARTTIME: 'Part-time', CONTRACTOR: 'Contract', INTERN: 'Intern',
    fulltime: 'Full-time', parttime: 'Part-time', contractor: 'Contract', intern: 'Intern',
  };
  return map[t] || t;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Feed parsers ─────────────────────────────────────────────────────────────

type ParsedFeedJob  = Omit<FeedJob, 'id' | 'feed_id' | 'fetched_at'>;
type StampedFeedJob = ParsedFeedJob & { fetched_at: number };

function parseLeverXML(xmlText: string, feedName: string): ParsedFeedJob[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML from Lever feed');
  const results: ParsedFeedJob[] = [];
  doc.querySelectorAll('job').forEach((job) => {
    const title      = job.querySelector('title')?.textContent?.trim() ?? '';
    const hostedUrl  = job.querySelector('hostedUrl')?.textContent?.trim() ?? '';
    const applyUrl   = job.querySelector('applyUrl')?.textContent?.trim() || hostedUrl;
    const location   = job.querySelector('categories location')?.textContent?.trim() ?? '';
    const createdAt  = job.querySelector('createdAt')?.textContent?.trim();
    const datePosted = createdAt ? new Date(Number(createdAt)).toISOString().slice(0, 10) : '';
    const desc = stripHtml(
      job.querySelector('descriptionBody')?.textContent ??
      job.querySelector('description')?.textContent ?? ''
    ).slice(0, 400);
    if (title && hostedUrl) {
      results.push({ ext_id: hostedUrl, title, company: feedName, location, date_posted: datePosted, apply_link: applyUrl, description: desc });
    }
  });
  return results;
}

function parseRSSXML(xmlText: string, feedName: string): ParsedFeedJob[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML feed');
  const rssItems   = Array.from(doc.querySelectorAll('item'));
  const atomItems  = Array.from(doc.querySelectorAll('entry'));
  const nodes      = rssItems.length > 0 ? rssItems : atomItems;
  const results: ParsedFeedJob[] = [];
  nodes.forEach((item) => {
    const isAtom = item.tagName === 'entry';
    const title  = item.querySelector('title')?.textContent?.trim() ?? '';
    const link   = isAtom
      ? (item.querySelector('link')?.getAttribute('href') ?? '')
      : (item.querySelector('link')?.textContent?.trim() ?? item.querySelector('guid')?.textContent?.trim() ?? '');
    const desc = stripHtml(
      item.querySelector('description')?.textContent ??
      item.querySelector('summary')?.textContent ?? ''
    ).slice(0, 400);
    const pub = item.querySelector('pubDate')?.textContent ?? item.querySelector('updated')?.textContent ?? '';
    const d   = pub ? new Date(pub) : null;
    const datePosted = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
    if (title && link) {
      results.push({
        ext_id: link,
        title,
        company: item.querySelector('company')?.textContent?.trim() || feedName,
        location: item.querySelector('location')?.textContent?.trim() ?? '',
        date_posted: datePosted,
        apply_link: link,
        description: desc,
      });
    }
  });
  return results;
}

function parseGreenhouseJSON(jsonText: string, feedName: string): ParsedFeedJob[] {
  const data = JSON.parse(jsonText) as { jobs?: Record<string, unknown>[] };
  return (data.jobs ?? [])
    .map((j): ParsedFeedJob => ({
      ext_id:      String(j.id ?? Math.random()),
      title:       String(j.title ?? ''),
      company:     feedName,
      location:    (j.location as { name?: string } | null)?.name ?? '',
      date_posted: String(j.updated_at ?? '').slice(0, 10),
      apply_link:  String(j.absolute_url ?? ''),
      description: '',
    }))
    .filter((j) => j.title);
}

// ─── API adapters ─────────────────────────────────────────────────────────────

async function searchJSearch(
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

async function searchArbeitnow(fetch: NetFetcher, query: string, remote: boolean): Promise<JobListing[]> {
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

async function fetchFeed(
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
    // Try Lever XML first (it uses <job> tags), then generic RSS
    const isLeverFmt = resp.body.includes('<jobs>');
    return stamp(isLeverFmt ? parseLeverXML(resp.body, feed.name) : parseRSSXML(resp.body, feed.name));
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

function FeedTypeBadge({ type }: { type: FeedType }) {
  const color = FEED_COLORS[type];
  return (
    <span style={{
      fontSize: 10, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
      background: `${color}22`, color, border: `1px solid ${color}44`, fontWeight: 600,
    }}>
      {FEED_LABELS[type]}
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
          <button className="ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={onApply}>Apply ↗</button>
          <button
            className={isSaved ? 'ghost' : 'primary'}
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={onSave}
            disabled={isSaved}
          >
            {isSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddFeedForm({ onSave, onCancel }: {
  onSave: (name: string, url: string, feedType: FeedType) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName]         = useState('');
  const [feedType, setFeedType] = useState<FeedType>('lever');
  const [url, setUrl]           = useState('');
  const [saving, setSaving]     = useState(false);

  const meta: Record<FeedType, { label: string; placeholder: string; hint: string }> = {
    lever:      { label: 'Company handle', placeholder: 'e.g. netflix  (from jobs.lever.co/netflix)', hint: 'Find it in the jobs.lever.co/YOUR-HANDLE URL' },
    greenhouse: { label: 'Board token',    placeholder: 'e.g. squarespace  (from boards.greenhouse.io/squarespace)', hint: 'Find it in the boards.greenhouse.io/YOUR-TOKEN URL' },
    rss:        { label: 'Feed URL',       placeholder: 'https://example.com/jobs/feed.xml', hint: 'Any public RSS or Atom XML feed' },
    search:     { label: 'Search keywords', placeholder: 'e.g. Toyota Motor  (aggregates from LinkedIn, Indeed, etc.)', hint: 'Requires a RapidAPI key in widget settings' },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try { await onSave(name.trim(), url.trim(), feedType); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      border: '1px solid var(--border)', borderRadius: 6,
      padding: 10, background: 'var(--panel-2)',
      display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <input style={inp} placeholder="Company name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <select style={{ ...inp, cursor: 'pointer' }} value={feedType} onChange={(e) => setFeedType(e.target.value as FeedType)}>
          <option value="lever">Lever (public XML feed)</option>
          <option value="greenhouse">Greenhouse (public JSON API)</option>
          <option value="rss">RSS / Atom XML</option>
          <option value="search">JSearch keyword search</option>
        </select>
      </div>
      <input
        style={inp}
        placeholder={meta[feedType].placeholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{meta[feedType].hint}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" className="primary" style={{ fontSize: 12, padding: '4px 10px' }} disabled={saving}>
          {saving ? 'Adding…' : 'Add Feed'}
        </button>
        <button type="button" className="ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function BoardSection({
  feed, jobs, loading, error, savedIds,
  onRefresh, onDelete, onSave, onApply,
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
          style={{ fontSize: 11, padding: '1px 6px' }}
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          title="Refresh"
          disabled={loading}
        >↻</button>
        <button
          className="ghost danger"
          style={{ fontSize: 11, padding: '1px 6px' }}
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
                style={{ display: 'flex', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}
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
                    <button className="ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={() => onApply(job.apply_link)} title="Open posting">↗</button>
                  )}
                  <button
                    className={savedIds.has(savedKey) ? 'ghost' : 'primary'}
                    style={{ fontSize: 11, padding: '1px 6px' }}
                    onClick={() => onSave(job)}
                    disabled={savedIds.has(savedKey)}
                    title={savedIds.has(savedKey) ? 'Already saved' : 'Save to tracker'}
                  >
                    {savedIds.has(savedKey) ? '✓' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Table helpers ─────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '4px 6px', fontWeight: 500, fontSize: 11,
  textAlign: 'left', borderBottom: '1px solid var(--border)',
};
const tdStyle: React.CSSProperties = { padding: '5px 6px', verticalAlign: 'middle' };

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

  // Idempotent: inserts a default feed only if no feed with that name already exists.
  // Run on every mount so new entries added in future code updates are picked up.
  const seedDefaultFeeds = useCallback(async () => {
    for (const f of DEFAULT_FEEDS) {
      await api.sql.run(
        `INSERT INTO company_feeds (name, url, feed_type, enabled, added_at)
         SELECT ?, ?, ?, 1, ? WHERE NOT EXISTS
           (SELECT 1 FROM company_feeds WHERE name = ?)`,
        [f.name, f.url, f.feed_type, Date.now(), f.name],
      );
    }
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
          <div style={{ flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['All', ...STATUSES] as const).map((s) => {
              const count = s === 'All' ? savedJobs.length : savedJobs.filter((j) => j.status === s).length;
              const color = s === 'All' ? 'var(--accent)' : STATUS_COLORS[s];
              const active = savedFilter === s;
              return (
                <button key={s} onClick={() => setSavedFilter(s)} style={{
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer', borderRadius: 4,
                  background: active ? `${color}22` : 'transparent',
                  border:     active ? `1px solid ${color}55` : '1px solid transparent',
                  color:      active ? color : 'var(--text-dim)',
                }}>
                  {s} ({count})
                </button>
              );
            })}
          </div>
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
