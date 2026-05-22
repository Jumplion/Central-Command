// Named-param queries for job-aggregator. Use with namedSql() from
// @renderer/plugins/sqlParams for multi-field INSERT/UPDATE to prevent
// positional-param mistakes. Simple single-param queries stay inline.

// All 17 columns — callers supply every field explicitly (including status,
// notes, is_remote, salary fields) so both SearchTab and BoardsTab can share
// one query without burying literal defaults inside the SQL string.
export const INSERT_SAVED_JOB = `INSERT OR IGNORE INTO saved_jobs
  (job_id,title,company,location,is_remote,employment_type,
   salary_min,salary_max,salary_currency,salary_period,
   date_posted,apply_link,source,description,status,notes,saved_at)
 VALUES (:job_id,:title,:company,:location,:is_remote,:employment_type,
         :salary_min,:salary_max,:salary_currency,:salary_period,
         :date_posted,:apply_link,:source,:description,:status,:notes,:saved_at)`;

export const INSERT_COMPANY_FEED =
  "INSERT INTO company_feeds (name,url,feed_type,company_type,enabled,added_at) VALUES (:name,:url,:feed_type,:company_type,1,:added_at)";

// Feed-job batch insert. The enabled=1 default is provided by the schema;
// callers use namedSql per-item inside runBatch.
export const INSERT_FEED_JOB = `INSERT OR IGNORE INTO feed_jobs
  (feed_id,ext_id,title,company,location,date_posted,apply_link,description,fetched_at)
 VALUES (:feed_id,:ext_id,:title,:company,:location,:date_posted,:apply_link,:description,:fetched_at)`;
