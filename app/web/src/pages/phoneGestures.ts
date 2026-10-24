// The phone's two page gestures. The drawer drags shut (it follows the finger; let go past 70% open it stays). On an
// item's page a swipe right goes back: the page follows the finger with the list showing underneath, and goes when
// let go far or fast enough, else comes back. Scrolling up and down, a swipe the other way, the screen's left edge
// (the phone's own Back), a sheet over the page and words in a field or code block keep their own touch.

import { useRef, useState, type TouchEvent } from 'react'

export const drawerWidth = () => Math.min(innerWidth * 0.85, 320)
const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export interface BackPull {
  dx: number
  /** let go: sliding out (or back) */
  anim: boolean
}

export function useDrawerPull(open: boolean, shut: () => void) {
  const [pull, setPull] = useState<number | null>(null)
  const g = useRef<{ x0: number; y0: number; from: number; pull: boolean; x: number } | null>(null)
  const handlers = {
    onTouchStart: (e: TouchEvent) => {
      g.current = null
      if (!open || e.touches.length !== 1) return
      const t = e.touches[0]
      g.current = { x0: t.clientX, y0: t.clientY, from: drawerWidth(), pull: false, x: drawerWidth() }
    },
    onTouchMove: (e: TouchEvent) => {
      const s = g.current
      // a project being dragged into its place does not pull the drawer
      if (!s || (e.target as Element).closest?.('[data-dragging]') || e.currentTarget.querySelector('[data-dragging]')) return
      const t = e.touches[0]
      const dx = t.clientX - s.x0
      const dy = t.clientY - s.y0
      if (!s.pull && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        g.current = null // scrolling, not the drawer
        return
      }
      s.pull = s.pull || Math.abs(dx) > 10
      if (s.pull) setPull((s.x = Math.max(0, Math.min(drawerWidth(), s.from + dx))))
    },
    onTouchEnd: () => {
      const s = g.current
      g.current = null
      if (!s?.pull) return
      setPull(null)
      if (s.x <= drawerWidth() * 0.7) shut()
    },
  }
  return { pull, handlers }
}

export function useBackSwipe(enabled: boolean, back: () => void) {
  const [pull, setPull] = useState<BackPull | null>(null)
  const b = useRef({ on: false, pull: false, x0: 0, y0: 0, dx: 0, t0: 0 })
  const end = (el: HTMLElement) => {
    const s = b.current
    if (!s.pull) return
    s.on = false
    const w = el.offsetWidth
    const go = s.dx > w * 0.3 || (s.dx > 60 && Date.now() - s.t0 < 300)
    setPull({ dx: go ? w : 0, anim: !still() })
    setTimeout(() => {
      s.pull = false
      setPull(null)
      if (go) back()
    }, 180)
  }
  const handlers = {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      const t = e.touches[0]
      const s = b.current
      s.on = enabled && e.touches.length === 1 && t.clientX > 24 && !(e.target as Element).closest('.overflow-x-auto, pre, input, textarea')
      Object.assign(s, { x0: t.clientX, y0: t.clientY, dx: 0, t0: Date.now() })
    },
    onTouchMove: (e: TouchEvent<HTMLElement>) => {
      const s = b.current
      if (!s.on) return
      const t = e.touches[0]
      const dx = t.clientX - s.x0
      const dy = t.clientY - s.y0
      if (!s.pull) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        if (dx < 0 || Math.abs(dy) > Math.abs(dx)) {
          s.on = false // scrolling, or a swipe the other way
          return
        }
        s.pull = true
      }
      s.dx = Math.max(0, dx)
      setPull({ dx: s.dx, anim: false })
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => end(e.currentTarget),
    onTouchCancel: (e: TouchEvent<HTMLElement>) => {
      b.current.dx = 0
      end(e.currentTarget)
    },
  }
  return { pull, handlers }
}
