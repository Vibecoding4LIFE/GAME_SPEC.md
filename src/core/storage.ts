// src/core/storage.ts – kleiner Speicher-Adapter für den Browser (localStorage), mit Fallback im Arbeitsspeicher.
// Asynchrone Schnittstelle, damit später IndexedDB dahinter stehen kann, ohne die Aufrufer zu ändern.
// Fehler (privater Modus, Speicher voll, gesperrter Zugriff) werden geschluckt; dann bleibt der Stand nur bis zum Neuladen.

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  /** false = es wird nur im Arbeitsspeicher gehalten */
  readonly persistent: boolean;
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    persistent: false,
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v); return true; },
    remove: async (k) => { m.delete(k); },
  };
}

/** localStorage, falls nutzbar (Schreibtest), sonst Arbeitsspeicher. */
export function createStore(prefix = 'ctd:'): KeyValueStore {
  const probeStore = (): Storage | null => {
    try {
      const s = typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
      if (!s) return null;
      const probe = `${prefix}__probe`;
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch {
      return null;
    }
  };
  const ls = probeStore();
  if (!ls) return memoryStore();
  const store = ls;
  const fallback = memoryStore();
  return {
    persistent: true,
    async get(k) {
      try { return store.getItem(prefix + k) ?? (await fallback.get(k)); } catch { return fallback.get(k); }
    },
    async set(k, v) {
      try { store.setItem(prefix + k, v); return true; } catch { await fallback.set(k, v); return false; }
    },
    async remove(k) {
      try { store.removeItem(prefix + k); } catch { /* egal */ }
      await fallback.remove(k);
    },
  };
}
