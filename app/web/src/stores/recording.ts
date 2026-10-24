// A voice note being recorded: where it goes (the project, the draft it was started in, the item it replies on),
// which mic started it, how long it has run and how loud it was lately (for the box's bar).

import { createStore, type StoreApi } from 'zustand/vanilla'

export interface Recording {
  slug: string
  /** the draft it goes into when it stops, wherever you are then */
  key: string
  scope: string | null
  from: 'main' | 'aux'
  ms: number
  levels: readonly number[]
}

export interface RecordingState {
  rec: Recording | null
  start(r: Omit<Recording, 'ms' | 'levels'>): void
  tick(ms: number, level: number): void
  stop(): void
}

export type RecordingStore = StoreApi<RecordingState>

export function createRecordingStore(): RecordingStore {
  return createStore<RecordingState>()((set) => ({
    rec: null,
    start: (r) => set({ rec: { ...r, ms: 0, levels: [] } }),
    tick: (ms, level) => set((s) => (s.rec ? { rec: { ...s.rec, ms, levels: [...s.rec.levels, level].slice(-40) } } : s)),
    stop: () => set({ rec: null }),
  }))
}
