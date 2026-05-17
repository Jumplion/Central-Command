import { describe, expect, it } from 'vitest';
import {
  MEDIA_TYPES,
  STATUS_FILTERS,
  STATUS_COLORS,
  CURRENT_VERB,
  LINK_RELATIONS,
  DEFAULT_FORM,
  INIT_SQL,
  MIGRATIONS,
} from './constants';
import type { MediaStatus, MediaType, LinkRelation } from './types';

// ─── MEDIA_TYPES ──────────────────────────────────────────────────────────────

describe('MEDIA_TYPES', () => {
  const ALL_TYPES: MediaType[] = ['book', 'movie', 'tv', 'game', 'podcast', 'anime', 'other'];

  it('covers every MediaType', () => {
    const values = MEDIA_TYPES.map(m => m.value);
    for (const t of ALL_TYPES) {
      expect(values).toContain(t);
    }
  });

  it('has no duplicate values', () => {
    const values = MEDIA_TYPES.map(m => m.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every entry has a non-empty label and emoji', () => {
    for (const { label, emoji } of MEDIA_TYPES) {
      expect(label.length).toBeGreaterThan(0);
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});

// ─── STATUS_FILTERS ───────────────────────────────────────────────────────────

describe('STATUS_FILTERS', () => {
  const ALL_STATUSES: MediaStatus[] = ['current', 'owned', 'want', 'completed', 'paused', 'dropped'];

  it('includes the "all" catch-all filter first', () => {
    expect(STATUS_FILTERS[0].value).toBe('all');
  });

  it('covers every MediaStatus', () => {
    const values = STATUS_FILTERS.map(f => f.value);
    for (const s of ALL_STATUSES) {
      expect(values).toContain(s);
    }
  });

  it('has no duplicate values', () => {
    const values = STATUS_FILTERS.map(f => f.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every entry has a non-empty label', () => {
    for (const { label } of STATUS_FILTERS) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ─── STATUS_COLORS ────────────────────────────────────────────────────────────

describe('STATUS_COLORS', () => {
  const ALL_STATUSES: MediaStatus[] = ['current', 'owned', 'want', 'completed', 'paused', 'dropped'];

  it('provides a color for every MediaStatus', () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_COLORS[s]).toBeDefined();
      expect(STATUS_COLORS[s]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has no two statuses sharing the same color', () => {
    const colors = Object.values(STATUS_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

// ─── CURRENT_VERB ─────────────────────────────────────────────────────────────

describe('CURRENT_VERB', () => {
  const ALL_TYPES: MediaType[] = ['book', 'movie', 'tv', 'game', 'podcast', 'anime', 'other'];

  it('provides a verb for every MediaType', () => {
    for (const t of ALL_TYPES) {
      expect(CURRENT_VERB[t]).toBeDefined();
      expect(CURRENT_VERB[t].length).toBeGreaterThan(0);
    }
  });

  it('uses Reading for book', () => expect(CURRENT_VERB['book']).toBe('Reading'));
  it('uses Playing for game', () => expect(CURRENT_VERB['game']).toBe('Playing'));
  it('uses Listening for podcast', () => expect(CURRENT_VERB['podcast']).toBe('Listening'));
});

// ─── LINK_RELATIONS ───────────────────────────────────────────────────────────

describe('LINK_RELATIONS', () => {
  const ALL_RELATIONS: LinkRelation[] = [
    'sequel', 'prequel', 'spinoff', 'series', 'adaptation', 'remake', 'related',
  ];

  it('covers every LinkRelation', () => {
    const values = LINK_RELATIONS.map(r => r.value);
    for (const r of ALL_RELATIONS) {
      expect(values).toContain(r);
    }
  });

  it('has no duplicate values', () => {
    const values = LINK_RELATIONS.map(r => r.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every entry has a non-empty label', () => {
    for (const { label } of LINK_RELATIONS) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ─── DEFAULT_FORM ─────────────────────────────────────────────────────────────

describe('DEFAULT_FORM', () => {
  it('has an empty title', () => expect(DEFAULT_FORM.title).toBe(''));
  it('defaults type to book', () => expect(DEFAULT_FORM.type).toBe('book'));
  it('defaults status to want', () => expect(DEFAULT_FORM.status).toBe('want'));
  it('defaults rating to 0', () => expect(DEFAULT_FORM.rating).toBe(0));
  it('has empty string for all optional text fields', () => {
    expect(DEFAULT_FORM.author_creator).toBe('');
    expect(DEFAULT_FORM.notes).toBe('');
    expect(DEFAULT_FORM.external_id).toBe('');
    expect(DEFAULT_FORM.external_source).toBe('');
  });
});

// ─── INIT_SQL ─────────────────────────────────────────────────────────────────

describe('INIT_SQL', () => {
  it('creates media_items table', () =>
    expect(INIT_SQL).toContain('CREATE TABLE IF NOT EXISTS media_items'));

  it('creates media_status_history table', () =>
    expect(INIT_SQL).toContain('CREATE TABLE IF NOT EXISTS media_status_history'));

  it('creates media_links table', () =>
    expect(INIT_SQL).toContain('CREATE TABLE IF NOT EXISTS media_links'));

  it('media_items includes required columns', () => {
    expect(INIT_SQL).toContain('title');
    expect(INIT_SQL).toContain('type');
    expect(INIT_SQL).toContain('status');
    expect(INIT_SQL).toContain('pinned');
    expect(INIT_SQL).toContain('rating');
    expect(INIT_SQL).toContain('created_at');
    expect(INIT_SQL).toContain('updated_at');
  });

  it('media_links includes a UNIQUE constraint on item_id + linked_item_id', () =>
    expect(INIT_SQL).toContain('UNIQUE(item_id, linked_item_id)'));
});

// ─── MIGRATIONS ───────────────────────────────────────────────────────────────

describe('MIGRATIONS', () => {
  it('is an array', () => expect(Array.isArray(MIGRATIONS)).toBe(true));
  it('starts empty (no post-v1 migrations yet)', () => expect(MIGRATIONS).toHaveLength(0));
});
