// What you began to write, kept by what it is written to (a new input "new", a reply on an item "B03", a comment
// "doc 4", an edit "edit r12" ...), per project, in this browser ("taska.drafts.<project>": {key: text}), so unsent
// words never go elsewhere and survive a reload. Every tab of this browser shows the same drafts.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'
import type { DraftKey } from '../model/draftTarget'

export interface DraftsState {
  bySlug: Record<string, Record<string, string>>
  of(slug: string): Record<string, string>
  set(slug: string, key: DraftKey, text: string): void
  /** another tab changed them */
  reload(slug: string): void
}

export type DraftsStore = StoreApi<DraftsState>

const KEY = 'taska.drafts.'

export function createDraftsStore(kv: KeyValueStore): DraftsStore {
  const read = (slug: string) => kv.getJson<Record<string, string>>(KEY + slug) || {}
  return createStore<DraftsState>()((set, get) => ({
    bySlug: {},
    of: (slug) => get().bySlug[slug] ?? read(slug),
    set: (slug, key, text) => {
      const all = { ...get().of(slug) }
      if (text.trim()) all[key] = text
      else delete all[key]
      kv.setJson(KEY + slug, all)
      set((s) => ({ bySlug: { ...s.bySlug, [slug]: all } }))
    },
    reload: (slug) => set((s) => ({ bySlug: { ...s.bySlug, [slug]: read(slug) } })),
  }))
}
