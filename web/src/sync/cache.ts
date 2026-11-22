// The copy of each project kept in this browser (IndexedDB), so opening a project again draws at once from it while
// the server's newest view comes. A slow or missing store never holds the page up. A copy is used only by the page
// build that kept it (T859): what the server sends changes with the page's code (T855's tasks had tags where they had a
// type), and a page drawing a copy an older build kept broke on what was not there, the whole page blank until a
// reload.

import type { ServerCopy } from '../model/project'

export interface CopyCache {
  get(slug: string): Promise<ServerCopy | null>
  put(slug: string, copy: ServerCopy): void
  /** none kept any more */
  forget(): Promise<void>
}

export interface Stored {
  /** the page build that kept it (its script's name) */
  build?: string
  cursor: string
  tasks: ServerCopy['tasks'] extends ReadonlyMap<number, infer I> ? I[] : never
  inputs: ServerCopy['inputs'] extends ReadonlyMap<string, infer I> ? I[] : never
  docs: ServerCopy['docs'] extends ReadonlyMap<number, infer D> ? D[] : never
  voices: ServerCopy['voices'] extends ReadonlyMap<string, infer V> ? V[] : never
  facts: ServerCopy['facts']
  server: ServerCopy['server']
}

const DB = 'taska-view'
const STORE = 'copies'

export class BrowserCopyCache implements CopyCache {
  private db: Promise<IDBDatabase> | null = null
  private timers = new Map<string, number>()
  private readonly build: string

  /** `build`: this page's build (its script's name); copies another build kept are not used */
  constructor(build: string) {
    this.build = build
  }

  private open(): Promise<IDBDatabase> {
    return (this.db ||= new Promise((ok, no) => {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(STORE)
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    }))
  }

  async get(slug: string): Promise<ServerCopy | null> {
    if (typeof indexedDB === 'undefined') return null
    const read = (async () => {
      const db = await this.open()
      return await new Promise<Stored | null>((ok) => {
        const q = db.transaction(STORE).objectStore(STORE).get(slug)
        q.onsuccess = () => ok((q.result as Stored) || null)
        q.onerror = () => ok(null)
      })
    })()
    try {
      const s = await Promise.race([read, new Promise<null>((ok) => setTimeout(() => ok(null), 300))])
      return keptCopy(s, this.build, Date.now())
    } catch {
      return null
    }
  }

  async forget(): Promise<void> {
    if (typeof indexedDB === 'undefined') return
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
    try {
      const db = await this.open()
      await new Promise<void>((ok) => {
        const t = db.transaction(STORE, 'readwrite')
        t.objectStore(STORE).clear()
        t.oncomplete = t.onerror = t.onabort = () => ok()
      })
    } catch {
      /* no store */
    }
  }

  put(slug: string, copy: ServerCopy): void {
    if (typeof indexedDB === 'undefined') return
    clearTimeout(this.timers.get(slug))
    this.timers.set(
      slug,
      window.setTimeout(async () => {
        const stored: Stored = {
          build: this.build,
          cursor: copy.cursor,
          tasks: [...copy.tasks.values()],
          inputs: [...copy.inputs.values()],
          docs: [...copy.docs.values()],
          voices: [...copy.voices.values()],
          facts: copy.facts,
          server: copy.server,
        }
        try {
          ;(await this.open()).transaction(STORE, 'readwrite').objectStore(STORE).put(stored, slug)
        } catch {
          /* no store */
        }
      }, 1500),
    )
  }
}

/** The copy kept, as the page holds it: none when this page's build did not keep it (T859). */
export function keptCopy(s: Stored | null, build: string, at: number): ServerCopy | null {
  if (!s || s.build !== build) return null
  return {
    cursor: s.cursor,
    tasks: new Map(s.tasks.map((x) => [x.n, x])),
    inputs: new Map(s.inputs.map((x) => [x.id, x])),
    docs: new Map(s.docs.map((x) => [x.d, x])),
    voices: new Map(s.voices.map((x) => [x.f, x])),
    facts: s.facts,
    server: s.server,
    at,
  }
}

export const noCache: CopyCache = { get: async () => null, put: () => {}, forget: async () => {} }
