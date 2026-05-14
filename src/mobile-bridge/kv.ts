import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const DEBOUNCE_MS = 200;

type Store = Record<string, unknown>;
const cache = new Map<string, Store>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export let onFlushed: (widgetId: string) => void = () => {};

async function ensureDir(widgetId: string): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: `widgets/${widgetId}`,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // directory may already exist
  }
}

async function loadStore(widgetId: string): Promise<Store> {
  if (cache.has(widgetId)) return cache.get(widgetId)!;
  try {
    const { data } = await Filesystem.readFile({
      path: `widgets/${widgetId}/store.json`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const parsed: unknown = JSON.parse(data as string);
    const store = typeof parsed === 'object' && parsed !== null ? (parsed as Store) : {};
    cache.set(widgetId, store);
    return store;
  } catch {
    const store: Store = {};
    cache.set(widgetId, store);
    return store;
  }
}

async function flush(widgetId: string): Promise<void> {
  const store = cache.get(widgetId) ?? {};
  await ensureDir(widgetId);
  await Filesystem.writeFile({
    path: `widgets/${widgetId}/store.json`,
    directory: Directory.Data,
    data: JSON.stringify(store, null, 2),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  onFlushed(widgetId);
}

function scheduleFlush(widgetId: string): void {
  const existing = timers.get(widgetId);
  if (existing) clearTimeout(existing);
  timers.set(
    widgetId,
    setTimeout(() => {
      timers.delete(widgetId);
      flush(widgetId).catch(console.error);
    }, DEBOUNCE_MS)
  );
}

export function invalidateCache(widgetId: string): void {
  cache.delete(widgetId);
}

export const kvApi = {
  async get(widgetId: string, key: string): Promise<unknown> {
    const store = await loadStore(widgetId);
    return store[key];
  },

  async set(widgetId: string, key: string, value: unknown): Promise<void> {
    const store = await loadStore(widgetId);
    store[key] = value;
    scheduleFlush(widgetId);
  },

  async del(widgetId: string, key: string): Promise<void> {
    const store = await loadStore(widgetId);
    delete store[key];
    scheduleFlush(widgetId);
  },

  async keys(widgetId: string): Promise<string[]> {
    const store = await loadStore(widgetId);
    return Object.keys(store);
  },

  async keysWithPrefix(widgetId: string, prefix: string): Promise<string[]> {
    const store = await loadStore(widgetId);
    return Object.keys(store).filter((k) => k.startsWith(prefix));
  },
};
