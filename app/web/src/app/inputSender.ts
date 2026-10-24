// Sending what you said: sending never holds the box. Each input goes into the outbox, which sends in order as soon
// as its files are up. One the server could not be reached for waits and goes again by itself (sooner when the
// server is back); one the server refused stays, marked Not sent.

import { Refused, Unreachable } from '../api/http'
import type { TaskaApi } from '../api/taska'
import type { ViewAnswer } from '../model/types'
import type { OutboxStore, Outgoing } from '../stores/outbox'

export interface SenderEvents {
  cursor(slug: string): string | null
  changes(slug: string, a: ViewAnswer): void
  stale(slug: string): void
  /** it is in, as this input */
  sent(o: Outgoing, rid: string): void
  refused(o: Outgoing, why: string): void
  log(why: string, msg: string): void
}

export const newQ = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export class InputSender {
  private busy = false
  private readonly api: TaskaApi
  private readonly store: OutboxStore
  private readonly on: SenderEvents
  constructor(api: TaskaApi, store: OutboxStore, on: SenderEvents) {
    this.api = api
    this.store = store
    this.on = on
  }

  push(o: Omit<Outgoing, 'q' | 't' | 'state' | 'tries'> & Partial<Outgoing>): Outgoing {
    const out: Outgoing = { q: newQ(), t: Date.now(), state: 'waiting', tries: 0, ...o }
    this.store.getState().push(out)
    void this.flush()
    return out
  }

  /** The server answers again: what waited for it goes now. */
  back(): void {
    let again = false
    for (const o of this.store.getState().list)
      if (o.state === 'failed' && o.net) {
        this.store.getState().update(o.q, { state: 'waiting', net: false })
        again = true
      }
    if (again) void this.flush()
  }

  async flush(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      for (;;) {
        const o = this.store.getState().list[0]
        if (!o || o.state === 'failed') break
        if (o.files.some((f) => f.uploading)) break // its files are on their way: it goes once they are up
        const files = o.files.filter((f) => f.f && !f.failed)
        let text = o.text
        for (const f of files) if (f.tr && !text.includes(f.tr)) text = (text ? text + '\n' : '') + f.tr // words that came after you sent
        if (!text && !files.length) {
          this.store.getState().remove(o.q)
          continue
        }
        this.store.getState().update(o.q, { state: 'sending' })
        try {
          const command = {
            op: 'input',
            text,
            scope: o.scope,
            q: o.q,
            ...(o.kind ? { kind: o.kind } : {}),
            files: files.map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) })),
          }
          const a = await this.api.commands(o.slug, 'in-' + o.q, [command], this.on.cursor(o.slug))
          const rid = (a.results[0] || '').split(' ')[1] || ''
          if (o.tries || o.back)
            this.on.log('sent late', `${o.q} (${o.slug}) in after ${Math.round((Date.now() - o.t) / 1000)} s, ${o.tries} failed tries${o.back ? ', after a reload' : ''}`)
          this.store.getState().remove(o.q)
          if (a.changes) this.on.changes(o.slug, a.changes)
          else this.on.stale(o.slug)
          this.on.sent(o, rid)
        } catch (ex) {
          const net = ex instanceof Unreachable
          const tries = o.tries + 1
          this.store.getState().update(o.q, { state: 'failed', net, tries })
          this.on.log('unsent', `${o.q} (${o.slug}) ${net ? 'no answer from Taska' : 'refused: ' + ((ex as Error).message || '')}, try ${tries}`)
          if (ex instanceof Refused) this.on.refused(o, ex.message)
          if (net)
            setTimeout(() => {
              const now = this.store.getState().list[0]
              if (now?.q === o.q && now.state === 'failed') {
                this.store.getState().update(o.q, { state: 'waiting' })
                void this.flush()
              }
            }, Math.min(30000, 2000 * 2 ** Math.min(tries, 4)))
          break
        }
      }
    } finally {
      this.busy = false
    }
  }
}
