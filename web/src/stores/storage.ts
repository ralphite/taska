// This browser's own small store (localStorage), behind an interface: a browser with no storage (a private window)
// works as before, only nothing is kept over a reload; tests and stories use a store in memory.

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string | null): void
  getJson<T>(key: string): T | null
  setJson(key: string, value: unknown): void
  keys(): string[]
  /** another tab of this browser changed a key (`fn` gets its name); returns how to stop */
  onChange?(fn: (key: string) => void): () => void
  /** a write this browser refused (its storage full, or cleared by the system): `fn` gets the key and why (T806 #3:
   * the page's log, so a draft not kept is not lost unnoticed); returns how to stop */
  onRefused?(fn: Refused): () => void
}

export type Refused = (where: string, why: string) => void

/** Listeners for refused writes, and how to tell them (a store's own, not the module's). */
export function refusals(): { on(fn: Refused): () => void; tell(where: string, e: unknown): void } {
  const fns = new Set<Refused>()
  return {
    on: (fn) => {
      fns.add(fn)
      return () => void fns.delete(fn)
    },
    tell: (where, e) => {
      for (const fn of fns) fn(where, `${(e as Error)?.name || 'Error'}: ${(e as Error)?.message || String(e)}`.slice(0, 200))
    },
  }
}

/** `session`: this tab's own store (sessionStorage), gone when the tab closes. */
export function browserStore(kind: 'local' | 'session' = 'local'): KeyValueStore {
  const refused = refusals()
  const ls = (): Storage | null => {
    try {
      if (kind === 'session') return typeof sessionStorage === 'undefined' ? null : sessionStorage
      return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      return null
    }
  }
  return {
    onRefused: refused.on,
    get: (key) => {
      try {
        return ls()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    set: (key, value) => {
      try {
        if (value == null) ls()?.removeItem(key)
        else ls()?.setItem(key, value)
      } catch (e) {
        refused.tell(key, e) // no storage here works as before; one that refuses is told
      }
    },
    getJson<T>(key: string): T | null {
      try {
        return JSON.parse(ls()?.getItem(key) || 'null') as T | null
      } catch {
        return null
      }
    },
    setJson: (key, value) => {
      try {
        if (value == null) ls()?.removeItem(key)
        else ls()?.setItem(key, JSON.stringify(value))
      } catch (e) {
        refused.tell(key, e)
      }
    },
    keys: () => {
      const s = ls()
      if (!s) return []
      const out: string[] = []
      try {
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i)
          if (k) out.push(k)
        }
      } catch {
        /* no storage */
      }
      return out
    },
    ...(kind === 'local' && typeof addEventListener !== 'undefined'
      ? {
          onChange: (fn: (key: string) => void) => {
            const on = (e: StorageEvent) => {
              if (e.key && e.storageArea === ls()) fn(e.key)
            }
            addEventListener('storage', on)
            return () => removeEventListener('storage', on)
          },
        }
      : {}),
  }
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(initial))
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => (v == null ? m.delete(k) : m.set(k, v), undefined),
    getJson: <T,>(k: string) => {
      try {
        return JSON.parse(m.get(k) || 'null') as T | null
      } catch {
        return null
      }
    },
    setJson: (k, v) => (v == null ? m.delete(k) : m.set(k, JSON.stringify(v)), undefined),
    keys: () => [...m.keys()],
  }
}
