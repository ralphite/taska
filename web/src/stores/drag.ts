// An item being dragged (the desktop, with a mouse): which, and where it would go: before, after or under a row of
// the list, out from under its parent, or into another project in the sidebar.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DropHow } from '../model/items'

export interface DragState {
  n: number | null
  at: { n?: number; how: DropHow } | null
  project: string | null
  set(p: Partial<Pick<DragState, 'n' | 'at' | 'project'>>): void
}

export type DragStore = StoreApi<DragState>

export function createDragStore(): DragStore {
  return createStore<DragState>()((set) => ({
    n: null,
    at: null,
    project: null,
    set: (p) => set(p),
  }))
}
