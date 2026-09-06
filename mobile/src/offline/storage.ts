interface KvStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memory = new Map<string, string>();

function webStore(): KvStore | null {
  const g = globalThis as unknown as { localStorage?: KvStore };
  return g.localStorage ?? null;
}

/** Clé/valeur : `localStorage` sur web, mémoire par session sur natif (comme `token.ts`). */
export const storage: KvStore = {
  getItem(key) {
    const store = webStore();
    if (store) return store.getItem(key);
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    const store = webStore();
    if (store) store.setItem(key, value);
    else memory.set(key, value);
  },
  removeItem(key) {
    const store = webStore();
    if (store) store.removeItem(key);
    else memory.delete(key);
  },
};