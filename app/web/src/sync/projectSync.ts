// Keeping one project's copy up to date: the copy kept in this browser shows at once, the server's view replaces
// it, then the page asks for changes again and again. Only the window you are in waits for news (a browser keeps few
// connections per server, and a waiting request holds one): a window you can see but are not in asks every 5 s, one
// behind every 20 s, and each lets go at once. While the server is away the page asks again, a little later each
// time, never more than 5 s apart, so it is back at once.

import { Abandoned, KeyNeeded, Unreachable } from '../api/http'
import type { TaskaApi } from '../api/taska'
import { merge, type ServerCopy } from '../model/project'
import type { ViewAnswer } from '../model/types'
import type { CopyCache } from './cache'

export interface SyncEvents {
  /** `fresh`: from the server now, not this browser's copy from before */
  copy(slug: string, copy: ServerCopy, fresh: boolean): void
  /** how sure the page is that the server is away (0: it answers; 2 and more: say so) */
  reach(slug: string, away: number): void
  keyNeeded(): void
  gone(slug: string, how: 'gone' | 'none'): void
}

export interface Presence {
  hidden(): boolean
  focused(): boolean
  /** resolves when the window shows again or gets the focus, or after ms */
  nap(ms: number): Promise<void>
  /** resolves when the window loses the focus */
  blurred(signal: AbortSignal): Promise<void>
  /** calls `back` when the window shows again or gets the focus, `online` when the network comes back; -> stop */
  watch(on: { back(): void; online(): void }): () => void
}

export class ProjectSync {
  private copy: ServerCopy | null = null
  private stop = new AbortController()
  private failures = 0 // failed tries in a row
  private away = 0 // how sure the page is the server is away: a try that timed out counts twice
  readonly slug: string
  private readonly api: TaskaApi
  private readonly cache: CopyCache
  private readonly on: SyncEvents
  private readonly presence: Presence

  constructor(slug: string, api: TaskaApi, cache: CopyCache, on: SyncEvents, presence: Presence) {
    this.slug = slug
    this.api = api
    this.cache = cache
    this.on = on
    this.presence = presence
  }

  get current(): ServerCopy | null {
    return this.copy
  }

  async start(): Promise<void> {
    const kept = await this.cache.get(this.slug)
    if (this.stop.signal.aborted) return
    if (kept && !this.copy) this.show(kept, false, true)
    await this.refresh()
    void this.loop()
  }

  close(): void {
    this.stop.abort()
  }

  /** closed, or stopped by itself (the project is not there) */
  get closed(): boolean {
    return this.stop.signal.aborted
  }

  /** Take a newer answer (a command's) into the copy. */
  take(a: ViewAnswer): void {
    this.show(merge(this.copy, a, Date.now()))
  }

  get cursor(): string | null {
    return this.copy?.cursor ?? null
  }

  /** Load what changed now (or all of it). -> it came */
  async refresh(): Promise<boolean> {
    try {
      const a = await this.api.view(this.slug, this.copy?.cursor ?? null, this.stop.signal)
      this.answered()
      this.show(merge(this.copy, a, Date.now()))
      return true
    } catch (ex) {
      this.failed(ex)
      return false
    }
  }

  /** `cached`: this browser's copy from before, not an answer of the server's */
  private show(copy: ServerCopy, keep = true, cached = false): void {
    if (this.stop.signal.aborted) return
    this.copy = copy
    this.on.copy(this.slug, copy, !cached)
    if (keep) this.cache.put(this.slug, copy)
  }

  private answered(): void {
    if (this.failures || this.away) {
      this.failures = this.away = 0
      this.on.reach(this.slug, 0)
    }
  }

  private failed(ex: unknown): void {
    if (ex instanceof Abandoned) return
    if (ex instanceof KeyNeeded) return this.on.keyNeeded()
    const msg = (ex as Error)?.message || ''
    // the project is not there: nothing more to ask for it
    const gone = /^project \S+ was deleted/.test(msg) ? 'gone' : /^no project /.test(msg) ? 'none' : null
    if (gone) {
      this.close()
      return this.on.gone(this.slug, gone)
    }
    this.failures += 1
    this.away += ex instanceof Unreachable && ex.timedOut ? 2 : 1
    this.on.reach(this.slug, this.away)
  }

  private async loop(): Promise<void> {
    while (!this.stop.signal.aborted) {
      const idle = this.presence.hidden() || !this.presence.focused()
      const quick = idle || this.failures > 0 // while the server seems away, its first answer comes at once
      const leave = new AbortController()
      const onStop = () => leave.abort()
      this.stop.signal.addEventListener('abort', onStop)
      let left = false
      if (!idle) void this.presence.blurred(leave.signal).then(() => ((left = true), leave.abort()))
      try {
        if (!this.copy) {
          // not loaded yet: asked again after a pause, as an answer that failed is
          if (!(await this.refresh()) && !this.stop.signal.aborted) await sleep(Math.min(5000, 500 * 2 ** Math.min(Math.max(this.failures, 1) - 1, 4)))
        } else {
          const a = await this.api.changes(this.slug, this.copy.cursor, quick ? 0 : 25, leave.signal)
          this.answered()
          const news = !a.same
          this.show(merge(this.copy, a, Date.now()), news)
          if (idle && !news) await this.presence.nap(this.presence.hidden() ? 20000 : 5000)
        }
      } catch (ex) {
        if (this.stop.signal.aborted) return
        if (!left) {
          this.failed(ex)
          await sleep(Math.min(5000, 500 * 2 ** Math.min(this.failures - 1, 4)))
        }
      } finally {
        this.stop.signal.removeEventListener('abort', onStop)
        leave.abort()
      }
    }
  }
}

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms))
