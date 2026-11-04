// The items and documents you opened lately, for the desktop search's Recent (F479): newest first, at most 12, each
// as it was when you opened it (its words show while its project's data is not here). Kept in this browser
// ("taska.recent").

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ItemType, Status } from '../model/types'
import type { KeyValueStore } from './storage'

export interface Visit {
  project: string
  kind: 'items' | 'docs'
  /** the item, or the document's item */
  n: number
  /** the document */
  d?: number
  code: string
  title: string
  /** an item's type and status; a document's item's code */
  type?: ItemType
  status?: Status
  on?: string
}

const KEY = 'taska.recent'
const MOST = 12
const same = (a: Visit, b: Visit) => a.project === b.project && a.kind === b.kind && (a.kind === 'docs' ? a.d === b.d : a.n === b.n)

export interface RecentState {
  list: readonly Visit[]
  saw(v: Visit): void
}

export type RecentStore = StoreApi<RecentState>

export function createRecentStore(kv: KeyValueStore): RecentStore {
  return createStore<RecentState>()((set, get) => ({
    list: kv.getJson<Visit[]>(KEY) ?? [],
    saw: (v) => {
      const was = get().list
      if (was[0] && same(was[0], v) && was[0].title === v.title && was[0].status === v.status) return
      const list = [v, ...was.filter((x) => !same(x, v))].slice(0, MOST)
      kv.setJson(KEY, list)
      set({ list })
    },
  }))
}
