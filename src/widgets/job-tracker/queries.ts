export const INSERT_APPLICATION =
  "INSERT INTO applications (company,role,status,applied_at,location,source,link,notes,req_number,last_updated) VALUES (:company,:role,:status,:applied_at,:location,:source,:link,:notes,:req_number,:last_updated)";

export const UPDATE_APPLICATION =
  "UPDATE applications SET company=:company,role=:role,status=:status,applied_at=:applied_at,location=:location,source=:source,link=:link,notes=:notes,req_number=:req_number,last_updated=:last_updated WHERE id=:id";

export const UPDATE_APPLICATION_STATUS =
  "UPDATE applications SET status=?,last_updated=? WHERE id=?";

export const DELETE_APPLICATION = "DELETE FROM applications WHERE id=?";

export const DISMISS_EMAIL_JOB = "UPDATE email_jobs SET dismissed=1 WHERE id=?";

// ─── Email rules ──────────────────────────────────────────────────────────

export const SELECT_ALL_EMAIL_RULES =
  "SELECT * FROM jt_email_rules ORDER BY priority DESC, id";

export const INSERT_EMAIL_RULE =
  "INSERT INTO jt_email_rules (status, field, operator, value, priority) VALUES (:status, :field, :operator, :value, :priority)";

export const UPDATE_EMAIL_RULE =
  "UPDATE jt_email_rules SET status=:status, field=:field, operator=:operator, value=:value, priority=:priority WHERE id=:id";

export const DELETE_EMAIL_RULE = "DELETE FROM jt_email_rules WHERE id=?";

// ─── ATS domains ──────────────────────────────────────────────────────────

export const SELECT_ALL_ATS_DOMAINS =
  "SELECT * FROM jt_ats_domains ORDER BY domain";

export const INSERT_ATS_DOMAIN =
  "INSERT OR IGNORE INTO jt_ats_domains (domain, company) VALUES (:domain, :company)";

export const UPDATE_ATS_DOMAIN =
  "UPDATE jt_ats_domains SET domain=:domain, company=:company WHERE id=:id";

export const DELETE_ATS_DOMAIN = "DELETE FROM jt_ats_domains WHERE id=?";

// ─── Email config ─────────────────────────────────────────────────────────

export const SELECT_EMAIL_CONFIG = "SELECT * FROM jt_email_config WHERE id=1";

export const UPSERT_EMAIL_CONFIG =
  "INSERT INTO jt_email_config (id, query, days_back, max_results) VALUES (1, :query, :days_back, :max_results) ON CONFLICT(id) DO UPDATE SET query=excluded.query, days_back=excluded.days_back, max_results=excluded.max_results";
