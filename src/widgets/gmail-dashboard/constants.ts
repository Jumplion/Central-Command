import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS gd_folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    parent_id  INTEGER REFERENCES gd_folders(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    icon       TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gd_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id  INTEGER NOT NULL REFERENCES gd_folders(id) ON DELETE CASCADE,
    field      TEXT    NOT NULL CHECK (field IN ('subject','from','label','snippet')),
    operator   TEXT    NOT NULL CHECK (operator IN ('contains','starts_with','ends_with','regex','not_contains')),
    value      TEXT    NOT NULL,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gd_emails (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_id           TEXT    UNIQUE NOT NULL,
    thread_id          TEXT    NOT NULL,
    subject            TEXT    NOT NULL DEFAULT '',
    from_address       TEXT    NOT NULL DEFAULT '',
    labels             TEXT    NOT NULL DEFAULT '[]',
    received_at        TEXT    NOT NULL,
    snippet            TEXT    NOT NULL DEFAULT '',
    folder_id          INTEGER REFERENCES gd_folders(id),
    override_folder_id INTEGER REFERENCES gd_folders(id),
    is_read            INTEGER NOT NULL DEFAULT 0,
    fetched_at         INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS gd_emails_folder_idx ON gd_emails(folder_id);
  CREATE INDEX IF NOT EXISTS gd_emails_override_idx ON gd_emails(override_folder_id);
  CREATE INDEX IF NOT EXISTS gd_emails_received_idx ON gd_emails(received_at DESC);
`;

export const MIGRATIONS: SqlMigration[] = [];

// Default job-search folder + rule seed data
// Inserted once when the widget is first used (checked via folder count)
export const DEFAULT_FOLDERS = [
  { name: "Job Search", parent_id: null, sort_order: 0, icon: "💼" },
  { name: "Applied", parent_id: -1 /* resolved below */, sort_order: 0, icon: "📩" },
  { name: "Interviews", parent_id: -1, sort_order: 1, icon: "🎤" },
  { name: "Rejections", parent_id: -1, sort_order: 2, icon: "❌" },
  { name: "Offers", parent_id: -1, sort_order: 3, icon: "🎉" },
  { name: "Alerts", parent_id: -1, sort_order: 4, icon: "🔔" },
];

// [folder_name, field, operator, value, priority]
export const DEFAULT_RULES: [string, string, string, string, number][] = [
  // Offers — highest priority
  ["Offers", "subject", "contains", "offer letter", 100],
  ["Offers", "subject", "contains", "job offer", 100],
  ["Offers", "subject", "contains", "pleased to offer", 100],
  ["Offers", "snippet", "contains", "compensation package", 90],
  ["Offers", "snippet", "contains", "pleased to offer", 90],

  // Rejections
  ["Rejections", "subject", "contains", "unfortunately", 80],
  ["Rejections", "subject", "contains", "not moving forward", 80],
  ["Rejections", "subject", "contains", "other candidates", 80],
  ["Rejections", "subject", "contains", "not selected", 80],
  ["Rejections", "snippet", "contains", "regret to inform", 75],
  ["Rejections", "snippet", "contains", "not moving forward", 75],
  ["Rejections", "snippet", "contains", "other candidates", 75],
  ["Rejections", "snippet", "contains", "not been selected", 75],
  ["Rejections", "snippet", "contains", "unfortunately", 70],

  // Interviews
  ["Interviews", "subject", "contains", "interview invitation", 60],
  ["Interviews", "subject", "contains", "interview request", 60],
  ["Interviews", "subject", "contains", "phone screen", 60],
  ["Interviews", "subject", "contains", "technical screen", 60],
  ["Interviews", "subject", "contains", "next steps", 55],
  ["Interviews", "snippet", "contains", "schedule a call", 50],
  ["Interviews", "snippet", "contains", "schedule an interview", 50],
  ["Interviews", "snippet", "contains", "next steps", 45],

  // Job alerts from common platforms
  ["Alerts", "from", "contains", "jobalerts@linkedin.com", 40],
  ["Alerts", "from", "contains", "alerts@indeed.com", 40],
  ["Alerts", "from", "contains", "ziprecruiter.com", 40],
  ["Alerts", "from", "contains", "glassdoor.com", 40],
  ["Alerts", "subject", "contains", "job alert", 35],
  ["Alerts", "subject", "contains", "new jobs for you", 35],
  ["Alerts", "subject", "contains", "jobs matching", 35],

  // Applied — catch-all for application confirmations
  ["Applied", "subject", "contains", "thank you for applying", 20],
  ["Applied", "subject", "contains", "we received your application", 20],
  ["Applied", "subject", "contains", "application received", 20],
  ["Applied", "subject", "contains", "application submitted", 20],
  ["Applied", "subject", "contains", "your application", 15],
  ["Applied", "snippet", "contains", "thank you for applying", 10],
  ["Applied", "snippet", "contains", "we have received your application", 10],
];

export const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
