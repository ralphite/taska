// The copy of each project kept in this browser (IndexedDB), so opening a project again draws at once from it while
// the server's newest view comes. A slow or missing store never holds the page up.

import type { ServerCopy } from '../model/project'

export interface CopyCache {
  get(slug: string): Promise<ServerCopy | null>
  put(slug: string, copy: ServerCopy): void
}

interface Stored {
  cursor: string
  items: ServerCopy['items'] extends ReadonlyMap<number, infer I> ? I[] : never
  inputs: ServerCopy['inputs'] extends ReadonlyMap<string, infer I> ? I[] : never
  docs: ServerCopy['docs'] extends ReadonlyMap<number, infer D> ? D[] : never
  facts: ServerCopy['facts']
  server: ServerCopy['server']
}

const DB = 'taska-view'
const STORE = 'copies'

export class BrowserCopyCache implements CopyCache {
  private db: Promise<IDBDatabase> | null = null
  private timers = new Map<string, number>()

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
      if (!s) return null
      return {
        cursor: s.cursor,
        items: new Map(s.items.map((x) => [x.n, x])),
        inputs: new Map(s.inputs.map((x) => [x.id, x])),
        docs: new Map(s.docs.map((x) => [x.d, x])),
        facts: s.facts,
        server: s.server,
      }
    } catch {
      return null
    }
  }

  put(slug: string, copy: ServerCopy): void {
    if (typeof indexedDB === 'undefined') return
    clearTimeout(this.timers.get(slug))
    this.timers.set(
      slug,
      window.setTimeout(async () => {
        const stored: Stored = {
          cursor: copy.cursor,
          items: [...copy.items.values()],
          inputs: [...copy.inputs.values()],
          docs: [...copy.docs.values()],
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

export const noCache: CopyCache = { get: async () => null, put: () => {} }
