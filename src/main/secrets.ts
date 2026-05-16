import { safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assertValidWidgetId } from '@shared/validation';

export class SecretsStore {
  private cache = new Map<string, Record<string, string>>();
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private available: boolean;

  constructor(private root: string) {
    this.available = safeStorage.isEncryptionAvailable();
    if (!this.available) {
      console.warn(
        '[secrets] safeStorage encryption is unavailable; secrets are stored with base64 encoding only. ' +
          'Avoid storing sensitive data on headless or shared systems.'
      );
    }
  }

  private dir(): string {
    return path.join(this.root, 'secrets');
  }

  private file(namespace: string): string {
    return path.join(this.dir(), `${namespace}.json`);
  }

  private encrypt(value: string): string {
    if (this.available) {
      return safeStorage.encryptString(value).toString('base64');
    }
    return Buffer.from(value, 'utf-8').toString('base64');
  }

  private decrypt(stored: string): string {
    const buf = Buffer.from(stored, 'base64');
    if (this.available) {
      return safeStorage.decryptString(buf);
    }
    return buf.toString('utf-8');
  }

  private async load(namespace: string): Promise<Record<string, string>> {
    assertValidWidgetId(namespace);
    const cached = this.cache.get(namespace);
    if (cached) return cached;
    try {
      const text = await fs.readFile(this.file(namespace), 'utf-8');
      const parsed: unknown = JSON.parse(text);
      const obj =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, string>)
          : {};
      this.cache.set(namespace, obj);
      return obj;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        const obj: Record<string, string> = {};
        this.cache.set(namespace, obj);
        return obj;
      }
      throw err;
    }
  }

  private async save(namespace: string): Promise<void> {
    const obj = this.cache.get(namespace);
    if (!obj) return;
    const dir = this.dir();
    await fs.mkdir(dir, { recursive: true });
    const file = this.file(namespace);
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(obj), 'utf-8');
    await fs.rename(tmp, file);
  }

  private scheduleSave(namespace: string): void {
    const existing = this.saveTimers.get(namespace);
    if (existing) clearTimeout(existing);
    this.saveTimers.set(namespace, setTimeout(() => {
      this.saveTimers.delete(namespace);
      void this.save(namespace);
    }, 200));
  }

  async get(namespace: string, key: string): Promise<string | null> {
    const obj = await this.load(namespace);
    const val = obj[key];
    if (val === undefined) return null;
    try {
      return this.decrypt(val);
    } catch {
      return null;
    }
  }

  async set(namespace: string, key: string, value: string): Promise<void> {
    const obj = await this.load(namespace);
    obj[key] = this.encrypt(value);
    this.scheduleSave(namespace);
  }

  async del(namespace: string, key: string): Promise<void> {
    const obj = await this.load(namespace);
    delete obj[key];
    this.scheduleSave(namespace);
  }

  async has(namespace: string, key: string): Promise<boolean> {
    const obj = await this.load(namespace);
    return key in obj;
  }
}
