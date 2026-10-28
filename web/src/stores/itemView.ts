// What you are doing on an item's page that the address does not say: the talks shown whole (Show earlier), the long
// messages opened, the hidden messages shown for a moment, the decision or answer being chosen again, the item being
// edited, the subitem being added, and the choices picked in an open question (kept by their words over a reload,
// as taska.choice.<project>).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export interface Choice {
  n: number
  picked: ReadonlySet<number>
}

export interface ItemViewState {
  slug: string
  talkAll: ReadonlySet<number>
  opened: ReadonlySet<number>
  peeking: ReadonlySet<number>
  remodify: number | null
  reask: number | null
  editing: number | null
  subFor: number | null
  choice: Choice | null
  /** the choices picked before a reload, by their words */
  kept: { n: number; labels: string[] } | null
  /** a project shown: what was kept for it comes back */
  show(slug: string): void
  showAll(n: number): void
  toggleOpened(id: number): void
  peek(id: number): void
  setRemodify(n: number | null): void
  /** picking a choice of item n's question; `labels` are the question's choices, to keep them by their words */
  pick(n: number, i: number, multi: boolean, from: ReadonlySet<number>, labels: readonly string[]): void
  startReask(id: number, choice: Choice): void
  endAnswer(): void
  setEditing(n: number | null): void
  setSubFor(n: number | null): void
}

export type ItemViewStore = StoreApi<ItemViewState>

const key = (slug: string) => 'taska.choice.' + slug

export function createItemViewStore(kv: KeyValueStore): ItemViewStore {
  const kept = (slug: string) => {
    const x = kv.getJson<{ n: number; picked: string[] }>(key(slug))
    return x && typeof x.n === 'number' && Array.isArray(x.picked) ? { n: x.n, labels: x.picked } : null
  }
  const keep = (slug: string, c: Choice | null, labels: readonly string[]) => {
    if (c?.picked.size) kv.setJson(key(slug), { n: c.n, picked: [...c.picked].map((i) => labels[i]).filter(Boolean) })
    else kv.set(key(slug), null)
  }
  return createStore<ItemViewState>()((set, get) => ({
    slug: '',
    talkAll: new Set(),
    opened: new Set(),
    peeking: new Set(),
    remodify: null,
    reask: null,
    editing: null,
    subFor: null,
    choice: null,
    kept: null,
    show: (slug) => {
      if (get().slug === slug) return
      set({ slug, talkAll: new Set(), opened: new Set(), peeking: new Set(), remodify: null, reask: null, editing: null, subFor: null, choice: null, kept: kept(slug) })
    },
    showAll: (n) => set((s) => ({ talkAll: new Set([...s.talkAll, n]) })),
    toggleOpened: (id) =>
      set((s) => {
        const opened = new Set(s.opened)
        if (opened.has(id)) opened.delete(id)
        else opened.add(id)
        return { opened }
      }),
    peek: (id) => set((s) => ({ peeking: new Set([...s.peeking, id]) })),
    setRemodify: (remodify) => set({ remodify }),
    pick: (n, i, multi, from, labels) => {
      const picked = new Set(from)
      if (multi) {
        if (picked.has(i)) picked.delete(i)
        else picked.add(i)
      } else {
        picked.clear()
        picked.add(i)
      }
      const choice = { n, picked }
      keep(get().slug, choice, labels)
      set({ choice, kept: null })
    },
    startReask: (reask, choice) => set({ reask, choice }),
    endAnswer: () => {
      keep(get().slug, null, [])
      set({ choice: null, reask: null, kept: null })
    },
    setEditing: (editing) => set({ editing }),
    setSubFor: (subFor) => set({ subFor }),
  }))
}
