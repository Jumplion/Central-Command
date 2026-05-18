// Row shape returned by api.sql.all<Note>(...) for the `notes` table.
//
// SQLite has no native boolean type. The `pinned` column is declared as
// INTEGER NOT NULL DEFAULT 0 in the schema, so it arrives as 0 or 1.
// Cast to a boolean in the component where needed: `!!note.pinned`.
export interface Note {
  id: number;
  body: string;
  pinned: number;      // 0 | 1
  created_at: string;  // ISO 8601 datetime string produced by datetime('now')
}
