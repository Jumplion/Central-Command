import type { FormState, LinkRelation, MediaStatus, MediaType, StatusFilter } from './types';
import { emptyMigrations } from '@renderer/hooks/sqlMigrationHelper';
import type { SqlMigration } from '@renderer/hooks/useSqlInit';

export const MEDIA_TYPES: { value: MediaType; label: string; emoji: string }[] = [
  { value: 'book',    label: 'Book',     emoji: '📚' },
  { value: 'movie',   label: 'Movie',    emoji: '🎬' },
  { value: 'tv',      label: 'TV Show',  emoji: '📺' },
  { value: 'game',    label: 'Game',     emoji: '🎮' },
  { value: 'podcast', label: 'Podcast',  emoji: '🎙️' },
  { value: 'anime',   label: 'Anime',    emoji: '⛩️' },
  { value: 'other',   label: 'Other',    emoji: '🎯' },
];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'current',   label: 'Current' },
  { value: 'owned',     label: 'Owned' },
  { value: 'want',      label: 'Want' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused',    label: 'Paused' },
  { value: 'dropped',   label: 'Dropped' },
];

export const STATUS_COLORS: Record<MediaStatus, string> = {
  current:   '#3b82f6',
  owned:     '#06b6d4',
  want:      '#a855f7',
  completed: '#22c55e',
  paused:    '#f59e0b',
  dropped:   '#ef4444',
};

export const CURRENT_VERB: Record<MediaType, string> = {
  book:    'Reading',
  movie:   'Watching',
  tv:      'Watching',
  game:    'Playing',
  podcast: 'Listening',
  anime:   'Watching',
  other:   'Consuming',
};

export const LINK_RELATIONS: { value: LinkRelation; label: string }[] = [
  { value: 'sequel',     label: 'Sequel' },
  { value: 'prequel',    label: 'Prequel' },
  { value: 'spinoff',    label: 'Spinoff' },
  { value: 'series',     label: 'Same Series' },
  { value: 'adaptation', label: 'Adaptation' },
  { value: 'remake',     label: 'Remake / Remaster' },
  { value: 'related',    label: 'Related' },
];

export const DEFAULT_FORM: FormState = {
  title: '',
  type: 'book',
  status: 'want',
  author_creator: '',
  rating: 0,
  notes: '',
  external_id: '',
  external_source: '',
};

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS media_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    type            TEXT    NOT NULL DEFAULT 'other',
    status          TEXT    NOT NULL DEFAULT 'want',
    pinned          INTEGER NOT NULL DEFAULT 0,
    rating          INTEGER,
    notes           TEXT,
    author_creator  TEXT,
    external_id     TEXT,
    external_source TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS media_status_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    INTEGER NOT NULL,
    status     TEXT    NOT NULL,
    changed_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS media_links (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id        INTEGER NOT NULL,
    linked_item_id INTEGER NOT NULL,
    relation       TEXT    NOT NULL DEFAULT 'related',
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(item_id, linked_item_id)
  );
`;

export const MIGRATIONS: SqlMigration[] = emptyMigrations();
// When adding columns after v1.0, replace with:
// export const MIGRATIONS: SqlMigration[] = [
//   createMigration('media_items', 'newColumn', 'ALTER TABLE media_items ADD COLUMN newColumn TEXT'),
// ];
