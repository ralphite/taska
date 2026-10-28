// Sending your changes: one at a time and in order, each under its id so the server does it once however often it is
// sent. A change that cannot reach the server is sent again by itself and never given up: the pauses grow to 30 s,
// and the moment the server answers again it goes at once. Only the server saying no ends it.

import { Refused, Unreachable } from '../api/http'
import type { Command, CommandAnswer, TaskaApi } from '../api/taska'
import type { ViewAnswer } from '../model/types'
import type { ChangesStore, PendingChange } from '../stores/changes'

const PAUSES = [1000, 2000, 4000, 8000, 15000]

export interface RunnerEvents {
  /** the server's answer brought what changed: into the project's copy */
  changes(slug: string, a: ViewAnswer): void
  /** the server has it but the answer had no changes (sent again after a lost answer): load the project */
  stale(slug: string): void
  refused(c: PendingChange, why: string): void
  /** it could not reach the server (it goes on trying) */
  unreachable(c: PendingChange): void
  cursor(slug: string): string | null
}

export class ChangeRunner {
  private queue: Promise<unknown> = Promise.resolve()
  private waiting = new Set<() => void>()
  private backAt = 0
  private readonly api: TaskaApi
  private readonly store: ChangesStore
  private readonly on: RunnerEvents

  constructor(api: TaskaApi, store: ChangesStore, on: RunnerEvents) {
    this.api = api
    this.store = store
    this.on = on
  }

  /** The server answers again: what waits for it goes now. */
  back(): void {
    this.backAt = Date.now()
    for (const go of [...this.waiting]) go()
  }

  /** Show it now, send it behind you. -> true once saved, false if the server said no. */
  send(c: PendingChange, needed: () => boolean = () => true): Promise<boolean> {
    this.store.getState().add(c)
    const done = this.queue.then(async () => {
      try {
        if (!needed()) return true
        await this.deliver(c)
        return true
      } catch (ex) {
        if (ex instanceof Refused) this.on.refused(c, ex.message)
        return false
      } finally {
        this.store.getState().remove(c.id)
      }
    })
    this.queue = done
    return done
  }

  /** Commands for another purpose (more than one step), sent under one id, with the same retries. */
  async deliver(c: Pick<PendingChange, 'id' | 'slug' | 'commands'>): Promise<CommandAnswer> {
    let told = false
    for (let i = 0; ; i++) {
      const started = Date.now()
      try {
        const a = await this.api.commands(c.slug, c.id, c.commands as Command[], this.on.cursor(c.slug))
        if (a.changes) this.on.changes(c.slug, a.changes)
        else this.on.stale(c.slug)
        return a
      } catch (ex) {
        if (!(ex instanceof Unreachable)) throw ex
        if (!told && i >= 0) {
          told = true
          this.on.unreachable(c as PendingChange)
        }
        await this.pause(PAUSES[i] ?? 30000, started)
      }
    }
  }

  /** A pause that ends early once the server is back (or was back since the try began). */
  private pause(ms: number, since: number): Promise<void> {
    return new Promise((ok) => {
      if (this.backAt > since) return ok()
      const go = () => {
        clearTimeout(t)
        this.waiting.delete(go)
        ok()
      }
      const t = setTimeout(go, ms)
      this.waiting.add(go)
    })
  }
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
