import type { FeedType, SavedStatus } from './types';

// ─── Shared style constants ───────────────────────────────────────────────────

export const inp: React.CSSProperties = { fontSize: 12, padding: '4px 6px' };

export const thStyle: React.CSSProperties = {
  padding: '4px 6px', fontWeight: 500, fontSize: 11,
  textAlign: 'left', borderBottom: '1px solid var(--border)',
};

export const tdStyle: React.CSSProperties = { padding: '5px 6px', verticalAlign: 'middle' };

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
export const SEED_VERSION = 5;

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
  { name: 'Crystal Dynamics',      url: 'crystaldynamics',                 feed_type: 'greenhouse' },
  { name: 'Krafton',               url: 'krafton',                         feed_type: 'greenhouse' },
  { name: 'PUBG Corporation',      url: 'pubgcorporation',                 feed_type: 'greenhouse' },
  { name: 'Roblox',                url: 'roblox',                          feed_type: 'greenhouse' },

  // ── Gaming — Lever ──────────────────────────────────────────
  { name: 'Larian Studios',        url: 'larian',             feed_type: 'lever' },

  // ── Tech — Greenhouse (verified tokens) ──────────────────────────────────
  { name: 'Affirm',                url: 'affirm',             feed_type: 'greenhouse' },
  { name: 'Airtable',              url: 'airtable',           feed_type: 'greenhouse' },
  { name: 'Airbnb',                url: 'airbnb',             feed_type: 'greenhouse' },
  { name: 'Amplitude',             url: 'amplitude',          feed_type: 'greenhouse' },
  { name: 'Anthropic',             url: 'anthropic',          feed_type: 'greenhouse' },
  { name: 'Asana',                 url: 'asana',              feed_type: 'greenhouse' },
  { name: 'Brex',                  url: 'brex',               feed_type: 'greenhouse' },
  { name: 'Chime',                 url: 'chime',              feed_type: 'greenhouse' },
  { name: 'Cloudflare',            url: 'cloudflare',         feed_type: 'greenhouse' },
  { name: 'Databricks',            url: 'databricks',         feed_type: 'greenhouse' },
  { name: 'Datadog',               url: 'datadog',            feed_type: 'greenhouse' },
  { name: 'DeepMind',              url: 'deepmind',           feed_type: 'greenhouse' },
  { name: 'Discord',               url: 'discord',            feed_type: 'greenhouse' },
  { name: 'Dropbox',               url: 'dropbox',            feed_type: 'greenhouse' },
  { name: 'Elastic',               url: 'elastic',            feed_type: 'greenhouse' },
  { name: 'Fastly',                url: 'fastly',             feed_type: 'greenhouse' },
  { name: 'Figma',                 url: 'figma',              feed_type: 'greenhouse' },
  { name: 'GitLab',                url: 'gitlab',             feed_type: 'greenhouse' },
  { name: 'HubSpot',               url: 'hubspot',            feed_type: 'greenhouse' },
  { name: 'Inflection AI',         url: 'inflectionai',       feed_type: 'greenhouse' },
  { name: 'Instacart',             url: 'instacart',          feed_type: 'greenhouse' },
  { name: 'Lyft',                  url: 'lyft',               feed_type: 'greenhouse' },
  { name: 'Mixpanel',              url: 'mixpanel',           feed_type: 'greenhouse' },
  { name: 'MongoDB',               url: 'mongodb',            feed_type: 'greenhouse' },
  { name: 'Netlify',               url: 'netlify',            feed_type: 'greenhouse' },
  { name: 'Nubank',                url: 'nubank',             feed_type: 'greenhouse' },
  { name: 'Okta',                  url: 'okta',               feed_type: 'greenhouse' },
  { name: 'PagerDuty',             url: 'pagerduty',          feed_type: 'greenhouse' },
  { name: 'Reddit',                url: 'reddit',             feed_type: 'greenhouse' },
  { name: 'Robinhood',             url: 'robinhood',          feed_type: 'greenhouse' },
  { name: 'Rubrik',                url: 'rubrik',             feed_type: 'greenhouse' },
  { name: 'Scale AI',              url: 'scaleai',            feed_type: 'greenhouse' },
  { name: 'Stripe',                url: 'stripe',             feed_type: 'greenhouse' },
  { name: 'Twilio',                url: 'twilio',             feed_type: 'greenhouse' },
  { name: 'Twitch',                url: 'twitch',             feed_type: 'greenhouse' },
  { name: 'Vercel',                url: 'vercel',             feed_type: 'greenhouse' },
  { name: 'Waymo',                 url: 'waymo',              feed_type: 'greenhouse' },
  { name: 'xAI',                   url: 'xai',                feed_type: 'greenhouse' },

  // ── Defense / Advanced Tech — Greenhouse ─────────────────────────────────
  { name: 'Anduril Industries',    url: 'andurilindustries',  feed_type: 'greenhouse' },
  { name: 'Relativity Space',      url: 'relativity',         feed_type: 'greenhouse' },

  // ── Tech — Lever (additional) ─────────────────────────────────────────────
  { name: 'Plaid',                 url: 'plaid',              feed_type: 'lever' },
  { name: 'Spotify',               url: 'spotify',            feed_type: 'lever' },

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

  // ── Fortune 500 Tech — JSearch (Workday / proprietary ATS) ──────────────
  { name: 'Amazon',                url: 'Amazon software engineer',           feed_type: 'search' },
  { name: 'AMD',                   url: 'AMD Advanced Micro Devices engineer', feed_type: 'search' },
  { name: 'Apple',                 url: 'Apple software engineer',            feed_type: 'search' },
  { name: 'Cisco',                 url: 'Cisco Systems software engineer',    feed_type: 'search' },
  { name: 'Coinbase',              url: 'Coinbase software engineer',         feed_type: 'search' },
  { name: 'DoorDash',              url: 'DoorDash software engineer',         feed_type: 'search' },
  { name: 'Google',                url: 'Google software engineer',           feed_type: 'search' },
  { name: 'IBM',                   url: 'IBM software engineer',              feed_type: 'search' },
  { name: 'Intel',                 url: 'Intel Corporation software engineer', feed_type: 'search' },
  { name: 'Meta',                  url: 'Meta software engineer',             feed_type: 'search' },
  { name: 'Microsoft',             url: 'Microsoft software engineer',        feed_type: 'search' },
  { name: 'Nvidia',                url: 'Nvidia software engineer',           feed_type: 'search' },
  { name: 'Oracle',                url: 'Oracle software engineer',           feed_type: 'search' },
  { name: 'Qualcomm',              url: 'Qualcomm software engineer',         feed_type: 'search' },
  { name: 'Salesforce',            url: 'Salesforce software engineer',       feed_type: 'search' },
  { name: 'Snowflake',             url: 'Snowflake software engineer',        feed_type: 'search' },
  { name: 'Uber',                  url: 'Uber software engineer',             feed_type: 'search' },
  { name: 'Zoom',                  url: 'Zoom Video Communications engineer', feed_type: 'search' },

  // ── Fortune 500 Finance — JSearch ─────────────────────────────────────────
  { name: 'American Express',      url: 'American Express software engineer', feed_type: 'search' },
  { name: 'Capital One',           url: 'Capital One software engineer',      feed_type: 'search' },
  { name: 'Citigroup',             url: 'Citigroup software engineer',        feed_type: 'search' },
  { name: 'Goldman Sachs',         url: 'Goldman Sachs software engineer',    feed_type: 'search' },
  { name: 'JPMorgan Chase',        url: 'JPMorgan Chase software engineer',   feed_type: 'search' },
  { name: 'Morgan Stanley',        url: 'Morgan Stanley software engineer',   feed_type: 'search' },
  { name: 'Wells Fargo',           url: 'Wells Fargo software engineer',      feed_type: 'search' },

  // ── US Gaming Studios — JSearch (Workday / proprietary ATS) ─────────────
  { name: 'Bethesda Game Studios', url: 'Bethesda Game Studios developer',    feed_type: 'search' },
  { name: 'BioWare',               url: 'BioWare game developer',             feed_type: 'search' },
  { name: 'id Software',           url: 'id Software game developer',         feed_type: 'search' },
  { name: 'NetherRealm Studios',   url: 'NetherRealm Studios developer',      feed_type: 'search' },
  { name: 'Obsidian Entertainment',url: 'Obsidian Entertainment developer',   feed_type: 'search' },
  { name: 'Raven Software',        url: 'Raven Software game developer',      feed_type: 'search' },
  { name: 'Respawn Entertainment', url: 'Respawn Entertainment developer',    feed_type: 'search' },
  { name: 'Santa Monica Studio',   url: 'Santa Monica Studio Sony developer', feed_type: 'search' },
  { name: 'Treyarch',              url: 'Treyarch game developer',            feed_type: 'search' },
  { name: 'Valve',                 url: 'Valve Corporation developer',        feed_type: 'search' },

  // ── International Gaming Studios — JSearch ────────────────────────────────
  { name: '11 bit studios',        url: '11 bit studios game developer',      feed_type: 'search' },
  { name: 'Behaviour Interactive', url: 'Behaviour Interactive game developer',feed_type: 'search' },
  { name: 'Bloober Team',          url: 'Bloober Team game developer',        feed_type: 'search' },
  { name: 'Bohemia Interactive',   url: 'Bohemia Interactive developer',      feed_type: 'search' },
  { name: 'Creative Assembly',     url: 'Creative Assembly game developer',   feed_type: 'search' },
  { name: 'Crytek',                url: 'Crytek game developer',              feed_type: 'search' },
  { name: 'Eidos Montreal',        url: 'Eidos Montreal game developer',      feed_type: 'search' },
  { name: 'HoYoverse',             url: 'HoYoverse miHoYo game developer',   feed_type: 'search' },
  { name: 'Klei Entertainment',    url: 'Klei Entertainment game developer',  feed_type: 'search' },
  { name: 'Nexon America',         url: 'Nexon America game developer',       feed_type: 'search' },
  { name: 'Pearl Abyss',           url: 'Pearl Abyss game developer',         feed_type: 'search' },
  { name: 'Relic Entertainment',   url: 'Relic Entertainment game developer', feed_type: 'search' },
  { name: 'Remedy Entertainment',  url: 'Remedy Entertainment developer',     feed_type: 'search' },
  { name: 'Techland',              url: 'Techland game developer',            feed_type: 'search' },
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
