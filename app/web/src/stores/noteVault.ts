// Voice notes (and files not up yet) kept in this browser until Taska has them, with their audio, so a reload or a
// closed tab never loses one: IndexedDB "taska-voice", store "notes", one record per note, in the format pages have
// always kept them in. A browser with no storage here (a private window) still records; nothing is kept.

import type { Doubt } from '../model/types'

export interface KeptNote {
  id: string
  project: string
  /** the draft it is in ("new", "B12", "doc 4", "edit r12"...) */
  key: string | null
  scope: string | null
  name: string
  mime: string
  ms: number
  t: number
  data: ArrayBuffer
  /** its file on the server, once up */
  f: string | null
  /** its words (null: not worked out yet) */
  tr: string | null
  tr_error: string
  doubts: Doubt[]
  /** its words as put in the draft */
  added: string | null
  /** sent: the input it goes with, which goes again after a reload */
  job: { id: string; text: string } | null
  vc: string | null
  /** a picture or another file: no words to wait for */
  plain?: boolean
}

export interface NoteVault {
  put(n: KeptNote): Promise<void>
  del(id: string): Promise<void>
  all(): Promise<KeptNote[]>
}

export function browserVault(): NoteVault {
  let db: Promise<IDBDatabase> | null = null
  const open = () =>
    (db ||= new Promise((ok, no) => {
      const r = indexedDB.open('taska-voice', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' })
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    }))
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
    try {
      const d = await open()
      return await new Promise<T>((ok, no) => {
        const t = d.transaction('notes', mode)
        const q = fn(t.objectStore('notes'))
        t.oncomplete = () => ok(q.result)
        t.onerror = t.onabort = () => no(t.error)
      })
    } catch {
      return null
    }
  }
  return {
    put: async (n) => void (await run('readwrite', (s) => s.put(n))),
    del: async (id) => void (await run('readwrite', (s) => s.delete(id))),
    all: async () => ((await run('readonly', (s) => s.getAll())) || []) as KeptNote[],
  }
}

export function memoryVault(): NoteVault {
  const m = new Map<string, KeptNote>()
  return {
    put: async (n) => void m.set(n.id, n),
    del: async (id) => void m.delete(id),
    all: async () => [...m.values()],
  }
}
