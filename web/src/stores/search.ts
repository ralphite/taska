// The search in the other projects: the words asked, what came back (null while it is asked), whether it failed, and
// the last answer whatever its words (shown while the next is asked, as on the home page).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { SearchHit } from '../model/types'

export interface SearchState {
  q: string
  list: SearchHit[] | null
  failed: boolean
  last: SearchHit[] | null
  asked(q: string): void
  answered(q: string, list: SearchHit[] | null, failed: boolean): void
}

export type SearchStore = StoreApi<SearchState>

export function createSearchStore(): SearchStore {
  return createStore<SearchState>()((set, get) => ({
    q: '',
    list: null,
    failed: false,
    last: null,
    asked: (q) => set({ q, list: null, failed: false }),
    answered: (q, list, failed) => {
      if (get().q === q) set({ list, failed, last: list ?? [] })
    },
  }))
}
