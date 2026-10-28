// What you typed in an item's editor and in its subitem title and did not save, kept in this browser per project
// ("taska.edits.<project>": {n: {title, body, next}}, "taska.subs.<project>": {n: title}): leaving them any way but
// Cancel keeps it, and they bring it back.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export interface ItemEditDraft {
  title: string
  body: string
  next: string
}

export interface KeptEditsState {
  slug: string
  edits: Readonly<Record<number, ItemEditDraft>>
  subs: Readonly<Record<number, string>>
  /** a project shown: what was kept for it */
  show(slug: string): void
  /** null: nothing kept */
  setEdit(n: number, d: ItemEditDraft | null): void
  setSub(n: number, title: string | null): void
}

export type KeptEditsStore = StoreApi<KeptEditsState>

export function createKeptEditsStore(kv: KeyValueStore): KeptEditsStore {
  const read = <T,>(kind: string, slug: string) => (slug ? kv.getJson<Record<number, T>>(`taska.${kind}.${slug}`) || {} : {})
  return createStore<KeptEditsState>()((set, get) => {
    const put = <T,>(kind: 'edits' | 'subs', n: number, v: T | null) => {
      const { slug } = get()
      if (!slug) return
      const all: Record<number, T> = { ...(get()[kind] as Record<number, T>) }
      if (v == null) delete all[n]
      else all[n] = v
      kv.setJson(`taska.${kind}.${slug}`, all)
      set({ [kind]: all } as Partial<KeptEditsState>)
    }
    return {
      slug: '',
      edits: {},
      subs: {},
      show: (slug) => set({ slug, edits: read<ItemEditDraft>('edits', slug), subs: read<string>('subs', slug) }),
      setEdit: (n, d) => put('edits', n, d),
      setSub: (n, title) => put('subs', n, title),
    }
  })
}
