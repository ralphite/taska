// This browser's own small store (localStorage), behind an interface: a browser with no storage (a private window)
// works as before, only nothing is kept over a reload; tests and stories use a store in memory.

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string | null): void
  getJson<T>(key: string): T | null
  setJson(key: string, value: unknown): void
  keys(): string[]
}

export function browserStore(): KeyValueStore {
  const ls = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      return null
    }
  }
  return {
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
      } catch {
        /* no storage here */
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
      } catch {
        /* no storage here */
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
