// The search across the projects (the home page's): the words asked, what came back (null while it is asked),
// whether Taska refused it or is out of reach (asked again), and the last answer whatever its words (shown while the
// next is asked).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { SearchHit } from '../model/types'

export interface SearchState {
  q: string
  list: SearchHit[] | null
  failed: boolean
  waiting: boolean
  last: SearchHit[] | null
  asked(q: string): void
  /** Taska out of reach while `q` is asked: it is asked again */
  retrying(q: string): void
  answered(q: string, list: SearchHit[] | null, failed: boolean): void
}

export type SearchStore = StoreApi<SearchState>

export function createSearchStore(): SearchStore {
  return createStore<SearchState>()((set, get) => ({
    q: '',
    list: null,
    failed: false,
    waiting: false,
    last: null,
    asked: (q) => set({ q, list: null, failed: false, waiting: false }),
    retrying: (q) => {
      if (get().q === q) set({ waiting: true })
    },
    answered: (q, list, failed) => {
      if (get().q === q) set({ list, failed, waiting: false, last: list ?? [] })
    },
  }))
}
