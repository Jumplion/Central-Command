import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterState {
  jobTitles: string[];
  keywords: string[];
  locations: string[];
  companySizes: string[];
  empTypes: string[];
  experienceLevel: string;
  datePosted: string;
  remoteOnly: boolean;
}

interface ResumeKeyword {
  term: string;
  weight: number;
}

interface FilterProfile {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: number;
  resumeKeywords?: ResumeKeyword[];
}

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
  LinkedIn:     '#0a66c2',
  Indeed:       '#003a9b',
  Glassdoor:    '#0caa41',
  ZipRecruiter: '#59bd66',
  'Google Jobs':'#4285f4',
  Monster:      '#6e2d8e',
  Arbeitnow:    '#6ea8ff',
};

const EMP_TYPES = ['fulltime', 'parttime', 'contractor', 'intern'] as const;
type EmpType = (typeof EMP_TYPES)[number];
const EMP_TYPE_LABELS: Record<EmpType, string> = {
  fulltime: 'Full-time', parttime: 'Part-time', contractor: 'Contract', intern: 'Internship',
};

const COMPANY_SIZE_OPTIONS = [
  { value: 'startup',    label: 'Startup',    query: 'startup' },
  { value: 'small',      label: 'Small',      query: 'small company' },
  { value: 'midsize',    label: 'Mid-size',   query: 'mid-size company' },
  { value: 'large',      label: 'Large',      query: 'large company' },
  { value: 'enterprise', label: 'Enterprise', query: 'enterprise' },
];

const EXP_LEVEL_OPTIONS = [
  { value: '',                             label: 'Any' },
  { value: 'no_experience',               label: 'Entry' },
  { value: 'under_3_years_experience',    label: 'Mid' },
  { value: 'more_than_3_years_experience', label: 'Senior' },
];

const DATE_POSTED_OPTIONS = [
  { value: '',      label: 'Any Time' },
  { value: 'today', label: 'Today' },
  { value: '3days', label: '3 Days' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const PROFILES_KV_KEY = 'filterProfiles';
const PROFILES_SEEDED_KEY = 'profilesSeeded_v1';

// ─── Default Resume Profiles ──────────────────────────────────────────────────

const DEFAULT_PROFILES: FilterProfile[] = [
  {
    id: 'default-software-dev',
    name: 'Software Developer',
    filters: {
      jobTitles: [],
      keywords: ['Software Engineer', 'C# Developer', '.NET Developer', 'Full Stack Developer'],
      locations: [],
      companySizes: [],
      empTypes: ['fulltime'],
      experienceLevel: '',
      datePosted: '',
      remoteOnly: false,
    },
    createdAt: 0,
    resumeKeywords: [
      { term: 'software engineer',  weight: 10 },
      { term: 'software developer', weight: 10 },
      { term: 'full stack',         weight: 9  },
      { term: 'full-stack',         weight: 9  },
      { term: 'C#',                 weight: 10 },
      { term: '.NET',               weight: 10 },
      { term: 'ASP.NET',            weight: 8  },
      { term: 'backend',            weight: 7  },
      { term: 'back-end',           weight: 7  },
      { term: 'Azure',              weight: 8  },
      { term: 'AWS',                weight: 7  },
      { term: 'REST API',           weight: 7  },
      { term: 'RESTful',            weight: 7  },
      { term: 'JavaScript',         weight: 6  },
      { term: 'TypeScript',         weight: 5  },
      { term: 'Python',             weight: 5  },
      { term: 'SQL',                weight: 6  },
      { term: 'MVC',                weight: 6  },
      { term: 'microservices',      weight: 6  },
      { term: 'CI/CD',              weight: 5  },
      { term: 'Git',                weight: 4  },
      { term: 'Agile',              weight: 5  },
      { term: 'Scrum',              weight: 4  },
      { term: 'unit testing',       weight: 5  },
      { term: 'TDD',                weight: 5  },
      { term: 'senior',             weight: 6  },
      { term: 'enterprise',         weight: 5  },
      { term: 'DevOps',             weight: 5  },
      { term: 'Node.js',            weight: 4  },
    ],
  },
  {
    id: 'default-game-design',
    name: 'Game Designer',
    filters: {
      jobTitles: [],
      keywords: ['Game Designer', 'Game Developer', 'Unreal Engine'],
      locations: [],
      companySizes: [],
      empTypes: ['fulltime'],
      experienceLevel: '',
      datePosted: '',
      remoteOnly: false,
    },
    createdAt: 0,
    resumeKeywords: [
      { term: 'game designer',    weight: 10 },
      { term: 'game developer',   weight: 10 },
      { term: 'game design',      weight: 10 },
      { term: 'gameplay',         weight: 8  },
      { term: 'Unreal Engine',    weight: 10 },
      { term: 'Unreal',           weight: 8  },
      { term: 'Unity',            weight: 9  },
      { term: 'game engine',      weight: 7  },
      { term: 'AAA',              weight: 8  },
      { term: 'Blueprints',       weight: 8  },
      { term: 'C++',              weight: 8  },
      { term: 'Lua',              weight: 7  },
      { term: 'combat design',    weight: 9  },
      { term: 'level design',     weight: 9  },
      { term: 'encounter design', weight: 9  },
      { term: 'set piece',        weight: 8  },
      { term: 'systems design',   weight: 8  },
      { term: 'prototyping',      weight: 7  },
      { term: 'accessibility',    weight: 7  },
      { term: 'scripting',        weight: 6  },
      { term: 'Perforce',         weight: 5  },
      { term: 'RPG',              weight: 6  },
      { term: 'player experience',weight: 6  },
      { term: 'game studio',      weight: 6  },
      { term: 'console',          weight: 5  },
    ],
  },
  {
    id: 'default-cybersecurity',
    name: 'Cybersecurity',
    filters: {
      jobTitles: [],
      keywords: ['Cybersecurity', 'Security Engineer', 'Application Security'],
      locations: [],
      companySizes: [],
      empTypes: ['fulltime'],
      experienceLevel: '',
      datePosted: '',
      remoteOnly: false,
    },
    createdAt: 0,
    resumeKeywords: [
      { term: 'cybersecurity',        weight: 10 },
      { term: 'security engineer',    weight: 10 },
      { term: 'application security', weight: 10 },
      { term: 'AppSec',               weight: 9  },
      { term: 'security analyst',     weight: 9  },
      { term: 'information security', weight: 9  },
      { term: 'SOC',                  weight: 8  },
      { term: 'CompTIA',              weight: 7  },
      { term: 'Security+',            weight: 8  },
      { term: 'SIEM',                 weight: 9  },
      { term: 'Splunk',               weight: 8  },
      { term: 'Sentinel',             weight: 7  },
      { term: 'Wireshark',            weight: 7  },
      { term: 'Nmap',                 weight: 6  },
      { term: 'IAM',                  weight: 8  },
      { term: 'OAuth',                weight: 7  },
      { term: 'JWT',                  weight: 7  },
      { term: 'NIST',                 weight: 7  },
      { term: 'vulnerability',        weight: 8  },
      { term: 'penetration testing',  weight: 8  },
      { term: 'pen test',             weight: 8  },
      { term: 'secure coding',        weight: 9  },
      { term: 'threat detection',     weight: 8  },
      { term: 'incident response',    weight: 8  },
      { term: 'cloud security',       weight: 8  },
      { term: 'authentication',       weight: 6  },
      { term: 'cryptography',         weight: 7  },
      { term: 'Azure',                weight: 5  },
      { term: 'AWS',                  weight: 5  },
      { term: 'PowerShell',           weight: 6  },
      { term: 'Python',               weight: 5  },
      { term: 'C#',                   weight: 4  },
    ],
  },
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
`;

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFilters(f: FilterState): string[] {
  const errors: string[] = [];
  if (f.jobTitles.length === 0 && f.keywords.length === 0) {
    errors.push('Enter at least one job title or keyword.');
  }
  const shortTags = [...f.jobTitles, ...f.keywords].filter((t) => t.trim().length < 2);
  if (shortTags.length) {
    errors.push(`Tags must be ≥2 characters: ${shortTags.map((t) => `"${t}"`).join(', ')}`);
  }
  const badLoc = f.locations.filter((l) => l.trim().length < 2 || l.trim().length > 100);
  if (badLoc.length) {
    errors.push(`Locations must be 2–100 characters: ${badLoc.map((l) => `"${l}"`).join(', ')}`);
  }
  return errors;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildJSearchQuery(f: FilterState): string {
  const parts = [...f.jobTitles, ...f.keywords];
  if (f.companySizes.length) {
    const sizeTerms = f.companySizes
      .map((s) => COMPANY_SIZE_OPTIONS.find((o) => o.value === s)?.query ?? s)
      .join(' OR ');
    parts.push(sizeTerms);
  }
  let q = parts.join(' ');
  if (f.locations.length) q += ` in ${f.locations.join(' OR ')}`;
  return q;
}

function normalizeLoadedProfiles(raw: unknown): FilterProfile[] {
  if (!Array.isArray(raw)) return [];
  const result: FilterProfile[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;
    const f = (p.filters ?? {}) as Record<string, unknown>;
    result.push({
      id: String(p.id ?? Date.now()),
      name: String(p.name ?? 'Unnamed'),
      createdAt: Number(p.createdAt ?? Date.now()),
      filters: {
        jobTitles:       Array.isArray(f.jobTitles)  ? (f.jobTitles as string[])  : [],
        keywords:        Array.isArray(f.keywords)   ? (f.keywords as string[])   : [],
        locations:       Array.isArray(f.locations)  ? (f.locations as string[])  : [],
        companySizes:    Array.isArray(f.companySizes) ? (f.companySizes as string[]) : [],
        empTypes:        Array.isArray(f.empTypes)   ? (f.empTypes as string[])   : [],
        experienceLevel: typeof f.experienceLevel === 'string' ? f.experienceLevel : '',
        datePosted:      typeof f.datePosted === 'string'      ? f.datePosted      : '',
        remoteOnly:      Boolean(f.remoteOnly),
      },
    });
  }
  return result;
}

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

function scoreJob(job: JobListing, keywords: ResumeKeyword[]): number {
  const titleText = job.title.toLowerCase();
  const bodyText = job.description.toLowerCase();
  let score = 0;
  for (const { term, weight } of keywords) {
    const t = term.toLowerCase();
    if (titleText.includes(t)) score += weight * 2;
    else if (bodyText.includes(t)) score += weight;
  }
  // Normalize: "ideal" = top-8 weighted terms all matching in the title
  const ideal = [...keywords]
    .map((k) => k.weight)
    .sort((a, b) => b - a)
    .slice(0, 8)
    .reduce((s, w) => s + w * 2, 0);
  return ideal > 0 ? Math.min(100, Math.round((score / ideal) * 100)) : 0;
}

// ─── API adapters ─────────────────────────────────────────────────────────────

async function searchJSearch(
  fetch: NetFetcher,
  key: string,
  filters: FilterState
): Promise<JobListing[]> {
  const query = buildJSearchQuery(filters);
  if (!query.trim()) throw new Error('Search query is empty.');

  const p = new URLSearchParams({ query, num_pages: '1', page: '1' });
  if (filters.remoteOnly) p.set('remote_jobs_only', 'true');
  if (filters.empTypes.length) p.set('employment_types', filters.empTypes.map((t) => t.toUpperCase()).join(','));
  if (filters.experienceLevel) p.set('job_requirements', filters.experienceLevel);
  if (filters.datePosted) p.set('date_posted', filters.datePosted);

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
  filters: FilterState
): Promise<JobListing[]> {
  const p = new URLSearchParams({ search: [...filters.jobTitles, ...filters.keywords].join(' ') });
  if (filters.remoteOnly) p.set('remote', 'true');

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

// ─── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({
  values, onChange, placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    const unique = parts.filter((p) => !values.includes(p));
    if (unique.length) onChange([...values, ...unique]);
    setDraft('');
  };

  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); commit(draft); }
    else if (e.key === ',' && draft.trim()) { e.preventDefault(); commit(draft.replace(/,$/, '')); }
    else if (e.key === 'Backspace' && !draft && values.length > 0) remove(values.length - 1);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',') || text.includes('\n')) {
      e.preventDefault();
      commit(text.replace(/\n/g, ','));
    }
  };

  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4,
        minHeight: 30, cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1px 6px', borderRadius: 3, fontSize: 11,
            background: 'var(--accent)22', color: 'var(--accent)',
            border: '1px solid var(--accent)44',
          }}
        >
          {v}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(i); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, color: 'inherit', fontSize: 10, lineHeight: 1, opacity: 0.7,
            }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (draft.trim()) commit(draft); }}
        onPaste={onPaste}
        placeholder={values.length === 0 ? placeholder : '+ add more'}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          fontSize: 12, padding: '1px 2px', flex: 1, minWidth: 80,
          color: 'var(--text)',
        }}
      />
    </div>
  );
}

// ─── FilterSection ────────────────────────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-dim)',
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── ChipGroup ────────────────────────────────────────────────────────────────

function ChipGroup({
  options, selected, onChange, multiSelect = false,
}: {
  options: { value: string; label: string }[];
  selected: string | string[];
  onChange: (v: string | string[]) => void;
  multiSelect?: boolean;
}) {
  const isActive = (val: string) =>
    multiSelect
      ? (selected as string[]).includes(val)
      : selected === val;

  const handleClick = (val: string) => {
    if (!multiSelect) {
      onChange(val);
      return;
    }
    const arr = selected as string[];
    if (val === '') { onChange([]); return; }
    onChange(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const noneActive = multiSelect
    ? (selected as string[]).length === 0
    : selected === '';

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(({ value, label }) => {
        const active = value === '' || value === '__all__'
          ? noneActive
          : isActive(value);
        return (
          <button
            key={value}
            onClick={() => handleClick(value)}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
              background: active ? 'var(--accent)22' : 'transparent',
              border: active ? '1px solid var(--accent)55' : '1px solid var(--border)',
              color: active ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── FilterSummaryBar ─────────────────────────────────────────────────────────

function FilterSummaryBar({ filters }: { filters: FilterState }) {
  const chips: { label: string; color: string }[] = [
    ...filters.jobTitles.map((j) => ({ label: j,       color: '#6ea8ff' })),
    ...filters.keywords.map((k)   => ({ label: k,       color: '#67e8f9' })),
    ...filters.locations.map((l)  => ({ label: `📍 ${l}`, color: '#f59e0b' })),
    ...filters.companySizes.map((s) => ({
      label: COMPANY_SIZE_OPTIONS.find((o) => o.value === s)?.label ?? s,
      color: '#fb923c',
    })),
    ...filters.empTypes.map((t) => ({
      label: EMP_TYPE_LABELS[t as EmpType] ?? t,
      color: '#a78bfa',
    })),
    ...(filters.experienceLevel ? [{
      label: EXP_LEVEL_OPTIONS.find((o) => o.value === filters.experienceLevel)?.label ?? filters.experienceLevel,
      color: '#4ade80',
    }] : []),
    ...(filters.datePosted ? [{
      label: DATE_POSTED_OPTIONS.find((o) => o.value === filters.datePosted)?.label ?? filters.datePosted,
      color: '#f472b6',
    }] : []),
    ...(filters.remoteOnly ? [{ label: 'Remote only', color: '#34d399' }] : []),
  ];

  if (chips.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center',
      padding: '4px 8px', borderRadius: 4,
      background: 'var(--panel-2)', border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', marginRight: 2 }}>
        Active:
      </span>
      {chips.map((c, i) => (
        <span
          key={i}
          style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 3,
            background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}44`,
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── FilterProfilesPanel ──────────────────────────────────────────────────────

function profileTooltip(p: FilterProfile): string {
  const parts: string[] = [];
  if (p.filters.jobTitles.length)   parts.push(`Titles: ${p.filters.jobTitles.join(', ')}`);
  if (p.filters.keywords.length)    parts.push(`Keywords: ${p.filters.keywords.join(', ')}`);
  if (p.filters.locations.length)   parts.push(`Locations: ${p.filters.locations.join(', ')}`);
  if (p.filters.companySizes.length)
    parts.push(`Company: ${p.filters.companySizes.map((s) => COMPANY_SIZE_OPTIONS.find((o) => o.value === s)?.label ?? s).join(', ')}`);
  if (p.filters.empTypes.length)
    parts.push(`Types: ${p.filters.empTypes.map((t) => EMP_TYPE_LABELS[t as EmpType] ?? t).join(', ')}`);
  if (p.filters.experienceLevel)
    parts.push(EXP_LEVEL_OPTIONS.find((o) => o.value === p.filters.experienceLevel)?.label ?? '');
  if (p.filters.remoteOnly) parts.push('Remote only');
  return parts.join(' · ') || 'Empty profile';
}

function FilterProfilesPanel({
  profiles, onApply, onSave, onDelete,
}: {
  profiles: FilterProfile[];
  onApply: (p: FilterProfile) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');

  const handleSave = () => {
    const name = newName.trim();
    if (!name) { setNameError('Name required'); return; }
    if (name.length > 50) { setNameError('Max 50 chars'); return; }
    if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setNameError('Name already exists');
      return;
    }
    onSave(name);
    setNewName('');
    setShowSave(false);
    setNameError('');
  };

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
      padding: '4px 8px', borderRadius: 4,
      background: 'var(--panel-2)', border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Profiles:</span>

      {profiles.length === 0 && !showSave && (
        <span style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.5 }}>None saved</span>
      )}

      {profiles.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'stretch' }}>
          <button
            onClick={() => onApply(p)}
            title={profileTooltip(p)}
            style={{
              fontSize: 11, padding: '1px 8px', cursor: 'pointer',
              borderRadius: '3px 0 0 3px',
              background: 'var(--accent)11', border: '1px solid var(--accent)33',
              color: 'var(--accent)',
            }}
          >
            {p.name}
          </button>
          <button
            onClick={() => onDelete(p.id)}
            title="Delete profile"
            style={{
              fontSize: 10, padding: '1px 5px', cursor: 'pointer',
              borderRadius: '0 3px 3px 0', borderLeft: 'none',
              background: '#ff6e6e11', border: '1px solid #ff6e6e33', color: '#ff6e6e',
            }}
          >
            ✕
          </button>
        </div>
      ))}

      {showSave ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
          <input
            autoFocus
            style={{ fontSize: 11, padding: '2px 6px', width: 120 }}
            placeholder="Profile name"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setNameError(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setShowSave(false); setNameError(''); setNewName(''); }
            }}
          />
          <button className="primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={handleSave}>
            Save
          </button>
          <button
            className="ghost"
            style={{ fontSize: 11, padding: '2px 6px' }}
            onClick={() => { setShowSave(false); setNameError(''); setNewName(''); }}
          >
            ✕
          </button>
          {nameError && <span style={{ fontSize: 11, color: '#ff6e6e' }}>{nameError}</span>}
        </div>
      ) : (
        <button
          className="ghost"
          style={{ fontSize: 11, padding: '1px 8px', marginLeft: 'auto' }}
          onClick={() => setShowSave(true)}
        >
          + Save current
        </button>
      )}
    </div>
  );
}

// ─── SourceBadge / JobCard ────────────────────────────────────────────────────

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

function JobCard({
  job, isSaved, onSave, onApply, onIgnore, matchScore,
}: {
  job: JobListing;
  isSaved: boolean;
  onSave: () => void;
  onApply: () => void;
  onIgnore: () => void;
  matchScore?: number;
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const isRecommended = typeof matchScore === 'number' && matchScore >= 60;
  const isGoodMatch   = typeof matchScore === 'number' && matchScore >= 35 && matchScore < 60;
  return (
    <div style={{
      border: isRecommended ? '1px solid #f59e0b66' : '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 10px', marginBottom: 6,
      background: isRecommended ? '#f59e0b08' : 'var(--panel-2)',
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
            {isRecommended && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700,
                background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b55',
              }}>
                ★ Recommended
              </span>
            )}
            {isGoodMatch && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 3,
                background: '#34d39922', color: '#34d399', border: '1px solid #34d39944',
              }}>
                Good Match
              </span>
            )}
            {salary && <span style={{ fontSize: 11, color: '#34d399' }}>{salary}</span>}
            {job.datePosted && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {relativeDate(job.datePosted)}
              </span>
            )}
          </div>
          {job.description && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
              {job.description.length > 160 ? `${job.description.slice(0, 160)}…` : job.description}
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
          <button
            className="ghost"
            style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-dim)', opacity: 0.6 }}
            onClick={onIgnore}
            title="Hide this job and never show it again"
          >
            Ignore
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

const EMPTY_FILTERS: FilterState = {
  jobTitles: [], keywords: [], locations: [], companySizes: [],
  empTypes: [], experienceLevel: '', datePosted: '', remoteOnly: false,
};

function JobAggregator({ api, settings }: WidgetProps) {
  const [tab, setTab] = useState<'search' | 'saved'>('search');
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...EMPTY_FILTERS,
    jobTitles:  settings.defaultKeywords ? [(settings.defaultKeywords as string).trim()] : [],
    locations:  settings.defaultLocation ? [(settings.defaultLocation as string).trim()] : [],
    remoteOnly: Boolean(settings.remoteOnly),
  }));
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<FilterProfile | null>(null);
  const [resultsProfile, setResultsProfile] = useState<FilterProfile | null>(null);
  const [results, setResults] = useState<JobListing[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [savedFilter, setSavedFilter] = useState<SavedStatus | 'All'>('All');
  const [ready, setReady] = useState(false);

  const apiKey = (settings.rapidApiKey as string) || '';

  const loadSaved = useCallback(async () => {
    const rows = await api.sql.all<SavedJob>('SELECT * FROM saved_jobs ORDER BY saved_at DESC');
    setSavedJobs(rows);
    setSavedIds(new Set(rows.map((r) => r.job_id)));
  }, [api]);

  const persistProfiles = useCallback(async (next: FilterProfile[]) => {
    await api.kv.set(PROFILES_KV_KEY, next);
    setProfiles(next);
  }, [api]);

  const patchFilters = (patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setValidationErrors([]);
  };

  useEffect(() => {
    api.sql.exec(INIT_SQL).then(async () => {
      await loadSaved();
      const raw = await api.kv.get<string[]>('dismissedJobIds');
      if (Array.isArray(raw)) setDismissedIds(new Set(raw));
      setReady(true);
    });
    (async () => {
      const raw = await api.kv.get<unknown>(PROFILES_KV_KEY);
      const normalized = normalizeLoadedProfiles(raw);
      if (normalized.length > 0) {
        setProfiles(normalized);
      } else {
        const seeded = await api.kv.get<boolean>(PROFILES_SEEDED_KEY);
        if (!seeded) {
          await api.kv.set(PROFILES_KV_KEY, DEFAULT_PROFILES);
          await api.kv.set(PROFILES_SEEDED_KEY, true);
          setProfiles(DEFAULT_PROFILES);
        }
      }
    })();
  }, []);

  const handleSearch = async () => {
    const errs = validateFilters(filters);
    if (errs.length > 0) { setValidationErrors(errs); return; }
    setValidationErrors([]);
    setSearching(true);
    setSearchError('');
    setResults([]);
    setResultsProfile(activeProfile);
    setActiveFilters({ ...filters });
    try {
      const jobs = apiKey
        ? await searchJSearch(api.net.fetch, apiKey, filters)
        : await searchArbeitnow(api.net.fetch, filters);
      setResults(jobs);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveProfile = async (name: string) => {
    await persistProfiles([...profiles, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      createdAt: Date.now(),
      filters: JSON.parse(JSON.stringify(filters)) as FilterState,
    }]);
  };

  const handleApplyProfile = (p: FilterProfile) => {
    setFilters(JSON.parse(JSON.stringify(p.filters)) as FilterState);
    setActiveProfile(p);
    setValidationErrors([]);
  };

  const handleSaveJob = async (job: JobListing) => {
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

  const handleIgnoreJob = async (jobId: string) => {
    const nextDismissed = [...dismissedIds, jobId];
    await api.kv.set('dismissedJobIds', nextDismissed);
    setDismissedIds(new Set(nextDismissed));
  };

  const TRACKER_WIDGET_ID = 'job-tracker';
  const TRACKER_INIT_SQL = `
    CREATE TABLE IF NOT EXISTS applications (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      company      TEXT    NOT NULL,
      role         TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'Applied',
      applied_at   TEXT    NOT NULL,
      source       TEXT    NOT NULL DEFAULT '',
      link         TEXT    NOT NULL DEFAULT '',
      notes        TEXT    NOT NULL DEFAULT '',
      last_updated INTEGER NOT NULL
    );
  `;

  const handleStatusChange = async (id: number, status: SavedStatus) => {
    if (status === 'Interested') {
      await api.sql.run('UPDATE saved_jobs SET status=? WHERE id=?', [status, id]);
      await loadSaved();
      return;
    }

    const job = savedJobs.find((j) => j.id === id);
    if (!job) return;

    // Ensure tracker table exists, then insert
    await window.cc.sql.exec(TRACKER_WIDGET_ID, TRACKER_INIT_SQL);
    await window.cc.sql.run(
      TRACKER_WIDGET_ID,
      'INSERT OR IGNORE INTO applications (company,role,status,applied_at,source,link,notes,last_updated) VALUES (?,?,?,?,?,?,?,?)',
      [job.company, job.title, status, new Date().toISOString().slice(0, 10), job.source, job.apply_link, job.notes, Date.now()]
    );

    // Remove from aggregator saved list
    await api.sql.run('DELETE FROM saved_jobs WHERE id=?', [id]);

    // Blacklist from future searches
    const nextDismissed = [...dismissedIds, job.job_id];
    await api.kv.set('dismissedJobIds', nextDismissed);
    setDismissedIds(new Set(nextDismissed));

    await loadSaved();
  };

  const handleDelete = async (id: number) => {
    await api.sql.run('DELETE FROM saved_jobs WHERE id=?', [id]);
    await loadSaved();
  };

  const scoredResults = useMemo(() => {
    const visible = results.filter((j) => !dismissedIds.has(j.id));
    const keywords = resultsProfile?.resumeKeywords;
    if (!keywords?.length) return visible.map((j) => ({ job: j, score: -1 }));
    return [...visible]
      .map((j) => ({ job: j, score: scoreJob(j, keywords) }))
      .sort((a, b) => b.score - a.score);
  }, [results, resultsProfile, dismissedIds]);

  const filteredSaved = savedFilter === 'All'
    ? savedJobs
    : savedJobs.filter((j) => j.status === savedFilter);

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
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!apiKey && (
              <div style={{
                fontSize: 11, padding: '5px 8px', borderRadius: 4,
                background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b',
              }}>
                No API key — showing Arbeitnow results (remote/tech). Add a free RapidAPI key in
                widget settings for full LinkedIn, Indeed, ZipRecruiter, and Glassdoor coverage.
              </div>
            )}

            <FilterProfilesPanel
              profiles={profiles}
              onApply={handleApplyProfile}
              onSave={handleSaveProfile}
              onDelete={(id) => void persistProfiles(profiles.filter((p) => p.id !== id))}
            />

            {/* Job Title + Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <FilterSection label="Job Title">
                <TagInput
                  values={filters.jobTitles}
                  onChange={(jobTitles) => patchFilters({ jobTitles })}
                  placeholder="e.g. Software Engineer"
                />
              </FilterSection>

              <FilterSection label="Location">
                <TagInput
                  values={filters.locations}
                  onChange={(locations) => patchFilters({ locations })}
                  placeholder={apiKey ? 'e.g. New York, Dallas' : 'N/A without API key'}
                />
              </FilterSection>
            </div>

            {/* Keywords */}
            <FilterSection label="Keywords">
              <TagInput
                values={filters.keywords}
                onChange={(keywords) => patchFilters({ keywords })}
                placeholder="e.g. React, Python, TypeScript"
              />
            </FilterSection>

            {/* API-key-gated filters */}
            {apiKey && (
              <>
                <FilterSection label="Company Size">
                  <ChipGroup
                    options={[{ value: '', label: 'Any' }, ...COMPANY_SIZE_OPTIONS]}
                    selected={filters.companySizes}
                    onChange={(v) => patchFilters({ companySizes: v as string[] })}
                    multiSelect
                  />
                </FilterSection>

                <FilterSection label="Employment Type">
                  <ChipGroup
                    options={[{ value: '', label: 'All' }, ...EMP_TYPES.map((t) => ({ value: t, label: EMP_TYPE_LABELS[t] }))]}
                    selected={filters.empTypes}
                    onChange={(v) => patchFilters({ empTypes: v as string[] })}
                    multiSelect
                  />
                </FilterSection>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <FilterSection label="Experience Level">
                    <ChipGroup
                      options={EXP_LEVEL_OPTIONS}
                      selected={filters.experienceLevel}
                      onChange={(v) => patchFilters({ experienceLevel: v as string })}
                    />
                  </FilterSection>

                  <FilterSection label="Date Posted">
                    <ChipGroup
                      options={DATE_POSTED_OPTIONS}
                      selected={filters.datePosted}
                      onChange={(v) => patchFilters({ datePosted: v as string })}
                    />
                  </FilterSection>
                </div>
              </>
            )}

            {/* Remote + Search */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{
                fontSize: 12, display: 'flex', gap: 4,
                alignItems: 'center', color: 'var(--text-dim)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={filters.remoteOnly}
                  onChange={(e) => patchFilters({ remoteOnly: e.target.checked })}
                />
                Remote only
              </label>
              {results.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                  {resultsProfile?.resumeKeywords?.length ? ' · ranked by match' : ''}
                </span>
              )}
              <button
                className="primary"
                style={{ fontSize: 12, padding: '4px 16px', marginLeft: 'auto' }}
                onClick={() => void handleSearch()}
                disabled={searching}
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {validationErrors.length > 0 && (
              <div style={{
                fontSize: 11, padding: '5px 8px', borderRadius: 4,
                background: '#ff6e6e22', border: '1px solid #ff6e6e44', color: '#ff6e6e',
              }}>
                {validationErrors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            )}

            {activeFilters && <FilterSummaryBar filters={activeFilters} />}
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
                {filters.jobTitles.length > 0 || filters.keywords.length > 0
                  ? 'No results — try different filters.'
                  : 'Enter a job title or keyword and press Search.'}
              </div>
            )}
            {scoredResults.map(({ job, score }) => (
              <JobCard
                key={job.id}
                job={job}
                matchScore={score >= 0 ? score : undefined}
                isSaved={savedIds.has(job.id)}
                onSave={() => void handleSaveJob(job)}
                onApply={() => job.applyLink && void api.shell.openExternal(job.applyLink)}
                onIgnore={() => void handleIgnoreJob(job.id)}
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
                      <td style={tdStyle}><SourceBadge source={job.source} /></td>
                      <td style={tdStyle}>
                        <select
                          style={{
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
    version: '0.3.0',
    icon: '🔍',
    defaultSize: { w: 8, h: 12 },
    minSize:     { w: 5, h: 8 },
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
        label: 'Default job title',
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
