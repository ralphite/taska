// When Taska has new code. New code waiting for a restart while you are using Taska is never restarted under your
// hands: a toast offers it, and Restart restarts Taska and then this page. Taska restarted with new code while this
// page was open: the page still runs the old code, so it says so and offers a reload, and once nobody has touched it
// for 5 minutes it reloads by itself, unless a voice note is being recorded or something is still going up or out.
// The service worker answers a reload with the page it kept and fetches the new one meanwhile: a reload that comes back
// on the old code goes again at once, 3 times at most (counted in this tab).

import type { TaskaApi } from '../api/taska'
import type { ServerFacts } from '../model/types'
import type { KeyValueStore } from '../stores/storage'
import type { Toasts } from './toasts'

const IDLE_RELOAD = 5 * 60000
const AGAIN = 'taska.reload'

export interface UpdatesDeps {
  api: TaskaApi
  toasts: Toasts
  /** this tab's own store */
  session: KeyValueStore
  /** a voice note being recorded, something going up or out */
  busy(): boolean
  /** a project's cursor now, to tell when Taska has come back after a restart */
  boot(): Promise<string | null>
  reload(): void
  /** the name of this page's main script ("index-1a2b3c.js"), as Taska says its own */
  mine: string
}

export class Updates {
  private readonly d: UpdatesDeps
  private told = false
  private ver = ''
  private stale = false
  private usedAt = Date.now()
  private pointer = ''
  /** the name of this page's main script, as Taska says its own */
  private readonly mine: string
  constructor(d: UpdatesDeps) {
    this.d = d
    this.mine = d.mine
    if (typeof addEventListener === 'undefined') return
    const used = () => (this.usedAt = Date.now())
    for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input']) addEventListener(e, used, { capture: true, passive: true })
    addEventListener(
      'pointermove',
      (e) => {
        // a pointer that moved, not the page moving under one at rest
        if (`${e.screenX},${e.screenY}` === this.pointer) return
        this.pointer = `${e.screenX},${e.screenY}`
        used()
      },
      { capture: true, passive: true },
    )
  }

  /** What the server said of itself with a project's news. */
  seen(s: ServerFacts | undefined): void {
    if (!s) return
    if (s.update && !this.told) this.offerRestart()
    if (s.page && !this.ver) this.ver = this.mine || s.page // a page kept from before knows it is old at once
    if (s.page && s.page !== this.ver && !this.stale) this.offerReload(s.page)
    else if (s.page && s.page === this.ver && this.reloads(s.page)) this.d.session.set(AGAIN, null) // the new code is here
  }

  private reloads(ver: string): { ver: string; n: number; t: number } | null {
    const a = this.d.session.getJson<{ ver: string; n: number; t: number }>(AGAIN)
    return a && a.ver === ver ? a : null
  }

  private reloadFor(ver: string): void {
    this.d.session.setJson(AGAIN, { ver, n: (this.reloads(ver)?.n || 0) + 1, t: Date.now() })
    this.d.reload()
  }

  private offerReload(ver: string): void {
    this.stale = true
    const was = this.reloads(ver)
    if (was && was.n < 3 && Date.now() - was.t < 60000 && !this.d.busy()) return void window.setTimeout(() => this.reloadFor(ver), 1000)
    this.d.toasts.show('Taska has an update', () => this.reloadFor(ver), { label: 'Reload', sticky: true })
    if (was && was.n >= 3) return // the new code does not come: Reload is yours
    const check = () => {
      if (Date.now() - this.usedAt < IDLE_RELOAD || this.d.busy()) return
      clearInterval(t)
      this.reloadFor(ver)
    }
    const t = window.setInterval(check, 15000)
    check()
  }

  private offerRestart(): void {
    this.told = true
    this.d.toasts.show(
      'Taska has an update',
      async () => {
        this.d.toasts.show('Restarting Taska…')
        const boot = await this.d.boot()
        await this.d.api.restart().catch(() => {}) // it may go before it answers
        for (let i = 0; i < 60; i++) {
          await new Promise((ok) => setTimeout(ok, 1000))
          const now = await this.d.boot().catch(() => null)
          if (now && now !== boot) return this.d.reload()
        }
        this.d.reload()
      },
      { label: 'Restart', sticky: true },
    )
  }
}
