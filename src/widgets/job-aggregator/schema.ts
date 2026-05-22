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
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    url          TEXT    NOT NULL,
    feed_type    TEXT    NOT NULL DEFAULT 'rss',
    company_type TEXT    NOT NULL DEFAULT 'other',
    enabled      INTEGER NOT NULL DEFAULT 1,
    added_at     INTEGER NOT NULL
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
    ignored     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(feed_id, ext_id)
  );
`;
