import { Preferences } from '@capacitor/preferences';

function key(namespace: string, k: string): string {
  return `secrets:${namespace}:${k}`;
}

export const secretsApi = {
  async get(namespace: string, k: string): Promise<string | null> {
    const { value } = await Preferences.get({ key: key(namespace, k) });
    return value;
  },

  async set(namespace: string, k: string, value: string): Promise<void> {
    await Preferences.set({ key: key(namespace, k), value });
  },

  async del(namespace: string, k: string): Promise<void> {
    await Preferences.remove({ key: key(namespace, k) });
  },

  async has(namespace: string, k: string): Promise<boolean> {
    const { value } = await Preferences.get({ key: key(namespace, k) });
    return value !== null;
  },
};
