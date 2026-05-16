const KV_PREFIX = 'kv:';
const MTIME_PREFIX = 'kv-mtime:';
const NOTIFY_DEBOUNCE_MS = 200;

type Store = Record<string, unknown>;
const notifyTimers = new Map<string, ReturnType<typeof setTimeout>>();

export let onFlushed: (widgetId: string) => void = () => {};

function getStore(widgetId: string): Store {
  try {
    const raw = localStorage.getItem(`${KV_PREFIX}${widgetId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function setStore(widgetId: string, store: Store): void {
  localStorage.setItem(`${KV_PREFIX}${widgetId}`, JSON.stringify(store));
  localStorage.setItem(`${MTIME_PREFIX}${widgetId}`, String(Date.now()));
  scheduleNotify(widgetId);
}

function scheduleNotify(widgetId: string): void {
  const t = notifyTimers.get(widgetId);
  if (t) clearTimeout(t);
  notifyTimers.set(widgetId, setTimeout(() => {
    notifyTimers.delete(widgetId);
    onFlushed(widgetId);
  }, NOTIFY_DEBOUNCE_MS));
}

// no-op: kept for call-sites that relied on clearing the old in-memory cache
export function invalidateCache(_widgetId: string): void {}

export const kvApi = {
  get(widgetId: string, key: string): Promise<unknown> {
    return Promise.resolve(getStore(widgetId)[key]);
  },

  set(widgetId: string, key: string, value: unknown): Promise<void> {
    const store = getStore(widgetId);
    store[key] = value;
    setStore(widgetId, store);
    return Promise.resolve();
  },

  del(widgetId: string, key: string): Promise<void> {
    const store = getStore(widgetId);
    delete store[key];
    setStore(widgetId, store);
    return Promise.resolve();
  },

  keys(widgetId: string): Promise<string[]> {
    return Promise.resolve(Object.keys(getStore(widgetId)));
  },

  keysWithPrefix(widgetId: string, prefix: string): Promise<string[]> {
    return Promise.resolve(Object.keys(getStore(widgetId)).filter((k) => k.startsWith(prefix)));
  },

  exportJson(widgetId: string): string | null {
    return localStorage.getItem(`${KV_PREFIX}${widgetId}`);
  },

  importJson(widgetId: string, json: string): void {
    localStorage.setItem(`${KV_PREFIX}${widgetId}`, json);
    localStorage.setItem(`${MTIME_PREFIX}${widgetId}`, String(Date.now()));
  },

  widgetIds(): string[] {
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KV_PREFIX)) ids.push(k.slice(KV_PREFIX.length));
    }
    return ids;
  },

  getLastModified(widgetId: string): number {
    const v = localStorage.getItem(`${MTIME_PREFIX}${widgetId}`);
    return v ? Number(v) : 0;
  },
};
