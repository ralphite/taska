// Getting something to Taska, in one place: what has to reach it (a change, an input, a file or a voice note going
// up, its words asked for, a move, a search) is asked again until Taska answers, never given up and never handed back
// to you to press Retry (T424). The pauses between tries grow (1, 2, 4, 8, 16, then 30 s), and all of them end at
// once when Taska may be there again (it answered, the network is back, the window shows again), so what waited goes
// within moments. How sure the page is that Taska is out of reach is counted as everywhere (model/reach). Only Taska
// saying no (Refused), or a failure that is not Taska out of reach, ends it; or what it was for being gone.

import { Abandoned, Unreachable } from './http'
import { awayAfter, outOfReach } from '../model/reach'

/** What a delivery tells along the way, and asks. */
export interface Tries {
  /** after a try without an answer: `tries` without one so far, `away` how sure the page is now (model/reach) */
  failed?(tries: number, away: number): void
  /** said once, when the page is sure Taska is out of reach */
  waiting?(): void
  /** before each try after the first: false ends it (what it was for is gone), rejecting with Abandoned */
  again?(): boolean
}

export class Delivery {
  private readonly waiting = new Set<() => void>()
  private backAt = 0

  /** The pause after `tries` tries without an answer (counting from 1). */
  static pause(tries: number): number {
    return Math.min(30000, 1000 * 2 ** Math.max(0, Math.min(tries - 1, 5)))
  }

  /** Taska may be there again: every pause ends now (and a try going on now goes again at once if it fails). */
  back(): void {
    this.backAt = Date.now()
    for (const go of [...this.waiting]) go()
  }

  /** Resolves after `ms`, or sooner when Taska may be back (or was back since `since`, when what waits began). */
  wait(ms: number, since = Date.now()): Promise<void> {
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

  /** `ask`, asked again while Taska is out of reach until it answers: its answer, or the failure that ended it. */
  async until<T>(ask: () => Promise<T>, on: Tries = {}): Promise<T> {
    let away = 0
    let told = false
    for (let tries = 0; ; ) {
      if (tries && on.again && !on.again()) throw new Abandoned()
      const started = Date.now()
      try {
        return await ask()
      } catch (ex) {
        if (!(ex instanceof Unreachable)) throw ex
        tries++
        away = awayAfter(away, ex.timedOut)
        on.failed?.(tries, away)
        if (!told && outOfReach(away)) {
          told = true
          on.waiting?.()
        }
        await this.wait(Delivery.pause(tries), started)
      }
    }
  }
}
