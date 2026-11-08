// The search across the projects (the home page's): the words asked and where the search is (T728 #7): one phase,
// so the page cannot show "No matches" for a search Taska refused or could not be reached for. `hits`: the last
// answer, kept (faded) while the next words are asked.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { SearchHit, SearchPhase } from '../model/types'

export interface SearchState {
  q: string
  phase: SearchPhase
  hits: SearchHit[] | null
  asked(q: string): void
  /** Taska out of reach while `q` is asked: it is asked again */
  retrying(q: string): void
  answered(q: string, list: SearchHit[]): void
  refused(q: string): void
}

export type SearchStore = StoreApi<SearchState>

export function createSearchStore(): SearchStore {
  return createStore<SearchState>()((set, get) => ({
    q: '',
    phase: 'idle',
    hits: null,
    asked: (q) => set({ q, phase: q ? 'asking' : 'idle' }),
    retrying: (q) => {
      if (get().q === q) set({ phase: 'retrying' })
    },
    answered: (q, list) => {
      if (get().q === q) set({ phase: 'answered', hits: list })
    },
    refused: (q) => {
      if (get().q === q) set({ phase: 'failed' })
    },
  }))
}
