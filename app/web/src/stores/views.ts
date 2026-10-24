// Your own views of the item list (kept with Taska, the same in every project), and the one being renamed.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { SavedView } from '../model/types'

export interface ViewsState {
  list: readonly SavedView[]
  /** the view whose name is being edited in the row (-1: none) */
  edit: number
  set(list: readonly SavedView[]): void
  setEdit(i: number): void
}

export type ViewsStore = StoreApi<ViewsState>

export function createViewsStore(): ViewsStore {
  return createStore<ViewsState>()((set) => ({
    list: [],
    edit: -1,
    set: (list) => set({ list }),
    setEdit: (edit) => set({ edit }),
  }))
}
