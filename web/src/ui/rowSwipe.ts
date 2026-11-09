// The phone's swipe on a row (the item list's, the Inputs tab's: D115 #42). Right: its way forward (Done, Approve,
// Accept, Archive; an answer opens its card; an input opens the item it became); the row slides out first. Left: the
// ways back sit under the row until a tap anywhere else, one of them is tapped, another row is swiped or the rows are
// drawn anew (T589 #10486: a row left open over a list that changed under it showed its layer there). Nothing new
// shows until the finger really moves sideways (iPhone Safari takes a tap that reveals content as a hover and never
// sends the click); a sideways swipe keeps the list still; the screen's left edge is the phone's own Back. The row
// only moves with a transform while you swipe. A row whose list says so opens its menu on a long press (held still for
// half a second). Each row is marked data-swipe="its key", its layers data-swipe-left and data-swipe-right beside it.

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export const EDGE_W = 24
/** how long a finger stays still on a row for its menu */
const HOLD_MS = 500

export interface RowSwipe {
  /** whether a row can swipe right, and what it does then (`slide`: the row slides out before it happens) */
  right(key: string): { slide: boolean; run(): void } | null
  /** a long press on a row: its menu */
  hold?(key: string, el: HTMLElement): void
  /** something over the list (the drawer) takes the touch */
  blocked(): boolean
}

const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const layer = (el: HTMLElement, which: 'left' | 'right') => el.parentElement?.querySelector<HTMLElement>(`[data-swipe-${which}]`) ?? null

function slideTo(el: HTMLElement, x: number): void {
  el.style.transform = x ? `translateX(${x}px)` : ''
  if (!x)
    setTimeout(() => {
      // the layers hide once the row has slid back, so their edges never show
      if (el.style.transform) return
      el.parentElement?.querySelectorAll<HTMLElement>('[data-swipe-left], [data-swipe-right]').forEach((l) => (l.hidden = true))
    }, 250)
}

/** A row drawn swiped by `dx` (right: forward, its layer under it; left: the ways back), as a finger leaves it. */
export function showSwiped(el: HTMLElement, dx: number): void {
  const l = layer(el, 'left')
  const r = layer(el, 'right')
  if (l) l.hidden = dx < 0
  if (r) r.hidden = dx > 0
  slideTo(el, dx)
}

/** A row drawn swiped when it is drawn (`dx` right: mid-swipe forward; left: the ways back left open, as wide as
 * their buttons, as a finger leaves them); none: as it is. */
export function useSwiped(row: RefObject<HTMLElement | null>, dx: number | undefined): void {
  useLayoutEffect(() => {
    const el = row.current
    if (!el || dx == null) return
    if (dx >= 0) return showSwiped(el, dx)
    showSwiped(el, -1)
    showSwiped(el, -(layer(el, 'right')?.offsetWidth || -dx))
  }, [row, dx])
}

/** Every row of `list` slid back closed, but `but` (the one under the finger). */
export function closeRows(list: HTMLElement, but: HTMLElement | null = null): void {
  list.querySelectorAll<HTMLElement>('[data-swipe]').forEach((el) => {
    if (el === but) return
    const shown = [layer(el, 'left'), layer(el, 'right')].some((l) => l && !l.hidden)
    if (el.style.transform || shown) slideTo(el, 0)
  })
}

/** `rowsKey` changes when the rows are drawn anew (what they show, or which rows they are): each is then closed. */
export function useRowSwipe(listRef: RefObject<HTMLElement | null>, enabled: boolean, opts: RowSwipe, rowsKey: unknown): void {
  const told = useRef(opts)
  useEffect(() => {
    told.current = opts
  })
  const s = useRef({ el: null as HTMLElement | null, open: null as HTMLElement | null, swallow: 0, x0: 0, y0: 0, mode: null as null | 'h' | 'v', dx: 0, reveal: 0, base: 0, hold: 0, held: null as HTMLElement | null })
  const first = useRef(true)
  useEffect(() => {
    // rows drawn again are drawn closed (a stale one would swallow the next tap and show its layer over the list); a
    // row under the finger goes on with its swipe. Drawn the first time, they are as they were drawn.
    if (first.current) return void (first.current = false)
    const w = s.current
    if (w.el && !w.el.isConnected) w.el = null
    w.open = null
    if (listRef.current) closeRows(listRef.current, w.el)
  }, [rowsKey, listRef])
  useEffect(() => {
    const list = listRef.current
    if (!list || !enabled) return
    const w = s.current
    const unhold = () => {
      clearTimeout(w.hold)
      w.hold = 0
    }
    const close = () => {
      if (w.open) slideTo(w.open, 0)
      w.open = null
    }
    const start = (e: TouchEvent) => {
      w.el = w.held = null
      const t = e.touches[0]
      if (e.touches.length !== 1 || t.clientX <= EDGE_W || told.current.blocked()) return
      const el = (e.target as Element).closest<HTMLElement>('[data-swipe]')
      if (!el) return
      if (w.open && w.open !== el) close()
      const reveal = w.open === el ? layer(el, 'right')?.offsetWidth || 0 : 0
      Object.assign(w, { el, x0: t.clientX, y0: t.clientY, mode: null, dx: 0, reveal, base: -reveal })
      unhold()
      const hold = told.current.hold
      if (hold)
        w.hold = window.setTimeout(() => {
          w.hold = 0
          if (w.el !== el || w.mode) return
          // held still: its menu; the click the finger makes on the row as it lifts is not a tap
          w.el = null
          w.held = el
          hold(el.dataset.swipe ?? '', el)
        }, HOLD_MS)
    }
    const move = (e: TouchEvent) => {
      const el = w.el
      if (!el || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - w.x0
      const dy = t.clientY - w.y0
      if (!w.mode) {
        if (Math.hypot(dx, dy) < 10) return
        unhold()
        w.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (w.mode === 'v') {
          w.el = null
          return
        }
        el.style.transition = 'none'
        const right = layer(el, 'right')
        if (right) {
          right.hidden = false
          w.reveal = right.offsetWidth
        }
      }
      if (e.cancelable) e.preventDefault() // a sideways swipe: the list doesn't scroll under it
      w.dx = Math.max(-w.reveal - 30, Math.min(told.current.right(el.dataset.swipe ?? '') ? el.offsetWidth * 0.7 : 0, w.base + dx))
      showSwiped(el, w.dx)
    }
    const end = () => {
      unhold()
      const el = w.el
      if (!el) return
      w.el = null
      if (w.mode !== 'h') return
      w.swallow = Date.now()
      el.style.transition = ''
      if (w.dx > el.offsetWidth * 0.33) {
        const r = told.current.right(el.dataset.swipe ?? '')
        if (!r) return slideTo(el, 0)
        if (!r.slide) {
          slideTo(el, 0)
          return r.run()
        }
        slideTo(el, el.offsetWidth)
        setTimeout(r.run, still() ? 0 : 180) // the row slides out first
      } else if (w.dx < -w.reveal / 2) {
        slideTo(el, -w.reveal)
        w.open = el
      } else {
        slideTo(el, 0)
        if (w.open === el) w.open = null
      }
    }
    const cancel = () => {
      unhold()
      if (!w.el) return
      slideTo(w.el, w.el === w.open ? -w.reveal : 0)
      w.el.style.transition = ''
      w.el = null
    }
    // a tap right after a swipe is not a tap; a tap anywhere but the open row's buttons closes it; one of its
    // buttons does what it says and closes it too
    const click = (e: MouseEvent) => {
      const held = w.held
      w.held = null
      if (Date.now() - w.swallow < 400 || held?.contains(e.target as Node)) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (!w.open) return
      const its = (e.target as Element).closest('[data-swipe-right]')
      close()
      if (its) return
      e.preventDefault()
      e.stopPropagation()
    }
    list.addEventListener('touchstart', start, { passive: true })
    list.addEventListener('touchmove', move, { passive: false })
    list.addEventListener('touchend', end)
    list.addEventListener('touchcancel', cancel)
    document.addEventListener('click', click, true)
    return () => {
      list.removeEventListener('touchstart', start)
      list.removeEventListener('touchmove', move)
      list.removeEventListener('touchend', end)
      list.removeEventListener('touchcancel', cancel)
      document.removeEventListener('click', click, true)
      unhold()
    }
  }, [listRef, enabled])
}
