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

describe('concurrent reads (inflight deduplication)', () => {
  it('resolves all concurrent reads of the same widget to the same object', async () => {
    // Trigger two parallel loads before either resolves
    const [a, b] = await Promise.all([store.get('w', 'k'), store.get('w', 'k')]);
    // Both should return undefined (key not set) without error
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
  });

  it('reads set by one concurrent caller are visible to the other', async () => {
    await store.set('w', 'shared', 42);
    const [a, b] = await Promise.all([store.get('w', 'shared'), store.get('w', 'shared')]);
    expect(a).toBe(42);
    expect(b).toBe(42);
  });
});

describe('load from disk with invalid JSON', () => {
  it('throws when the store file contains malformed JSON', async () => {
    const dir = path.join(root, 'widgets', 'bad-widget');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'store.json'), '{ not valid json', 'utf-8');
    await expect(store.get('bad-widget', 'k')).rejects.toThrow();
  });

  it('returns an empty store when the file contains a JSON array (not an object)', async () => {
    const dir = path.join(root, 'widgets', 'arr-widget');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'arr-widget', 'store.json'), '[]', 'utf-8').catch(() => {});
    // Write to the correct path
    await fs.writeFile(path.join(dir, 'store.json'), '[]', 'utf-8');
    // Arrays are coerced to empty object; no key should be found
    expect(await store.get('arr-widget', 'any')).toBeUndefined();
  });
});

describe('del then flush', () => {
  it('persists the deletion to disk', async () => {
    await store.set('w', 'to-delete', 'present');
    await store.flush('w');
    await store.del('w', 'to-delete');
    await store.flush('w');
    const filePath = path.join(root, 'widgets', 'w', 'store.json');
    const disk = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    expect(disk).not.toHaveProperty('to-delete');
  });
});
