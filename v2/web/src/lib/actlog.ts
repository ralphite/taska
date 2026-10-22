// F407 (r515): every action you take is logged for finding out later what went wrong and why: what it was, how you
// did it (a click, a key, a drop, or the page by itself) and where you were. T453: Taska keeps them in its log
// table (logs.db), with this tab's number, which every request from this tab carries too.
import { ctx } from './state'

/** T453: this tab's number in the log: its actions, its requests and its errors carry it */
export const TAB = (() => {
  try {
    const had = sessionStorage.getItem('taska.tab')
    if (had) return had
    const id = Math.random().toString(36).slice(2, 10)
    sessionStorage.setItem('taska.tab', id)
    return id
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
})()
if (typeof window !== 'undefined' && window.fetch) {
  const send = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!/^https?:/.test(url) || url.startsWith(location.origin)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      headers.set('X-Taska-Tab', TAB)
      return send(input, { ...init, headers })
    }
    return send(input, init)
  }
}

const AL = { list: [] as Record<string, unknown>[], t: 0, via: '', at: 0 }
/** A user event just happened: the actions in the next moment are its. */
export function sawEvent(e: Event) {
  const k = e as KeyboardEvent
  AL.via =
    e.type === 'keydown'
      ? 'key ' +
        [k.metaKey && '⌘', k.ctrlKey && 'ctrl', k.altKey && '⌥', k.shiftKey && '⇧', k.key].filter(Boolean).join('')
      : e.type
  AL.at = performance.now()
  const el = e.target as HTMLElement | null
  if (
    e.type === 'keydown' &&
    !['Shift', 'Meta', 'Control', 'Alt', 'CapsLock', 'Tab'].includes(k.key) &&
    !el?.closest?.('input, textarea, select, [contenteditable="true"]')
  )
    actLog(AL.via) // a shortcut (typing in a field is not logged; what you send is)
}
const brief = (d: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(d)
      .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
      .slice(0, 8)
      .map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 80) : v]),
  )
export function actLog(what: string, d?: Record<string, unknown>, whole?: Record<string, unknown>) {
  if (!ctx.P) return
  AL.list.push({
    t: new Date().toISOString(),
    what,
    via: performance.now() - AL.at < 400 ? AL.via : 'page',
    where: location.pathname + location.search,
    ...(d && Object.keys(d).length ? { d: brief(d) } : {}),
    ...(whole ? { x: whole } : {}), // T453: kept whole (a draft's words)
  })
  clearTimeout(AL.t)
  AL.t = window.setTimeout(flushActs, AL.list.length >= 50 ? 0 : 3000)
}
const DRAFT_LOG: Record<string, number> = {},
  DRAFT_WAS: Record<string, string> = {}
/** T453: what you write in a box, once you stop for 2 seconds (and once when it is sent or cleared) */
export function draftLog(key: string, text: string) {
  clearTimeout(DRAFT_LOG[key])
  DRAFT_LOG[key] = window.setTimeout(() => {
    if ((DRAFT_WAS[key] || '') === text) return
    DRAFT_WAS[key] = text
    actLog(text.trim() ? 'draft' : 'draft-cleared', { key, chars: text.length }, { text: text.slice(0, 20000) })
  }, 2000)
}
export function flushActs() {
  if (!AL.list.length || !ctx.P) return
  const list = AL.list.splice(0, 200)
  void fetch(ctx.P + 'api/actlog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list }),
    keepalive: true, // it goes even when the page is being left
  })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
    })
    .catch(() => {
      AL.list.unshift(...list) // offline or refused: they go with the next batch
      AL.list.splice(1000) // never more than this waits
    })
}
