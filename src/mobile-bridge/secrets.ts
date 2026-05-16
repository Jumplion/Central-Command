function key(namespace: string, k: string): string {
  return `secrets:${namespace}:${k}`;
}

export const secretsApi = {
  get(namespace: string, k: string): Promise<string | null> {
    return Promise.resolve(localStorage.getItem(key(namespace, k)));
  },

  set(namespace: string, k: string, value: string): Promise<void> {
    localStorage.setItem(key(namespace, k), value);
    return Promise.resolve();
  },

  del(namespace: string, k: string): Promise<void> {
    localStorage.removeItem(key(namespace, k));
    return Promise.resolve();
  },

  has(namespace: string, k: string): Promise<boolean> {
    return Promise.resolve(localStorage.getItem(key(namespace, k)) !== null);
  },
};
