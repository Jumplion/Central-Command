export const SELECT_ALL_FOLDERS = `
  SELECT * FROM gd_folders ORDER BY parent_id NULLS FIRST, sort_order, name
`;

export const SELECT_ALL_RULES = `
  SELECT * FROM gd_rules ORDER BY priority DESC, id
`;

export const SELECT_EMAILS_FOR_FOLDER = `
  SELECT *,
    COALESCE(override_folder_id, folder_id) AS effective_folder_id
  FROM gd_emails
  WHERE COALESCE(override_folder_id, folder_id) = ?
  ORDER BY received_at DESC
`;

export const SELECT_FOLDER_COUNTS = `
  SELECT
    COALESCE(override_folder_id, folder_id) AS fid,
    COUNT(*) AS total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
  FROM gd_emails
  WHERE COALESCE(override_folder_id, folder_id) IS NOT NULL
  GROUP BY fid
`;

export const UPSERT_EMAIL = `
  INSERT INTO gd_emails
    (gmail_id, thread_id, subject, from_address, labels, received_at, snippet, folder_id, is_read, fetched_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(gmail_id) DO UPDATE SET
    subject      = excluded.subject,
    from_address = excluded.from_address,
    labels       = excluded.labels,
    received_at  = excluded.received_at,
    snippet      = excluded.snippet,
    folder_id    = excluded.folder_id,
    is_read      = excluded.is_read,
    fetched_at   = excluded.fetched_at
`;

export const SET_OVERRIDE_FOLDER = `
  UPDATE gd_emails SET override_folder_id = ? WHERE id = ?
`;

export const CLEAR_OVERRIDE_FOLDER = `
  UPDATE gd_emails SET override_folder_id = NULL WHERE id = ?
`;

export const INSERT_FOLDER = `
  INSERT INTO gd_folders (name, parent_id, sort_order, icon) VALUES (?,?,?,?)
`;

export const UPDATE_FOLDER = `
  UPDATE gd_folders SET name = ?, icon = ? WHERE id = ?
`;

export const DELETE_FOLDER = `
  DELETE FROM gd_folders WHERE id = ?
`;

export const INSERT_RULE = `
  INSERT INTO gd_rules (folder_id, field, operator, value, priority) VALUES (?,?,?,?,?)
`;

export const UPDATE_RULE = `
  UPDATE gd_rules SET folder_id = ?, field = ?, operator = ?, value = ?, priority = ? WHERE id = ?
`;

export const DELETE_RULE = `
  DELETE FROM gd_rules WHERE id = ?
`;
