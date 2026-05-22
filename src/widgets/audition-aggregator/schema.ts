export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS auditions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_title       TEXT    NOT NULL,
    role                TEXT    NOT NULL DEFAULT '',
    project_type        TEXT    NOT NULL DEFAULT 'Film',
    status              TEXT    NOT NULL DEFAULT 'Interested',
    casting_studio      TEXT    NOT NULL DEFAULT '',
    location            TEXT    NOT NULL DEFAULT '',
    pay_rate            TEXT    NOT NULL DEFAULT '',
    submitted_at        TEXT    NOT NULL,
    submission_deadline TEXT    NOT NULL DEFAULT '',
    shoot_date          TEXT    NOT NULL DEFAULT '',
    link                TEXT    NOT NULL DEFAULT '',
    notes               TEXT    NOT NULL DEFAULT '',
    last_updated        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_checks (
    site_id      TEXT    PRIMARY KEY,
    last_checked INTEGER NOT NULL
  );
`;
