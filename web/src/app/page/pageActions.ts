// What you do on the page goes to Taska's log (B791; F407, T453: every action, so what went wrong where can be found
// later): the page opening, each control you tap (its name, not what you typed), the keys that act, each place you
// go to, leaving the page and coming back, what you send (where, how long, how many files: never its words) and a
// send that failed, and each request that failed (with the server's reason) or was slow.
// Kept and sent a batch at a time, so the page is never slowed by it.

import type { Http, Watched } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import type { OutboxStore } from '../../stores/outbox'
import type { SheetStore } from '../../stores/sheet'
import type { RouteStore } from '../../stores/route'

/** a request slower than this is noted (ms) */
export const SLOW = 3000
const EVERY = 5000 // ms between batches
const MAX = 3000 // at most this many in one page load: a page gone wrong does not fill the log
const CONTROL = 'button, a[href], summary, select, label, input[type="checkbox"], input[type="radio"], [role="button"], [role="link"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"]'
const FIELD = 'input, textarea, select, [contenteditable="true"]'

export type Entry = Record<string, unknown> & { kind: string }

/** an item's row in a list: tapping it opens the item (no control of its own) */
const ROW = 'article[data-n]'

/** A control's name as you see it: its label, else its words without its key hints, at most 80 characters. */
export function nameOf(el: Element): string {
  const said = el.getAttribute('aria-label') || el.getAttribute('title') || wordsOf(el)
  return said.replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** the words in `node`, its key hints left out */
const wordsOf = (node: Node): string =>
  node.nodeType === Node.TEXT_NODE ? node.textContent || '' : node.nodeName === 'KBD' ? ' ' : [...node.childNodes].map(wordsOf).join(' ')

/** The keys that act: Escape and Enter, a key with ⌘ or Ctrl or Alt, and the keys that act outside a field. */
export function keyOf(e: KeyboardEvent, inField: boolean): string {
  const mods = `${e.metaKey ? '⌘' : ''}${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}`
  if (/^(Meta|Control|Alt|Shift)$/.test(e.key)) return ''
  if (mods) return mods + (e.key.length === 1 ? e.key.toLowerCase() : e.key)
  if (e.key === 'Escape' || e.key === 'Enter') return e.key
  return inField || e.key === 'Tab' ? '' : e.key.length === 1 || /^(Arrow|Page|Home|End|Delete|Backspace)/.test(e.key) ? e.key : ''
}

/** A request's address as it goes in the log: no key, no files pass. */
const plainUrl = (url: string) => url.replace(/\/k\/[^/?]+/, '/k/…').replace(/([?&](?:key|cap)=)[^&]*/g, '$1…')

export class PageActions {
  private list: Entry[] = []
  private sent = 0
  readonly stop: () => void

  constructor(private readonly d: { api: Pick<TaskaApi, 'pageLog'> & { http: Http }; slug(): string; route: RouteStore; outbox: OutboxStore; sheet?: SheetStore }) {
    if (typeof window === 'undefined') {
      this.stop = () => {}
      return
    }
    const where = () => location.pathname
    const onClick = (e: MouseEvent) => {
      const at = e.target instanceof Element ? e.target : null
      const el = at?.closest(CONTROL)
      const row = el ? null : at?.closest(ROW)
      if (el) this.note({ kind: 'tap', what: nameOf(el), role: el.getAttribute('role') || el.tagName.toLowerCase(), where: where() })
      // the row itself, not the phone's swipe layers under it
      else if (row) this.note({ kind: 'tap', what: nameOf(row.querySelector('[data-swipe]') ?? row), role: 'row', n: row.getAttribute('data-n'), where: where() })
    }
    const onKey = (e: KeyboardEvent) => {
      const at = e.target instanceof Element ? e.target : null
      const key = keyOf(e, !!at?.closest(FIELD))
      if (key) this.note({ kind: 'key', what: key, where: where() })
    }
    const onShown = () => {
      if (document.visibilityState === 'hidden') {
        this.note({ kind: 'leave', where: where() })
        this.send(true)
      } else this.note({ kind: 'back', where: where() })
    }
    const onHide = () => this.send(true)
    let url = d.route.getState().url
    const unRoute = d.route.subscribe((s) => {
      if (s.url === url) return
      url = s.url
      this.note({ kind: 'view', where: where(), to: s.url })
    })
    // each sheet or menu that opens (B842: taps on a button that opens one could not be told from taps on nothing)
    let sheet = d.sheet?.getState().spec?.req ?? null
    const unSheet = d.sheet?.subscribe((s) => {
      const req = s.spec?.req ?? null
      if (req === sheet) return
      sheet = req
      if (req) this.note({ kind: 'sheet', what: req.kind, arm: 'arm' in req ? req.arm || undefined : undefined, where: where() })
    })
    // what you send, once each, and a send that failed
    const told = new Map<string, string>()
    const unOut = d.outbox.subscribe((s) => {
      for (const o of s.list) {
        const was = told.get(o.q)
        if (was === undefined) this.note({ kind: 'send', to: o.scope || 'new input', chars: o.text.length, files: o.files.length, voice: o.files.filter((f) => /^audio\//.test(f.mime || '')).length, answer: o.kind === 'answer' || undefined, back: o.back || undefined, where: where() })
        else if (o.state === 'failed' && was !== 'failed') this.note({ kind: 'send-failed', to: o.scope || 'new input', net: !!o.net, tries: o.tries, where: where() })
        told.set(o.q, o.state)
      }
      for (const q of [...told.keys()]) if (!s.list.some((o) => o.q === q)) told.delete(q)
    })
    // each request that failed or was slow, with the server's reason (B792: why a change was refused was not known)
    d.api.http.watch = (w: Watched) => {
      // the page's own log, and the long wait for news (slow on purpose; stopped when the page moves on)
      if (/\/page-log\b/.test(w.url) || (w.ok && w.ms < SLOW) || (/[?&]wait=/.test(w.url) && (w.ok || !w.status))) return
      this.note({ kind: 'net', why: w.ok ? 'slow' : 'failed', method: w.method, url: plainUrl(w.url), status: w.status, ms: w.ms, msg: w.why?.slice(0, 300) })
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })
    document.addEventListener('keydown', onKey, { capture: true, passive: true })
    document.addEventListener('visibilitychange', onShown)
    window.addEventListener('pagehide', onHide)
    const timer = window.setInterval(() => this.send(false), EVERY)
    this.note({ kind: 'open', where: where(), size: `${window.innerWidth}x${window.innerHeight}`, ua: navigator.userAgent })
    this.stop = () => {
      unRoute()
      unOut()
      unSheet?.()
      d.api.http.watch = undefined
      document.removeEventListener('click', onClick, { capture: true })
      document.removeEventListener('keydown', onKey, { capture: true })
      document.removeEventListener('visibilitychange', onShown)
      window.removeEventListener('pagehide', onHide)
      clearInterval(timer)
      this.send(true)
    }
  }

  /** One thing you did, kept for the next batch. */
  note(e: Entry): void {
    if (this.sent + this.list.length >= MAX) return
    this.list.push({ ...e, at: new Date().toISOString() })
  }

  /** What was kept, sent; `leaving`: the page may go any moment, so the request outlives it. */
  send(leaving: boolean): void {
    const slug = this.d.slug()
    if (!slug || !this.list.length) return // on the home page: kept until a project opens (the log is a project's)
    const list = this.list
    this.list = []
    this.sent += list.length
    void this.d.api.pageLog(slug, list, leaving).catch(() => {})
  }
}
