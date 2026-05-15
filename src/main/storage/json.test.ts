import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from './json';

let root: string;
let store: JsonStore;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-json-'));
  store = new JsonStore(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('get', () => {
  it('returns undefined for a missing key', async () => {
    expect(await store.get('w', 'missing')).toBeUndefined();
  });

  it('returns undefined when the store file does not exist (ENOENT)', async () => {
    // No file written — exercises the ENOENT catch branch
    expect(await store.get('brand-new-widget', 'anything')).toBeUndefined();
  });
});

describe('set / get', () => {
  it('stores and retrieves a primitive without hitting disk', async () => {
    await store.set('w', 'count', 99);
    expect(await store.get('w', 'count')).toBe(99);
  });

  it('handles nested objects', async () => {
    await store.set('w', 'obj', { a: 1, b: [2, 3] });
    expect(await store.get('w', 'obj')).toEqual({ a: 1, b: [2, 3] });
  });

  it('overwrites an existing key', async () => {
    await store.set('w', 'k', 'first');
    await store.set('w', 'k', 'second');
    expect(await store.get('w', 'k')).toBe('second');
  });
});

describe('del', () => {
  it('removes a key from the in-memory store', async () => {
    await store.set('w', 'x', 'hello');
    await store.del('w', 'x');
    expect(await store.get('w', 'x')).toBeUndefined();
  });

  it('is a no-op for a key that does not exist', async () => {
    await expect(store.del('w', 'ghost')).resolves.toBeUndefined();
  });
});

describe('keys', () => {
  it('returns all stored keys for a widget', async () => {
    await store.set('w', 'alpha', 1);
    await store.set('w', 'beta', 2);
    expect(await store.keys('w')).toEqual(expect.arrayContaining(['alpha', 'beta']));
  });

  it('returns an empty array when no keys exist', async () => {
    expect(await store.keys('empty')).toEqual([]);
  });
});

describe('keysWithPrefix', () => {
  it('returns only keys that match the prefix', async () => {
    await store.set('w', 'ns::a', 1);
    await store.set('w', 'ns::b', 2);
    await store.set('w', 'other', 3);
    const result = await store.keysWithPrefix('w', 'ns::');
    expect(result).toEqual(expect.arrayContaining(['ns::a', 'ns::b']));
    expect(result).not.toContain('other');
  });

  it('returns an empty array when no keys match', async () => {
    await store.set('w', 'unrelated', 1);
    expect(await store.keysWithPrefix('w', 'ns::')).toEqual([]);
  });
});

describe('flush', () => {
  it('persists data to the correct path on disk', async () => {
    await store.set('w', 'key', 'value');
    await store.flush('w');
    const filePath = path.join(root, 'widgets', 'w', 'store.json');
    expect(JSON.parse(await fs.readFile(filePath, 'utf-8'))).toEqual({ key: 'value' });
  });

  it('writes atomically — no .tmp file left behind', async () => {
    await store.set('w', 'key', 'value');
    await store.flush('w');
    const tmpPath = path.join(root, 'widgets', 'w', 'store.json.tmp');
    await expect(fs.access(tmpPath)).rejects.toThrow();
  });

  it('is a no-op when the widget has no cached data', async () => {
    await expect(store.flush('never-loaded')).resolves.toBeUndefined();
  });
});

describe('flushAll (debounce coalescing)', () => {
  it('calls onFlushed exactly once for two rapid sets on the same widget', async () => {
    const flushed: string[] = [];
    store.onFlushed = (id) => flushed.push(id);
    await store.set('w', 'a', 1);
    await store.set('w', 'b', 2);
    await store.flushAll();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toBe('w');
  });

  it('flushes multiple widgets independently', async () => {
    const flushed: string[] = [];
    store.onFlushed = (id) => flushed.push(id);
    await store.set('widget-a', 'k', 1);
    await store.set('widget-b', 'k', 2);
    await store.flushAll();
    expect(flushed).toEqual(expect.arrayContaining(['widget-a', 'widget-b']));
    expect(flushed).toHaveLength(2);
  });
});

describe('invalidateCache', () => {
  it('causes the next read to reload from disk', async () => {
    await store.set('w', 'k', 'original');
    await store.flush('w');
    store.invalidateCache('w');

    // Mutate the file directly on disk
    const filePath = path.join(root, 'widgets', 'w', 'store.json');
    await fs.writeFile(filePath, JSON.stringify({ k: 'updated' }), 'utf-8');

    expect(await store.get('w', 'k')).toBe('updated');
  });
});

describe('getCachedWidgetIds', () => {
  it('returns ids of widgets that have been loaded into the cache', async () => {
    await store.set('widget-a', 'k', 1);
    await store.set('widget-b', 'k', 2);
    expect(store.getCachedWidgetIds()).toEqual(expect.arrayContaining(['widget-a', 'widget-b']));
  });
});

describe('invalid widgetId', () => {
  it('throws for a path-traversal id', async () => {
    await expect(store.get('../evil', 'key')).rejects.toThrow();
  });

  it('throws for an id with uppercase letters', async () => {
    await expect(store.set('UpperCase', 'k', 1)).rejects.toThrow();
  });
});
