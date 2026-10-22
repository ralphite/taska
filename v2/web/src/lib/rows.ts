// What a row offers: the desktop's quick actions on hover (B128) and the phone's swipes (F51, B147, B237).
import { CLOSED, DR, byN, canDone, kids, reduceMotion, rowAction } from './state'
import type { Item } from './types'
import { change } from './data'
import { ACT } from './actions'

export type Slot = [string, string, string] // field, value, label
// On the desktop the actions keep one order on every row (B128): forward, progress, Won't do, Later; the ones that do
// not apply are left out, with no gaps (B135). Rows waiting on your answer offer only Later: the pill answers.
export function deskSlots(it: Item, needs: boolean): (Slot | null)[] {
  const later: Slot = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Back to now'],
    drop: Slot = ['status', 'dropped', "Won't do"]
  if (it.archived) return [['archived', 'false', 'Unarchive'], null, null, null]
  if (it.wait)
    return [
      null,
      canDone(it) ? ['status', 'done', 'Done'] : null,
      it.status === 'proposed' || ['open', 'doing'].includes(it.status) ? drop : null,
      later,
    ] // T268; T438 #14: Done as everywhere
  if (it.type === 'rule')
    return it.status === 'proposed'
      ? [needs ? null : ['status', 'open', 'Approve'], null, drop, null] // a rule's own words (T113 B21)
      : it.status === 'open'
        ? [null, null, ['status', 'dropped', 'Retire'], null]
        : [['archived', 'true', 'Archive'], ['status', 'open', 'Reactivate'], null, null]
  const r = needs ? null : swipeRight(it)
  const fwd: Slot | null = r && r[0] !== 'need' ? [r[0], r[1], r[2]] : null
  const prog: Slot | null =
    it.status === 'open'
      ? null
      : it.status === 'doing'
        ? null
        : it.status === 'review'
          ? ['reopen', '', 'Not yet']
          : CLOSED(it.status)
            ? ['status', 'open', 'Reopen']
            : null
  return [fwd, prog, ['open', 'doing', 'proposed'].includes(it.status) ? drop : null, CLOSED(it.status) ? null : later]
}
// Swipe right all the way: the step forward you take most (F51). On an item that waits on your answer the step forward
// is that answer, as on its pill and the desktop's A: Answer or Reply, never Done (B147).
export function swipeRight(it: Item | undefined): [string, string, string, string?] | null {
  if (!it) return null
  return it.archived
    ? null
    : it.type === 'rule' && it.status === 'open'
      ? null // B158
      : it.wait
        ? ['need', ...rowAction(it)]
        : it.status === 'proposed'
          ? ['status', 'open', 'Approve', 'approved']
          : it.status === 'review'
            ? ['status', 'done', 'Accept', 'accepted']
            : CLOSED(it.status)
              ? ['archived', 'true', 'Archive', 'archived']
              : ['status', 'done', 'Done', 'done']
}
// Swipe left: the way back. The one you want most sits at the edge, under your finger; a few more beside it (B147).
export function swipeLeft(it: Item): Slot[] {
  const later: Slot = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Back to now'],
    drop: Slot = ['status', 'dropped', "Won't do"]
  const done: Slot[] = it.wait ? [['status', 'done', 'Done']] : []
  if (it.type === 'rule' && !it.archived)
    return it.status === 'proposed'
      ? [drop]
      : it.status === 'open'
        ? [['status', 'dropped', 'Retire']]
        : [['status', 'open', 'Reactivate']] // B158
  return it.archived
    ? [['archived', 'false', 'Unarchive']]
    : it.status === 'proposed'
      ? [drop, later] // B302
      : it.status === 'review'
        ? [later, ['status', 'doing', 'Not yet']]
        : CLOSED(it.status)
          ? [['status', 'open', 'Reopen']]
          : it.status === 'doing'
            ? [drop, later, ...done]
            : [drop, later, ...done] // T274 #7: agents start work, not you
}
export const openKidsOf = (n: number) => (kids.get(n) || []).filter((k) => !CLOSED(k.status)).length

// ---------------------------------------------------------------- the phone's swipe (touch events, B237)
export const EDGE_W = 24 // the screen edge belongs to the phone's own back
export const SW = {
  el: null as HTMLElement | null,
  open: null as HTMLElement | null,
  swallow: 0,
  x0: 0,
  y0: 0,
  mode: null as null | 'h' | 'v',
  dx: 0,
  reveal: 0,
  base: 0,
}
const layer = (el: HTMLElement, which: 'left' | 'right') =>
  el.parentElement?.querySelector<HTMLElement>(`[data-swipe-${which}]`)
export function swipeTo(el: HTMLElement, x: number) {
  el.style.transform = x ? `translateX(${x}px)` : ''
  if (!x)
    setTimeout(() => {
      // hide the layers once the row has slid back, so their edges never show
      if (el.style.transform) return
      el.parentElement?.querySelectorAll<HTMLElement>('[data-swipe-left], [data-swipe-right]').forEach((l) => {
        l.hidden = true
      })
    }, 250)
}
export function closeSwipe() {
  if (SW.open) {
    swipeTo(SW.open, 0)
    SW.open = null
  }
}
export function swipeStart(e: TouchEvent) {
  SW.el = null
  const t = e.touches[0]
  if (e.touches.length !== 1 || t.clientX <= EDGE_W || DR.open) return
  const el = (e.target as Element).closest<HTMLElement>('[data-swipe]')
  if (!el) return
  if (SW.open && SW.open !== el) closeSwipe()
  // Show nothing new until the finger really moves sideways: iPhone Safari treats a tap that reveals content as a
  // hover and never sends the click, so the row would not open (B62).
  const reveal = SW.open === el ? layer(el, 'right')?.offsetWidth || 0 : 0
  Object.assign(SW, { el, x0: t.clientX, y0: t.clientY, mode: null, dx: 0, reveal, base: -reveal })
}
export function swipeMove(e: TouchEvent) {
  const el = SW.el
  if (!el || e.touches.length !== 1) return
  const t = e.touches[0],
    dx = t.clientX - SW.x0,
    dy = t.clientY - SW.y0
  if (!SW.mode) {
    if (Math.hypot(dx, dy) < 10) return
    SW.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    if (SW.mode === 'v') {
      SW.el = null
      return
    }
    el.style.transition = 'none'
    const right = layer(el, 'right')
    if (right) {
      right.hidden = false
      SW.reveal = right.offsetWidth
    }
  }
  if (e.cancelable) e.preventDefault() // a sideways swipe: the list doesn't scroll under it
  SW.dx = Math.max(
    -SW.reveal - 30,
    Math.min(swipeRight(byN.get(Number(el.dataset.swipe))) ? el.offsetWidth * 0.7 : 0, SW.base + dx),
  )
  const l = layer(el, 'left'),
    r = layer(el, 'right')
  if (l) l.hidden = SW.dx < 0
  if (r) r.hidden = SW.dx > 0
  swipeTo(el, SW.dx)
}
export function swipeEnd() {
  const el = SW.el
  if (!el) return
  SW.el = null
  if (SW.mode !== 'h') return
  SW.swallow = Date.now()
  el.style.transition = ''
  const n = Number(el.dataset.swipe),
    it = byN.get(n)
  if (SW.dx > el.offsetWidth * 0.33) {
    const r = swipeRight(it)
    if (!r) return swipeTo(el, 0)
    const [f, v] = r
    if (f === 'need') {
      swipeTo(el, 0)
      return ACT['row-act']({ n: String(n), v })
    } // the answer, as its pill (B147)
    swipeTo(el, el.offsetWidth)
    setTimeout(() => change(n, f, f === 'archived' ? v === 'true' : v), reduceMotion() ? 0 : 180) // the row slides out first
  } else if (SW.dx < -SW.reveal / 2) {
    swipeTo(el, -SW.reveal)
    SW.open = el
  } else {
    swipeTo(el, 0)
    if (SW.open === el) SW.open = null
  }
}
export function swipeCancel() {
  if (SW.el) {
    swipeTo(SW.el, SW.el === SW.open ? -SW.reveal : 0)
    SW.el.style.transition = ''
    SW.el = null
  }
}
