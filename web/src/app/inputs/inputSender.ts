// Sending what you said: sending never holds the box. Each input goes into the outbox, which sends in order as soon
// as its files are up. One the server could not be reached for waits and goes again by itself, as a change does
// (ChangeRunner.deliver: sooner when the server is back); one the server refused stays, marked Not sent, until Retry
// sends it again. Every change of what is on its way is a step of model/outgoingStates (`outStep`), which refuses a
// way it does not have.

import { Abandoned, Refused } from '../../api/http'
import type { CommandOf } from '../../model/commands'
import type { OutboxStore } from '../../stores/outbox'
import type { Outgoing } from '../../model/outgoing'
import { outStep, type OutEvent } from '../../model/outgoingStates'
import { wordsByFile } from '../../model/voices'
import { goingUp, isUp } from '../../model/fileStates'
import type { ChangeRunner } from '../changeRunner'

export interface SenderEvents {
  /** it is in, as this input */
  sent(o: Outgoing, rid: string): void
  refused(o: Outgoing, why: string): void
  log(why: string, msg: string): void
}

export const newQ = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export class InputSender {
  private busy = false
  private readonly runner: ChangeRunner
  private readonly store: OutboxStore
  private readonly on: SenderEvents
  constructor(runner: ChangeRunner, store: OutboxStore, on: SenderEvents) {
    this.runner = runner
    this.store = store
    this.on = on
  }

  push(o: Omit<Outgoing, 'q' | 't' | 'state' | 'tries'> & Partial<Outgoing>): Outgoing {
    const out: Outgoing = { q: newQ(), t: Date.now(), state: 'waiting', tries: 0, ...o }
    this.store.getState().push(out)
    void this.flush()
    return out
  }

  /** `q` moved on by `on`, as model/outgoingStates allows it (`away`: as where it was done showed Taska). -> whether
   * it went that way */
  step(q: string, on: OutEvent, away = 0): boolean {
    const o = this.store.getState().list.find((x) => x.q === q)
    const change = o ? outStep(o, on, away) : null
    if (!change) return false
    if (change === 'remove') this.store.getState().remove(q)
    else this.store.getState().update(q, change)
    return true
  }

  /** One Taska said no to, sent again (its Retry). */
  retry(q: string): void {
    if (this.step(q, 'retry')) void this.flush()
  }

  async flush(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      for (;;) {
        const o = this.store.getState().list[0]
        if (!o || o.state === 'failed') break
        if (o.files.some(goingUp)) break // its files are on their way: it goes once they are up
        const files = o.files.filter(isUp)
        const text = o.text // what was typed; a voice note's words are its own (B682), those you left in the box with it
        const words = wordsByFile(o.words, files)
        if (!text && !files.length) {
          this.store.getState().remove(o.q)
          continue
        }
        this.step(o.q, 'go')
        try {
          const command: CommandOf<'input'> = {
            op: 'input',
            text,
            scope: o.scope,
            q: o.q,
            ...(o.kind ? { kind: o.kind } : {}),
            ...(o.of?.length ? { of: o.of } : {}),
            files: files.map(({ f, name, mime, size }) => ({ f, name, mime, size })),
            ...(Object.keys(words).length ? { words } : {}),
          }
          // out of reach, it shows it waits and goes again by itself, unless it was taken off meanwhile; Taska has it:
          // it leaves the outbox as the project's copy takes it
          const head = () => this.store.getState().list[0]?.q === o.q
          let now = o
          const a = await this.runner.deliver(
            { id: 'in-' + o.q, slug: o.slug, commands: [command] },
            {
              failed: (tries) => {
                this.step(o.q, 'unreachable')
                this.on.log('unsent', `${o.q} (${o.slug}) no answer from Taska, try ${tries}`)
              },
              again: () => head() && this.step(o.q, 'again') && this.step(o.q, 'go'),
              answered: () => {
                now = this.store.getState().list.find((x) => x.q === o.q) ?? o // taken back while on its way?
                if (now.tries || o.back)
                  this.on.log('sent late', `${o.q} (${o.slug}) in after ${Math.round((Date.now() - o.t) / 1000)} s, ${now.tries} failed tries${o.back ? ', after a reload' : ''}`)
                this.step(o.q, 'taken')
              },
            },
          )
          this.on.sent(now, (a.results[0] || '').split(' ')[1] || '')
        } catch (ex) {
          if (ex instanceof Abandoned) continue // taken off while it waited: the next goes
          // taken back while it went out, and Taska said no: it is gone (it can never reach Taska now)
          this.step(o.q, 'refused')
          this.on.log('unsent', `${o.q} (${o.slug}) refused: ${(ex as Error).message || ''}`)
          if (ex instanceof Refused) this.on.refused(o, ex.message)
          break
        }
      }
    } finally {
      this.busy = false
    }
  }
}
