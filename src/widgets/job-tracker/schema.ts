export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS applications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company      TEXT    NOT NULL,
    role         TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'Applied',
    applied_at   TEXT    NOT NULL,
    source       TEXT    NOT NULL DEFAULT '',
    link         TEXT    NOT NULL DEFAULT '',
    notes        TEXT    NOT NULL DEFAULT '',
    req_number   TEXT    NOT NULL DEFAULT '',
    last_updated INTEGER NOT NULL
  );

  -- Remove any rows that violated schema constraints (e.g. from past seeding bugs
  -- where jt_query_rules data was accidentally inserted into the applications table).
  -- These are identifiable because last_updated is NOT NULL in schema but was NULL,
  -- and status should always be a text value like 'Applied', never an integer.
  DELETE FROM applications WHERE last_updated IS NULL;
  DELETE FROM applications WHERE typeof(status) = 'integer';

  CREATE INDEX IF NOT EXISTS idx_applications_last_updated ON applications(last_updated DESC);
`;

export const DEFAULT_GMAIL_QUERY = [
  'subject:"thank you for applying"',
  'subject:"your application"',
  'subject:"we received your application"',
  'subject:"interview invitation"',
  'subject:"interview request"',
  'subject:"phone screen"',
  'subject:"technical screen"',
  'subject:"next steps"',
  'subject:"offer letter"',
  'subject:"job offer"',
  'subject:"regret to inform"',
  'subject:"not moving forward"',
  'subject:"other candidates"',
  'subject:"moving forward"',
].join(" OR ");

export const EMAIL_INIT_SQL = `
  CREATE TABLE IF NOT EXISTS email_jobs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_id       TEXT    NOT NULL UNIQUE,
    thread_id      TEXT    NOT NULL,
    subject        TEXT    NOT NULL,
    from_address   TEXT    NOT NULL,
    received_at    TEXT    NOT NULL,
    snippet        TEXT    NOT NULL DEFAULT '',
    parsed_company TEXT    NOT NULL DEFAULT '',
    parsed_role    TEXT    NOT NULL DEFAULT '',
    parsed_status     TEXT    NOT NULL DEFAULT '',
    parsed_req_number TEXT    NOT NULL DEFAULT '',
    application_id    INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    dismissed      INTEGER NOT NULL DEFAULT 0,
    fetched_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jt_email_config (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    query       TEXT    NOT NULL,
    days_back   INTEGER NOT NULL DEFAULT 180,
    max_results INTEGER NOT NULL DEFAULT 50
  );

  CREATE TABLE IF NOT EXISTS jt_ats_domains (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    domain     TEXT    NOT NULL UNIQUE,
    company    TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jt_email_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    status     TEXT    NOT NULL,
    field      TEXT    NOT NULL CHECK (field IN ('subject','body','from')),
    operator   TEXT    NOT NULL CHECK (operator IN ('contains','not_contains','starts_with','ends_with','regex')),
    value      TEXT    NOT NULL,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jt_query_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    label      TEXT    NOT NULL DEFAULT '',
    value      TEXT    NOT NULL,
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_email_jobs_received_at ON email_jobs(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_jobs_dismissed   ON email_jobs(dismissed);
`;

// Default ATS domains seeded on first run: [domain, company_hint]
export const DEFAULT_ATS_DOMAINS: [string, string][] = [
  ["greenhouse.io", ""],
  ["lever.co", ""],
  ["workday.com", ""],
  ["icims.com", ""],
  ["smartrecruiters.com", ""],
  ["taleo.net", ""],
  ["jobvite.com", ""],
  ["ashbyhq.com", ""],
  ["rippling.com", ""],
  ["bamboohr.com", ""],
  ["successfactors.com", ""],
  ["lensa.com", ""],
  ["ziprecruiter.com", ""],
  ["virtualvocations.com", ""],
  ["talent.com", ""],
  ["indeed.com", ""],
  ["roberthalf.com", ""],
];

// Default Gmail query fragments: [label, value]
export const DEFAULT_QUERY_RULES: [string, string][] = [
  ["Thank you for applying", 'subject:"thank you for applying"'],
  ["Your application", 'subject:"your application"'],
  ["Application received", 'subject:"we received your application"'],
  ["Interview invitation", 'subject:"interview invitation"'],
  ["Interview request", 'subject:"interview request"'],
  ["Phone screen", 'subject:"phone screen"'],
  ["Technical screen", 'subject:"technical screen"'],
  ["Next steps", 'subject:"next steps"'],
  ["Offer letter", 'subject:"offer letter"'],
  ["Job offer", 'subject:"job offer"'],
  ["Regret to inform", 'subject:"regret to inform"'],
  ["Not moving forward", 'subject:"not moving forward"'],
  ["Other candidates", 'subject:"other candidates"'],
  ["Moving forward", 'subject:"moving forward"'],
];

// Default status-detection rules: [status, field, operator, value, priority]
export const DEFAULT_EMAIL_RULES: [string, string, string, string, number][] = [
  // Offer — highest priority
  ["Offer", "subject", "contains", "offer letter", 100],
  ["Offer", "subject", "contains", "job offer", 100],
  ["Offer", "body", "contains", "pleased to offer", 90],
  ["Offer", "body", "contains", "compensation package", 90],
  [
    "Offer",
    "body",
    "regex",
    "we'?re (happy|excited|pleased) to (offer|extend)",
    85,
  ],
  // Rejected
  ["Rejected", "body", "contains", "unfortunately", 80],
  [
    "Rejected",
    "body",
    "regex",
    "not (moving|proceed|progress)\\w* forward",
    80,
  ],
  ["Rejected", "body", "regex", "decided (not to|to not) move", 80],
  ["Rejected", "body", "contains", "other candidates", 80],
  ["Rejected", "body", "regex", "regret to (inform|let|tell)", 80],
  ["Rejected", "body", "regex", "not (been )?selected", 78],
  ["Rejected", "body", "contains", "will not be moving", 78],
  ["Rejected", "body", "regex", "not (a )?(fit|match|right fit)", 75],
  ["Rejected", "body", "contains", "position has been filled", 75],
  // Onsite
  ["Onsite", "body", "contains", "onsite", 70],
  ["Onsite", "body", "contains", "on-site interview", 70],
  ["Onsite", "body", "contains", "in-person interview", 70],
  ["Onsite", "body", "regex", "technical (interview|assessment|screen)", 68],
  ["Onsite", "body", "contains", "take-home", 65],
  ["Onsite", "body", "regex", "coding (challenge|assessment|test)", 65],
  // Phone
  ["Phone", "body", "contains", "interview", 60],
  ["Phone", "body", "regex", "phone (screen|call|interview)", 60],
  [
    "Phone",
    "body",
    "regex",
    "schedule (a|an)? (call|chat|meeting|interview)",
    58,
  ],
  ["Phone", "body", "contains", "next steps", 55],
  ["Phone", "body", "regex", "recruiter (call|screen)", 55],
  // Applied — catch-all
  ["Applied", "subject", "contains", "thank you for applying", 20],
  ["Applied", "subject", "contains", "we received your application", 20],
  ["Applied", "subject", "contains", "application received", 20],
  ["Applied", "subject", "contains", "your application", 15],
];

export const SCHEMA_MIGRATIONS: Array<{
  table: string;
  column: string;
  sql: string;
}> = [
  {
    table: "applications",
    column: "location",
    sql: 'ALTER TABLE applications ADD COLUMN location TEXT NOT NULL DEFAULT ""',
  },
];
