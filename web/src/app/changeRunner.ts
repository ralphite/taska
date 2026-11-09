// Sending your changes: one at a time and in order, each under its id so the server does it once however often it is
// sent. A change that cannot reach the server is sent again by itself and never given up (api/delivery): the pauses
// grow to 30 s, and the moment the server answers again it goes at once. Only the server saying no ends it.

import type { Delivery, Tries } from '../api/delivery'
import { Refused } from '../api/http'
import type { CommandAnswer, TaskaApi } from '../api/taska'
import type { Command } from '../model/commands'
import { preview, type Shown } from '../model/optimistic'
import type { ProjectModel } from '../model/project'
import type { ViewAnswer } from '../model/types'
import type { ChangeMode, ChangesStore, PendingChange } from '../stores/changes'

const NOTHING: Shown = { patches: [], inputPatches: [], docPatches: [] }

export interface RunnerEvents {
  /** the server's answer brought what changed: into the project's copy */
  changes(slug: string, a: ViewAnswer): void
  /** the server has it but the answer had no changes (sent again after a lost answer): load the project */
  stale(slug: string): void
  refused(c: PendingChange, why: string): void
  cursor(slug: string): string | null
  /** the project as the page shows it now: what a change's preview is made over */
  model(slug: string): ProjectModel | null
}

export class ChangeRunner {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly api: TaskaApi
  private readonly delivery: Delivery
  private readonly store: ChangesStore
  private readonly on: RunnerEvents

  constructor(api: TaskaApi, delivery: Delivery, store: ChangesStore, on: RunnerEvents) {
    this.api = api
    this.delivery = delivery
    this.store = store
    this.on = on
  }

  /** A change you make: shown at once as the server will make it (model/optimistic), sent behind you. `needed`: asked
   * when its turn comes (false: it goes nowhere, as saved). -> true once saved, false if the server said no. */
  change(slug: string, commands: Command | readonly Command[], said: string, o: { mode?: ChangeMode; needed?: () => boolean } = {}): Promise<boolean> {
    const list = [commands].flat()
    const t = Date.now()
    const m = this.on.model(slug)
    const shown = m ? preview(m, list, t) : NOTHING
    return this.send({ id: newId(), slug, commands: list, ...shown, said, t, ...(o.mode ? { mode: o.mode } : {}) }, o.needed)
  }

  /** Shown only, until taken away (-> what takes it away): what a change will show while it cannot go yet (its files
   * going up), or what a call that is no command does (a move to another project). */
  show(slug: string, shown: Shown): () => void {
    const id = 'show-' + newId()
    this.store.getState().add({ id, slug, commands: [], ...shown, said: '', t: Date.now(), mode: 'show' })
    return () => this.store.getState().remove(id)
  }

  /** What these commands would show now: a stand-in while what it stands for waits. */
  preview(slug: string, commands: readonly Command[]): Shown {
    const m = this.on.model(slug)
    return m ? preview(m, commands, Date.now()) : NOTHING
  }

  /** Show it now, send it behind you (a change kept from before a reload; any other goes through change()). */
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

  /** Commands sent under one id until the server answers (what they bring goes into the project's copy); `on`: what
   * the tries tell along the way (an input on its way shows it), and `answered` hears the answer before the copy takes
   * what it brings. */
  deliver(c: Pick<PendingChange, 'id' | 'slug' | 'commands'>, on?: Tries & { answered?(a: CommandAnswer): void }): Promise<CommandAnswer> {
    return this.delivery.until(async () => {
      const a = await this.api.commands(c.slug, c.id, c.commands, this.on.cursor(c.slug))
      on?.answered?.(a)
      if (a.changes) this.on.changes(c.slug, a.changes)
      else this.on.stale(c.slug)
      return a
    }, on)
  }
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
