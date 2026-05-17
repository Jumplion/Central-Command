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
`;

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
`;

export const SCHEMA_MIGRATIONS: Array<{ table: string; column: string; sql: string }> = [
  {
    table: 'applications',
    column: 'location',
    sql: 'ALTER TABLE applications ADD COLUMN location TEXT NOT NULL DEFAULT ""',
  },
];
