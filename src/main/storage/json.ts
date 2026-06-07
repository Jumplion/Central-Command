import { promises as fs } from "node:fs";
import { atomicWrite, ensureWidgetDir, widgetFile } from "./helpers";

export class JsonStore {
  private cache = new Map<string, Record<string, unknown>>();
  private writers = new Map<string, NodeJS.Timeout>();
  private inflight = new Map<string, Promise<Record<string, unknown>>>();

  onFlushed?: (widgetId: string) => void;

  constructor(private root: string) {}

  private async load(widgetId: string): Promise<Record<string, unknown>> {
    const cached = this.cache.get(widgetId);
    if (cached) return cached;
    const pending = this.inflight.get(widgetId);
    if (pending) return pending;
    const promise = (async () => {
      try {
        const text = await fs.readFile(this.file(widgetId), "utf-8");
        const parsed = JSON.parse(text);
        const obj =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
        this.cache.set(widgetId, obj);
        return obj;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          const obj: Record<string, unknown> = {};
          this.cache.set(widgetId, obj);
          return obj;
        }
        throw err;
      } finally {
        this.inflight.delete(widgetId);
      }
    })();
    this.inflight.set(widgetId, promise);
    return promise;
  }

  private schedule(widgetId: string): void {
    const existing = this.writers.get(widgetId);
    if (existing) clearTimeout(existing);
    this.writers.set(
      widgetId,
      setTimeout(() => {
        this.writers.delete(widgetId);
        this.flush(widgetId).catch((err) =>
          console.error(`[json] flush ${widgetId} failed:`, err),
        );
      }, 1000),
    );
  }

  async flush(widgetId: string): Promise<void> {
    const obj = this.cache.get(widgetId);
    if (!obj) return;
    await ensureWidgetDir(this.root, widgetId);
    const target = this.file(widgetId);
    await atomicWrite(target, JSON.stringify(obj, null, 2));
    this.onFlushed?.(widgetId);
  }

  getCachedWidgetIds(): string[] {
    return Array.from(this.cache.keys());
  }

  invalidateCache(widgetId: string): void {
    this.cache.delete(widgetId);
  }

  async flushAll(): Promise<void> {
    for (const t of this.writers.values()) clearTimeout(t);
    this.writers.clear();
    await Promise.all(
      Array.from(this.cache.keys()).map((id) => this.flush(id)),
    );
  }

  private file(widgetId: string): string {
    return widgetFile(this.root, widgetId, "store.json");
  }

  async get(widgetId: string, key: string): Promise<unknown> {
    const obj = await this.load(widgetId);
    return obj[key];
  }

  async set(widgetId: string, key: string, value: unknown): Promise<void> {
    const obj = await this.load(widgetId);
    obj[key] = value;
    this.schedule(widgetId);
  }

  async del(widgetId: string, key: string): Promise<void> {
    const obj = await this.load(widgetId);
    delete obj[key];
    this.schedule(widgetId);
  }

  async keys(widgetId: string): Promise<string[]> {
    const obj = await this.load(widgetId);
    return Object.keys(obj);
  }

  async keysWithPrefix(widgetId: string, prefix: string): Promise<string[]> {
    const obj = await this.load(widgetId);
    return Object.keys(obj).filter((k) => k.startsWith(prefix));
  }
}
