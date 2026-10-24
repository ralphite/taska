// The phone's swipe on a row. Right: its way forward (Done, Approve, Accept, Archive; an answer opens its card); the
// row slides out first. Left: the ways back sit under the row and stay open until a tap anywhere else. Nothing new
// shows until the finger really moves sideways (iPhone Safari takes a tap that reveals content as a hover and never
// sends the click); a sideways swipe keeps the list still; the screen's left edge is the phone's own Back. The row
// only moves with a transform while you swipe.

import { useEffect, useRef, type RefObject } from 'react'

export const EDGE_W = 24

export interface RowSwipe {
  /** whether a row can swipe right, and what it does then (`slide`: the row slides out before it happens) */
  right(n: number): { slide: boolean; run(): void } | null
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

export function useRowSwipe(listRef: RefObject<HTMLElement | null>, enabled: boolean, opts: RowSwipe, rowsKey: unknown): void {
  const told = useRef(opts)
  useEffect(() => {
    told.current = opts
  })
  const s = useRef({ el: null as HTMLElement | null, open: null as HTMLElement | null, swallow: 0, x0: 0, y0: 0, mode: null as null | 'h' | 'v', dx: 0, reveal: 0, base: 0 })
  useEffect(() => {
    // rows drawn again are drawn closed: a stale one would swallow the next tap
    s.current.open = s.current.el = null
  }, [rowsKey])
  useEffect(() => {
    const list = listRef.current
    if (!list || !enabled) return
    const w = s.current
    const close = () => {
      if (w.open) slideTo(w.open, 0)
      w.open = null
    }
    const start = (e: TouchEvent) => {
      w.el = null
      const t = e.touches[0]
      if (e.touches.length !== 1 || t.clientX <= EDGE_W || told.current.blocked()) return
      const el = (e.target as Element).closest<HTMLElement>('[data-swipe]')
      if (!el) return
      if (w.open && w.open !== el) close()
      const reveal = w.open === el ? layer(el, 'right')?.offsetWidth || 0 : 0
      Object.assign(w, { el, x0: t.clientX, y0: t.clientY, mode: null, dx: 0, reveal, base: -reveal })
    }
    const move = (e: TouchEvent) => {
      const el = w.el
      if (!el || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - w.x0
      const dy = t.clientY - w.y0
      if (!w.mode) {
        if (Math.hypot(dx, dy) < 10) return
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
      w.dx = Math.max(-w.reveal - 30, Math.min(told.current.right(Number(el.dataset.swipe)) ? el.offsetWidth * 0.7 : 0, w.base + dx))
      const l = layer(el, 'left')
      const r = layer(el, 'right')
      if (l) l.hidden = w.dx < 0
      if (r) r.hidden = w.dx > 0
      slideTo(el, w.dx)
    }
    const end = () => {
      const el = w.el
      if (!el) return
      w.el = null
      if (w.mode !== 'h') return
      w.swallow = Date.now()
      el.style.transition = ''
      if (w.dx > el.offsetWidth * 0.33) {
        const r = told.current.right(Number(el.dataset.swipe))
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
      if (!w.el) return
      slideTo(w.el, w.el === w.open ? -w.reveal : 0)
      w.el.style.transition = ''
      w.el = null
    }
    // a tap right after a swipe is not a tap; a tap anywhere but the open row's buttons closes it
    const click = (e: MouseEvent) => {
      if (Date.now() - w.swallow < 400) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (w.open && !(e.target as Element).closest('[data-swipe-right]')) {
        close()
        e.preventDefault()
        e.stopPropagation()
      }
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
    }
  }, [listRef, enabled])
}
