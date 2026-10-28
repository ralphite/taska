// Speaking into a document being edited: the recording going on (the mark that holds its place, the draft it is
// for, how long it has run) and the voice notes whose words are still being worked out.

import { createStore, type StoreApi } from 'zustand/vanilla'

export interface DictationState {
  /** recording: the mark its words will replace, the document's draft ("D12", "new 4") */
  rec: { mark: string; key: string; ms: number } | null
  /** voice notes stopped, their words not here yet (`key` null: discarded with the editor) */
  waiting: readonly { mark: string; key: string | null }[]
  start(mark: string, key: string): void
  tick(ms: number): void
  stop(): void
  wait(mark: string, key: string | null): void
  done(mark: string): void
  /** the editor was discarded: the words it waits for go nowhere */
  drop(key: string): void
}

export type DictationStore = StoreApi<DictationState>

export function createDictationStore(): DictationStore {
  return createStore<DictationState>()((set) => ({
    rec: null,
    waiting: [],
    start: (mark, key) => set({ rec: { mark, key, ms: 0 } }),
    tick: (ms) => set((s) => (s.rec ? { rec: { ...s.rec, ms } } : s)),
    stop: () => set({ rec: null }),
    wait: (mark, key) => set((s) => ({ waiting: [...s.waiting, { mark, key }] })),
    done: (mark) => set((s) => ({ waiting: s.waiting.filter((w) => w.mark !== mark) })),
    drop: (key) => set((s) => ({ waiting: s.waiting.map((w) => (w.key === key ? { ...w, key: null } : w)) })),
  }))
}
