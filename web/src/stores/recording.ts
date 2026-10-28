// A voice note being recorded: where it goes (the project, the draft it was started in, the item it replies on),
// which mic started it, how long it has run and how loud it was lately (for the box's bar).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DraftKey } from '../model/draftTarget'

export interface Recording {
  slug: string
  /** the draft it goes into when it stops, wherever you are then */
  key: DraftKey
  scope: string | null
  from: 'main' | 'aux'
  /** a voice comment: what it is about (a document's passage, or words selected elsewhere); `bar`: started from the
   * bar on the selection (it stays there to stop it), not a paragraph's own mic */
  about?: { d: number | null; key: string | null; quote: string; bar: boolean } | null
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
