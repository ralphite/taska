// The search in the other projects: the words asked, what came back (null while it is asked), whether it failed.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { SearchHit } from '../model/types'

export interface SearchState {
  q: string
  list: SearchHit[] | null
  failed: boolean
  asked(q: string): void
  answered(q: string, list: SearchHit[] | null, failed: boolean): void
}

export type SearchStore = StoreApi<SearchState>

export function createSearchStore(): SearchStore {
  return createStore<SearchState>()((set, get) => ({
    q: '',
    list: null,
    failed: false,
    asked: (q) => set({ q, list: null, failed: false }),
    answered: (q, list, failed) => {
      if (get().q === q) set({ list, failed })
    },
  }))
}
