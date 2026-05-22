// Named-param queries for audition-aggregator. Use with namedSql() from
// @renderer/plugins/sqlParams for multi-field INSERT/UPDATE to prevent
// positional-param mistakes. Simple single-param queries stay inline.

export const INSERT_AUDITION = `INSERT INTO auditions
  (project_title,role,project_type,status,casting_studio,location,pay_rate,
   submitted_at,submission_deadline,shoot_date,link,notes,last_updated)
 VALUES (:project_title,:role,:project_type,:status,:casting_studio,:location,:pay_rate,
         :submitted_at,:submission_deadline,:shoot_date,:link,:notes,:last_updated)`;

export const UPDATE_AUDITION = `UPDATE auditions SET
  project_title=:project_title, role=:role, project_type=:project_type,
  status=:status, casting_studio=:casting_studio, location=:location,
  pay_rate=:pay_rate, submitted_at=:submitted_at,
  submission_deadline=:submission_deadline, shoot_date=:shoot_date,
  link=:link, notes=:notes, last_updated=:last_updated
 WHERE id=:id`;
