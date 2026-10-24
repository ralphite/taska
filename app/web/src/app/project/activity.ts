// The change log, loaded as it is shown: the latest changes when it opens and after each change to the project (what
// is new goes on top, what was loaded below stays), earlier ones as you scroll to its end. What could not be loaded
// loads when Taska is back.

import type { TaskaApi } from '../../api/taska'
import type { LogRow } from '../../model/types'
import type { ActivityStore } from '../../stores/activity'
import type { Toasts } from '../page/toasts'

const FIRST = 60
const MORE = 100

export class Activity {
  private readonly d: { api: TaskaApi; store: ActivityStore; toasts: Toasts }
  private retry: (() => void) | null = null
  constructor(d: Activity['d']) {
    this.d = d
  }

  /** The log of `slug` as of project version `cursor` (asked again only when the project changed). */
  async show(slug: string, cursor: string): Promise<void> {
    const st = this.d.store.getState()
    if (st.slug === slug && st.cursor === cursor && st.rows) return
    try {
      const rows = await this.d.api.activity(slug, FIRST)
      const now = this.d.store.getState()
      const had = now.slug === slug ? now.rows : null
      const top = had?.length ? had[0].seq : 0
      const fresh = rows.filter((x) => x.seq > top)
      if (had?.length && fresh.length < rows.length) now.loaded(slug, [...fresh, ...had], now.end, cursor)
      else now.loaded(slug, rows, rows.length < FIRST, cursor) // the first time, or more came than this holds
      this.retry = null
    } catch {
      this.retry = () => void this.show(slug, cursor)
      this.d.toasts.show("Couldn't load the change log. Loads when Taska is back", null, { error: true })
    }
  }

  /** Earlier changes, once the end of what is loaded comes near. */
  async more(slug: string): Promise<void> {
    const st = this.d.store.getState()
    const had = st.rows
    if (st.more || st.end || !had?.length || st.slug !== slug) return
    st.setMore(true)
    const last = had[had.length - 1].seq
    let rows: LogRow[]
    try {
      rows = await this.d.api.activity(slug, MORE, last)
    } catch {
      this.d.store.getState().setMore(false)
      this.retry = () => void this.more(slug)
      this.d.toasts.show("Couldn't load earlier changes. Loads when Taska is back", null, { error: true })
      return
    }
    const now = this.d.store.getState()
    now.setMore(false)
    if (now.slug !== slug || now.rows?.at(-1)?.seq !== last) return // it started again meanwhile: the end asks again
    now.loaded(slug, [...now.rows, ...rows], rows.length < MORE, now.cursor)
  }

  /** Taska is back: what could not be loaded loads now. */
  back(): void {
    const r = this.retry
    this.retry = null
    r?.()
  }
}
