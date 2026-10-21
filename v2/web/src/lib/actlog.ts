// F407 (r515): every action you take is logged for finding out later what went wrong and why: what it was, how you
// did it (a click, a key, a drop, or the page by itself) and where you were. Taska keeps them in the project's
// actions.jsonl.
import { ctx } from './state'

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
export function actLog(what: string, d?: Record<string, unknown>) {
  if (!ctx.P) return
  AL.list.push({
    t: new Date().toISOString(),
    what,
    via: performance.now() - AL.at < 400 ? AL.via : 'page',
    where: location.pathname + location.search,
    ...(d && Object.keys(d).length ? { d: brief(d) } : {}),
  })
  clearTimeout(AL.t)
  AL.t = window.setTimeout(flushActs, AL.list.length >= 50 ? 0 : 3000)
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
