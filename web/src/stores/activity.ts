// The open project's change log as far as it was loaded: the latest first, whether the first change is in it, whether
// earlier ones are on their way, and which version of the project it was loaded for.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { LogRow } from '../model/types'

export interface ActivityState {
  slug: string
  /** null: not loaded yet */
  rows: LogRow[] | null
  /** the first change is loaded: nothing earlier to ask for */
  end: boolean
  /** earlier changes on their way */
  more: boolean
  /** the project's version the rows were asked for */
  cursor: string
  loaded(slug: string, rows: LogRow[], end: boolean, cursor: string): void
  setMore(on: boolean): void
}

export type ActivityStore = StoreApi<ActivityState>

export function createActivityStore(): ActivityStore {
  return createStore<ActivityState>()((set) => ({
    slug: '',
    rows: null,
    end: false,
    more: false,
    cursor: '',
    loaded: (slug, rows, end, cursor) => set({ slug, rows, end, cursor }),
    setMore: (more) => set({ more }),
  }))
}
