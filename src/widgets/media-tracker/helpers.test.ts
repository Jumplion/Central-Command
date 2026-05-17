import { describe, expect, it, vi } from 'vitest';
import { typeEmoji, statusLabel, relationLabel, formatDate, lookupMetadata } from './helpers';
import type { WidgetApi } from '@renderer/plugins/api';

// ─── typeEmoji ────────────────────────────────────────────────────────────────

describe('typeEmoji', () => {
  it('returns 📚 for book', () => expect(typeEmoji('book')).toBe('📚'));
  it('returns 🎬 for movie', () => expect(typeEmoji('movie')).toBe('🎬'));
  it('returns 📺 for tv', () => expect(typeEmoji('tv')).toBe('📺'));
  it('returns 🎮 for game', () => expect(typeEmoji('game')).toBe('🎮'));
  it('returns 🎙️ for podcast', () => expect(typeEmoji('podcast')).toBe('🎙️'));
  it('returns ⛩️ for anime', () => expect(typeEmoji('anime')).toBe('⛩️'));
  it('returns 🎯 for other', () => expect(typeEmoji('other')).toBe('🎯'));
  it('returns 🎯 fallback for unknown type', () =>
    expect(typeEmoji('unknown' as never)).toBe('🎯'));
});

// ─── statusLabel ──────────────────────────────────────────────────────────────

describe('statusLabel', () => {
  it('returns All for all', () => expect(statusLabel('all' as never)).toBe('All'));
  it('returns Current for current', () => expect(statusLabel('current')).toBe('Current'));
  it('returns Owned for owned', () => expect(statusLabel('owned')).toBe('Owned'));
  it('returns Want for want', () => expect(statusLabel('want')).toBe('Want'));
  it('returns Completed for completed', () => expect(statusLabel('completed')).toBe('Completed'));
  it('returns Paused for paused', () => expect(statusLabel('paused')).toBe('Paused'));
  it('returns Dropped for dropped', () => expect(statusLabel('dropped')).toBe('Dropped'));
  it('returns the raw value as fallback for unknown status', () =>
    expect(statusLabel('archived' as never)).toBe('archived'));
});

// ─── relationLabel ────────────────────────────────────────────────────────────

describe('relationLabel', () => {
  it('returns Sequel for sequel', () => expect(relationLabel('sequel')).toBe('Sequel'));
  it('returns Prequel for prequel', () => expect(relationLabel('prequel')).toBe('Prequel'));
  it('returns Spinoff for spinoff', () => expect(relationLabel('spinoff')).toBe('Spinoff'));
  it('returns Same Series for series', () => expect(relationLabel('series')).toBe('Same Series'));
  it('returns Adaptation for adaptation', () => expect(relationLabel('adaptation')).toBe('Adaptation'));
  it('returns Remake / Remaster for remake', () =>
    expect(relationLabel('remake')).toBe('Remake / Remaster'));
  it('returns Related for related', () => expect(relationLabel('related')).toBe('Related'));
  it('returns the raw value as fallback for unknown relation', () =>
    expect(relationLabel('companion' as never)).toBe('companion'));
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats an ISO date string to a readable date', () => {
    const result = formatDate('2024-06-15T10:30:00.000Z');
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it('formats different months correctly', () => {
    expect(formatDate('2023-01-15T12:00:00.000Z')).toMatch(/Jan/);
    expect(formatDate('2023-12-15T12:00:00.000Z')).toMatch(/Dec/);
  });
});

// ─── lookupMetadata ───────────────────────────────────────────────────────────

type MockNet = Pick<WidgetApi['net'], 'fetch'>;

function mockNet(body: unknown, ok = true): MockNet {
  return {
    fetch: vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      body: JSON.stringify(body),
    }),
  };
}

describe('lookupMetadata — book (OpenLibrary)', () => {
  it('returns up to 5 results from OpenLibrary', async () => {
    const net = mockNet({
      docs: [
        { key: '/works/OL123W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965 },
        { key: '/works/OL456W', title: 'Dune Messiah', author_name: ['Frank Herbert'], first_publish_year: 1969 },
      ],
    });
    const results = await lookupMetadata(net as never, 'book', 'Dune', {});
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      externalId: '/works/OL123W',
      source: 'openlibrary',
      title: 'Dune',
      creator: 'Frank Herbert',
      year: '1965',
    });
  });

  it('handles missing author_name and first_publish_year gracefully', async () => {
    const net = mockNet({ docs: [{ key: '/works/OL789W', title: 'Unknown Book' }] });
    const results = await lookupMetadata(net as never, 'book', 'Unknown Book', {});
    expect(results[0]).toMatchObject({ creator: '', year: '' });
  });

  it('joins up to 2 authors with a comma', async () => {
    const net = mockNet({
      docs: [{ key: '/works/OL1W', title: 'Collab', author_name: ['Author A', 'Author B', 'Author C'], first_publish_year: 2000 }],
    });
    const [result] = await lookupMetadata(net as never, 'book', 'Collab', {});
    expect(result.creator).toBe('Author A, Author B');
  });

  it('caps results at 5', async () => {
    const net = mockNet({
      docs: Array.from({ length: 10 }, (_, i) => ({
        key: `/works/OL${i}W`,
        title: `Book ${i}`,
        author_name: [],
        first_publish_year: 2000 + i,
      })),
    });
    const results = await lookupMetadata(net as never, 'book', 'test', {});
    expect(results).toHaveLength(5);
  });

  it('passes the encoded title to OpenLibrary', async () => {
    const net = mockNet({ docs: [] });
    await lookupMetadata(net as never, 'book', 'The Name of the Wind', {});
    const url = (net.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('openlibrary.org');
    expect(url).toContain(encodeURIComponent('The Name of the Wind'));
  });

  it('returns empty array when network response is not ok', async () => {
    const net = mockNet({}, false);
    const results = await lookupMetadata(net as never, 'book', 'Dune', {});
    expect(results).toEqual([]);
  });
});

describe('lookupMetadata — game (RAWG)', () => {
  it('returns empty array when rawgKey is missing', async () => {
    const net = mockNet({ results: [] });
    const results = await lookupMetadata(net as never, 'game', 'Hades', {});
    expect(results).toEqual([]);
    expect((net.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('fetches from RAWG when rawgKey is provided', async () => {
    const net = mockNet({
      results: [
        { id: 1, name: 'Hades', released: '2020-09-17' },
        { id: 2, name: 'Hades II', released: '2024-05-06' },
      ],
    });
    const results = await lookupMetadata(net as never, 'game', 'Hades', { rawgKey: 'test-key' });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      externalId: '1',
      source: 'rawg',
      title: 'Hades',
      creator: '',
      year: '2020',
    });
  });

  it('includes the api key and encoded query in the RAWG URL', async () => {
    const net = mockNet({ results: [] });
    await lookupMetadata(net as never, 'game', 'Dark Souls', { rawgKey: 'abc123' });
    const url = (net.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('rawg.io');
    expect(url).toContain('key=abc123');
    expect(url).toContain(encodeURIComponent('Dark Souls'));
  });

  it('handles null released date gracefully', async () => {
    const net = mockNet({ results: [{ id: 99, name: 'Unreleased', released: null }] });
    const [result] = await lookupMetadata(net as never, 'game', 'Unreleased', { rawgKey: 'k' });
    expect(result.year).toBe('');
  });

  it('returns empty array when network response is not ok', async () => {
    const net = mockNet({}, false);
    const results = await lookupMetadata(net as never, 'game', 'Hades', { rawgKey: 'k' });
    expect(results).toEqual([]);
  });

  it('caps results at 5', async () => {
    const net = mockNet({
      results: Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Game ${i}`, released: '2020-01-01' })),
    });
    const results = await lookupMetadata(net as never, 'game', 'game', { rawgKey: 'k' });
    expect(results).toHaveLength(5);
  });
});

describe('lookupMetadata — movie / tv / anime (TMDB)', () => {
  it('returns empty array when tmdbKey is missing', async () => {
    const net = mockNet({ results: [] });
    const results = await lookupMetadata(net as never, 'movie', 'Inception', {});
    expect(results).toEqual([]);
    expect((net.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('fetches from TMDB for movie type', async () => {
    const net = mockNet({
      results: [{ id: 27205, title: 'Inception', release_date: '2010-07-16' }],
    });
    const results = await lookupMetadata(net as never, 'movie', 'Inception', { tmdbKey: 'k' });
    expect(results[0]).toMatchObject({
      externalId: '27205',
      source: 'tmdb',
      title: 'Inception',
      year: '2010',
    });
  });

  it('uses name field for TV shows returned by TMDB', async () => {
    const net = mockNet({
      results: [{ id: 1396, name: 'Breaking Bad', first_air_date: '2008-01-20' }],
    });
    const [result] = await lookupMetadata(net as never, 'tv', 'Breaking Bad', { tmdbKey: 'k' });
    expect(result.title).toBe('Breaking Bad');
    expect(result.year).toBe('2008');
  });

  it('fetches from TMDB for anime type', async () => {
    const net = mockNet({
      results: [{ id: 85937, name: 'Demon Slayer', first_air_date: '2019-04-06' }],
    });
    const [result] = await lookupMetadata(net as never, 'anime', 'Demon Slayer', { tmdbKey: 'k' });
    expect(result.source).toBe('tmdb');
    expect(result.title).toBe('Demon Slayer');
  });

  it('includes the api key and encoded query in the TMDB URL', async () => {
    const net = mockNet({ results: [] });
    await lookupMetadata(net as never, 'movie', 'The Matrix', { tmdbKey: 'tmdb-key' });
    const url = (net.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('themoviedb.org');
    expect(url).toContain('api_key=tmdb-key');
    expect(url).toContain(encodeURIComponent('The Matrix'));
  });

  it('returns empty array when network response is not ok', async () => {
    const net = mockNet({}, false);
    const results = await lookupMetadata(net as never, 'movie', 'test', { tmdbKey: 'k' });
    expect(results).toEqual([]);
  });

  it('caps results at 5', async () => {
    const net = mockNet({
      results: Array.from({ length: 10 }, (_, i) => ({
        id: i, title: `Movie ${i}`, release_date: '2020-01-01',
      })),
    });
    const results = await lookupMetadata(net as never, 'movie', 'test', { tmdbKey: 'k' });
    expect(results).toHaveLength(5);
  });
});

describe('lookupMetadata — unsupported types', () => {
  it('returns empty array for podcast without making a network call', async () => {
    const net = mockNet({});
    const results = await lookupMetadata(net as never, 'podcast', 'My Podcast', {});
    expect(results).toEqual([]);
    expect((net.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns empty array for other without making a network call', async () => {
    const net = mockNet({});
    const results = await lookupMetadata(net as never, 'other', 'Something', {});
    expect(results).toEqual([]);
    expect((net.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
