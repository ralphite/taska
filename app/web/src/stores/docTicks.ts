// The choices you ticked in documents and did not send yet, and those on their way: kept in this browser across
// reloads, per project, until they are in the document. And the sent forms you opened to change again.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { TickState } from '../model/docTicks'
import type { KeyValueStore } from './storage'

type Map2 = Record<number, Record<string, string>>

export interface DocTicksState extends TickState {
  slug: string
  show(slug: string): void
  /** a paragraph's words as you ticked them now (its own words: nothing waits) */
  set(d: number, k: string, text: string | null): void
  /** sent: shown ticked while on their way, no longer waiting */
  sentOff(d: number, sent: Record<string, string>): void
  /** in the document (ok), or not: then they wait again */
  done(d: number, sent: Record<string, string>, ok: boolean): void
  clear(d: number): void
  reopen(d: number, k: string): void
}

export type DocTicksStore = StoreApi<DocTicksState>

const live = (m: Map2) => Object.fromEntries(Object.entries(m).filter(([, v]) => Object.keys(v).length))

export function createDocTicksStore(kv: KeyValueStore): DocTicksStore {
  const keep = (slug: string, mine: Map2, going: Map2) => {
    kv.setJson('taska.docticks.' + slug, Object.keys(live(mine)).length ? live(mine) : null)
    kv.setJson('taska.docticks.' + slug + '.going', Object.keys(live(going)).length ? live(going) : null)
  }
  return createStore<DocTicksState>()((set, get) => {
    const put = (mine: Map2, going: Map2) => {
      set({ mine, going })
      keep(get().slug, mine, going)
    }
    return {
      slug: '',
      mine: {},
      going: {},
      open: new Set(),
      show: (slug) => {
        if (slug === get().slug) return
        set({ slug, mine: kv.getJson<Map2>('taska.docticks.' + slug) || {}, going: kv.getJson<Map2>('taska.docticks.' + slug + '.going') || {}, open: new Set() })
      },
      set: (d, k, text) => {
        const of = { ...get().mine[d] }
        if (text == null) delete of[k]
        else of[k] = text
        put({ ...get().mine, [d]: of }, get().going as Map2)
      },
      sentOff: (d, sent) => {
        const of = { ...get().mine[d] }
        for (const [k, v] of Object.entries(sent)) if (of[k] === v) delete of[k]
        put({ ...get().mine, [d]: of }, { ...get().going, [d]: { ...get().going[d], ...sent } })
      },
      done: (d, sent, ok) => {
        const of = { ...get().mine[d] }
        if (!ok) for (const [k, v] of Object.entries(sent)) of[k] ??= v
        const going = { ...get().going[d] }
        const open = new Set(get().open)
        for (const k of Object.keys(sent)) {
          delete going[k]
          if (ok) open.delete(`${d} ${k}`)
        }
        set({ open })
        put({ ...get().mine, [d]: of }, { ...get().going, [d]: going })
      },
      clear: (d) => put({ ...get().mine, [d]: {} }, get().going as Map2),
      reopen: (d, k) => set({ open: new Set([...get().open, `${d} ${k}`]) }),
    }
  })
}
