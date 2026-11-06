// Searching every project for the home page's search words: a while after you stop typing, once per words; out of
// reach, asked again until Taska answers or the words change (T424).

import { Abandoned, untilAnswered } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import type { SearchStore } from '../../stores/search'

export class CrossSearch {
  private readonly api: TaskaApi
  private readonly store: SearchStore
  private timer = 0
  constructor(api: TaskaApi, store: SearchStore) {
    this.api = api
    this.store = store
  }

  /** The words searched now, from project `slug` (the others are searched; '': every project). */
  want(q: string, slug: string, wait = 300): void {
    if (q === this.store.getState().q) return
    this.store.getState().asked(q)
    clearTimeout(this.timer)
    if (!q) return
    this.timer = window.setTimeout(async () => {
      const s = () => this.store.getState()
      const ask = () => (s().q === q ? this.api.search(q, slug) : Promise.reject(new Abandoned()))
      try {
        s().answered(q, await untilAnswered(ask, () => s().retrying(q)), false)
      } catch (ex) {
        if (!(ex instanceof Abandoned)) s().answered(q, null, true)
      }
    }, wait)
  }
}
