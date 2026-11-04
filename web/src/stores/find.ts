// The search (F479), as it goes: what it is doing, the words in its box (what you said or typed, what you just
// added, words that may be misheard), what it found last (shown while it listens or searches again), the kind shown;
// on the desktop also the project and status it is narrowed to and the highlighted row. On the phone it lives while
// the search page is open, and whatever page a result opens: Back comes back to it as you left it; on the desktop its
// words and what they found stay for the next ⌘K.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { FindAnswer, FindKind, FindPhase } from '../model/find'
import type { HeardFile } from '../model/doubts'

export interface FindState {
  phase: FindPhase
  /** the words in the box */
  words: string
  /** the words just added, lit at their end until you change them */
  added: string
  /** the voice notes the words came from, with the words that may be misheard */
  heard: HeardFile[]
  /** what it found last */
  answer: FindAnswer | null
  kind: FindKind | 'all'
  /** the desktop: only this project's, only open or finished items and rules */
  project: string | null
  status: FindStatus | null
  /** the desktop: the highlighted row */
  sel: number
  /** the desktop: what is said next takes the words' place (they were all selected) */
  replace: boolean
  /** words typed since it last searched: the up arrow searches them */
  typed: boolean
  /** the recording: how long, how loud lately */
  ms: number
  levels: readonly number[]
  set(p: Partial<Omit<FindState, 'set' | 'reset'>>): void
  tick(ms: number, level: number): void
  reset(): void
}

export type FindStore = StoreApi<FindState>
export type FindStatus = 'open' | 'finished'

const START = { phase: 'ready' as FindPhase, words: '', added: '', heard: [], answer: null, kind: 'all' as const, project: null, status: null, sel: 0, replace: false, typed: false, ms: 0, levels: [] }

export function createFindStore(): FindStore {
  return createStore<FindState>()((set) => ({
    ...START,
    set: (p) => set(p),
    tick: (ms, level) => set((s) => ({ ms, levels: [...s.levels, level].slice(-40) })),
    reset: () => set(START),
  }))
}
