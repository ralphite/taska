// Searching the other projects for the list's search words: a while after you stop typing, once per words.

import type { TaskaApi } from '../api/taska'
import type { SearchStore } from '../stores/search'

export class CrossSearch {
  private readonly api: TaskaApi
  private readonly store: SearchStore
  private timer = 0
  constructor(api: TaskaApi, store: SearchStore) {
    this.api = api
    this.store = store
  }

  /** The words the list searches now, in project `slug` (the others are searched). */
  want(q: string, slug: string): void {
    if (q === this.store.getState().q) return
    this.store.getState().asked(q)
    clearTimeout(this.timer)
    if (!q) return
    this.timer = window.setTimeout(async () => {
      try {
        this.store.getState().answered(q, await this.api.search(q, slug), false)
      } catch {
        this.store.getState().answered(q, null, true)
      }
    }, 300)
  }
}
