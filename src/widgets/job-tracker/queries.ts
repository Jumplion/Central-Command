export const INSERT_APPLICATION =
  'INSERT INTO applications (company,role,status,applied_at,location,source,link,notes,req_number,last_updated) VALUES (?,?,?,?,?,?,?,?,?,?)';

export const UPDATE_APPLICATION =
  'UPDATE applications SET company=?,role=?,status=?,applied_at=?,location=?,source=?,link=?,notes=?,req_number=?,last_updated=? WHERE id=?';

export const UPDATE_APPLICATION_STATUS =
  'UPDATE applications SET status=?,last_updated=? WHERE id=?';

export const DELETE_APPLICATION = 'DELETE FROM applications WHERE id=?';

export const DISMISS_EMAIL_JOB = 'UPDATE email_jobs SET dismissed=1 WHERE id=?';
