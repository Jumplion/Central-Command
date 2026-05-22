export const INSERT_APPLICATION =
  "INSERT INTO applications (company,role,status,applied_at,location,source,link,notes,req_number,last_updated) VALUES (:company,:role,:status,:applied_at,:location,:source,:link,:notes,:req_number,:last_updated)";

export const UPDATE_APPLICATION =
  "UPDATE applications SET company=:company,role=:role,status=:status,applied_at=:applied_at,location=:location,source=:source,link=:link,notes=:notes,req_number=:req_number,last_updated=:last_updated WHERE id=:id";

export const UPDATE_APPLICATION_STATUS =
  "UPDATE applications SET status=?,last_updated=? WHERE id=?";

export const DELETE_APPLICATION = "DELETE FROM applications WHERE id=?";

export const DISMISS_EMAIL_JOB = "UPDATE email_jobs SET dismissed=1 WHERE id=?";
