import type { FeedType, SavedStatus } from './types';

// ─── Status / source colours ──────────────────────────────────────────────────

export const STATUSES: SavedStatus[] = ['Interested', 'Applied', 'Phone', 'Onsite', 'Offer', 'Rejected'];

export const STATUS_COLORS: Record<SavedStatus, string> = {
  Interested: '#6ea8ff',
  Applied:    '#a78bfa',
  Phone:      '#f59e0b',
  Onsite:     '#ff9f40',
  Offer:      '#34d399',
  Rejected:   '#ff6e6e',
};

export const SOURCE_COLORS: Record<string, string> = {
  LinkedIn:     '#0a66c2',
  Indeed:       '#003a9b',
  Glassdoor:    '#0caa41',
  ZipRecruiter: '#59bd66',
  'Google Jobs':'#4285f4',
  Monster:      '#6e2d8e',
  Arbeitnow:    '#6ea8ff',
  Lever:        '#5d5df8',
  Greenhouse:   '#24a47f',
};

export const FEED_COLORS: Record<FeedType, string> = {
  rss:        '#f59e0b',
  lever:      '#5d5df8',
  greenhouse: '#24a47f',
  search:     '#6ea8ff',
};

export const FEED_LABELS: Record<FeedType, string> = {
  rss:        'RSS',
  lever:      'Lever',
  greenhouse: 'Greenhouse',
  search:     'Search',
};

export const EMP_TYPES = [
  { value: 'all',        label: 'All Types' },
  { value: 'fulltime',   label: 'Full-time' },
  { value: 'parttime',   label: 'Part-time' },
  { value: 'contractor', label: 'Contract' },
  { value: 'intern',     label: 'Internship' },
];

// ─── Seed data ────────────────────────────────────────────────────────────────

// Bump SEED_VERSION whenever new entries are added — the seeder skips if the
// stored version already matches (checked via KV on every mount).
export const SEED_VERSION = 3;

export const DEFAULT_FEEDS: Array<{ name: string; url: string; feed_type: FeedType }> = [
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

  // ── Gaming — Greenhouse ───────────────────────────────────────────────────
  { name: '2K Games',              url: '2k',                              feed_type: 'greenhouse' },
  { name: 'Avalanche Studios',     url: 'avalanchestudios',                feed_type: 'greenhouse' },
  { name: 'Bungie',                url: 'bungie',                          feed_type: 'greenhouse' },
  { name: 'CD Projekt Red',        url: 'cdprojektred',                    feed_type: 'greenhouse' },
  { name: 'Devolver Digital',      url: 'devolverdigital',                 feed_type: 'greenhouse' },
  { name: 'Digital Extremes',      url: 'digitalextremes',                 feed_type: 'greenhouse' },
  { name: 'Epic Games',            url: 'epicgames',                       feed_type: 'greenhouse' },
  { name: 'Frontier Developments', url: 'frontierdevelopments',            feed_type: 'greenhouse' },
  { name: 'Hi-Rez Studios',        url: 'hirezstudios',                    feed_type: 'greenhouse' },
  { name: 'Insomniac Games',       url: 'insomniac',                       feed_type: 'greenhouse' },
  { name: 'IO Interactive',        url: 'iointeractive',                   feed_type: 'greenhouse' },
  { name: 'Iron Galaxy',           url: 'irongalaxy',                      feed_type: 'greenhouse' },
  { name: 'Jagex',                 url: 'jagex',                           feed_type: 'greenhouse' },
  { name: 'Naughty Dog',           url: 'naughtydog',                      feed_type: 'greenhouse' },
  { name: 'Paradox Interactive',   url: 'paradoxinteractive',              feed_type: 'greenhouse' },
  { name: 'PlayStation / Sony IE', url: 'sonyinteractiveentertainmentglobal', feed_type: 'greenhouse' },
  { name: 'Riot Games',            url: 'riotgames',                       feed_type: 'greenhouse' },
  { name: 'Rockstar Games',        url: 'rockstargames',                   feed_type: 'greenhouse' },
  { name: 'Take-Two Interactive',  url: 'taketwo',                         feed_type: 'greenhouse' },
  { name: 'Team17',                url: 'team17',                          feed_type: 'greenhouse' },
  { name: 'Turtle Rock Studios',   url: 'turtlerock',                      feed_type: 'greenhouse' },
  { name: 'Wargaming',             url: 'wargaming',                       feed_type: 'greenhouse' },
  { name: 'Wizards of the Coast',  url: 'wizardsofthecoast',               feed_type: 'greenhouse' },

  // ── Tech — Greenhouse (verified tokens) ──────────────────────────────────
  { name: 'Anthropic',             url: 'anthropic',          feed_type: 'greenhouse' },
  { name: 'GitLab',                url: 'gitlab',             feed_type: 'greenhouse' },
  { name: 'Reddit',                url: 'reddit',             feed_type: 'greenhouse' },

  // ── Texas Fortune 500 — JSearch (Workday / proprietary ATS) ──────────────
  { name: 'American Airlines',     url: 'American Airlines',                 feed_type: 'search' },
  { name: 'AT&T',                  url: 'AT&T software engineer jobs',       feed_type: 'search' },
  { name: 'Bank of America',       url: 'Bank of America',                   feed_type: 'search' },
  { name: 'Dell Technologies',     url: 'Dell Technologies',                 feed_type: 'search' },
  { name: 'ExxonMobil',            url: 'ExxonMobil Houston Texas',          feed_type: 'search' },
  { name: 'Southwest Airlines',    url: 'Southwest Airlines Dallas',         feed_type: 'search' },
  { name: 'Texas Instruments',     url: 'Texas Instruments Dallas',          feed_type: 'search' },
  { name: 'Toyota',                url: 'Toyota Motor',                      feed_type: 'search' },
  { name: 'USAA',                  url: 'USAA San Antonio Texas',            feed_type: 'search' },

  // ── Defense / Aerospace Texas — JSearch ──────────────────────────────────
  { name: 'Boeing',                url: 'Boeing engineer Texas',             feed_type: 'search' },
  { name: 'L3Harris',              url: 'L3Harris engineer Texas',           feed_type: 'search' },
  { name: 'Lockheed Martin',       url: 'Lockheed Martin Fort Worth Texas',  feed_type: 'search' },
  { name: 'Raytheon',              url: 'Raytheon Texas',                    feed_type: 'search' },

  // ── Cybersecurity (Texas presence) — JSearch ─────────────────────────────
  { name: 'CrowdStrike',           url: 'CrowdStrike Austin Texas',          feed_type: 'search' },
  { name: 'Forcepoint',            url: 'Forcepoint Austin Texas',           feed_type: 'search' },
  { name: 'Palo Alto Networks',    url: 'Palo Alto Networks cybersecurity',  feed_type: 'search' },
  { name: 'SentinelOne',           url: 'SentinelOne cybersecurity',         feed_type: 'search' },
  { name: 'Trellix',               url: 'Trellix Plano Texas cybersecurity', feed_type: 'search' },

  // ── Gaming Publishers — JSearch (Workday / proprietary ATS) ──────────────
  { name: 'Activision Blizzard',   url: 'Activision Blizzard',               feed_type: 'search' },
  { name: 'Bandai Namco',          url: 'Bandai Namco game developer',        feed_type: 'search' },
  { name: 'Capcom',                url: 'Capcom game developer',              feed_type: 'search' },
  { name: 'Electronic Arts (EA)',  url: 'Electronic Arts',                    feed_type: 'search' },
  { name: 'Gearbox Software',      url: 'Gearbox Software Frisco Texas',      feed_type: 'search' },
  { name: 'Nintendo',              url: 'Nintendo developer',                 feed_type: 'search' },
  { name: 'Sega',                  url: 'Sega game developer',                feed_type: 'search' },
  { name: 'Square Enix',           url: 'Square Enix game developer',         feed_type: 'search' },
  { name: 'Ubisoft',               url: 'Ubisoft',                            feed_type: 'search' },
  { name: 'Warner Bros Games',     url: 'Warner Bros Games developer',        feed_type: 'search' },
  { name: 'Xbox Game Studios',     url: 'Xbox Game Studios developer',        feed_type: 'search' },
];

// ─── SQL schema ───────────────────────────────────────────────────────────────

export const INIT_SQL = `
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
