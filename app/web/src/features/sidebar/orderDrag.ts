// Dragging the sidebar's projects into your own order. A mouse drags at once; a finger holds still first (moving at
// once scrolls). The row you hold follows the pointer, lifted; the others slide out of its way; on release it settles
// into the gap and the new order is told. The rows only move with transforms while you drag: React keeps the rows
// and draws the new order once it is told.

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const rowsIn = (box: HTMLElement) => [...box.querySelectorAll<HTMLElement>('a[data-slug]')]
const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function useOrderDrag(boxRef: RefObject<HTMLElement | null>, onOrder: (names: string[], moved: string) => void): void {
  const told = useRef(onOrder)
  useEffect(() => {
    told.current = onOrder
  })
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const s = { a: null as HTMLElement | null, on: false, id: 0, x: 0, y: 0, dy: 0, t: 0, touch: false, rows: [] as HTMLElement[], tops: [] as number[], from: 0, to: 0, ghost: null as HTMLElement | null }
    const start = () => {
      const a = s.a as HTMLElement
      const r = a.getBoundingClientRect()
      const g = a.cloneNode(true) as HTMLElement
      s.on = true
      s.rows = rowsIn(box)
      s.tops = s.rows.map((x) => x.getBoundingClientRect().top)
      s.from = s.to = s.rows.indexOf(a)
      for (const x of ['href', 'aria-current', 'data-pressed', 'id']) g.removeAttribute(x)
      g.setAttribute('aria-hidden', 'true')
      g.classList.add('pointer-events-none', 'fixed', 'z-50', 'm-0', 'bg-white', 'shadow-xl', 'ring-1', 'ring-black/10', 'dark:bg-zinc-800', 'dark:ring-white/10', 'scale-[1.03]')
      Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' })
      box.ownerDocument.body.append(g)
      s.ghost = g
      s.dy = s.y - r.top
      a.dataset.dragging = ''
      navigator.vibrate?.(10)
    }
    // where the held row would land: the row under the pointer's middle half takes its place
    const slide = (y: number) => {
      const { rows, tops, from } = s
      let to = s.to
      rows.forEach((x, i) => {
        const h = x.offsetHeight
        if (i !== from && y >= tops[i] + h / 4 && y < tops[i] + h - h / 4) to = i
      })
      if (to === s.to) return
      s.to = to
      const step = (tops[1] ?? tops[0] + rows[0].offsetHeight) - tops[0]
      rows.forEach((x, i) => {
        const shift = i === from ? tops[to] - tops[from] : from < to && i > from && i <= to ? -step : to < from && i >= to && i < from ? step : 0
        if (!still()) x.style.transition = 'transform 160ms ease-out'
        x.style.transform = shift ? `translateY(${shift}px)` : ''
      })
    }
    const end = (e?: PointerEvent) => {
      clearTimeout(s.t)
      if (!s.a || (e && e.pointerId !== s.id)) return
      const a = s.a
      const on = s.on
      const ghost = s.ghost
      const { rows, from, to } = s
      s.a = null
      s.on = false
      s.ghost = null
      if (!on) return
      const tidy = () => {
        ghost?.remove()
        delete a.dataset.dragging
        for (const x of rows) x.style.transition = x.style.transform = ''
      }
      const names = rows.map((x) => x.dataset.slug as string)
      names.splice(to, 0, names.splice(from, 1)[0])
      const land = () => {
        tidy()
        if (to !== from) told.current(names, a.dataset.slug as string)
      }
      if (still() || !ghost) land()
      else {
        const at = a.getBoundingClientRect()
        ghost.style.transition = 'top 150ms ease-out, left 150ms ease-out'
        ghost.classList.remove('scale-[1.03]')
        Object.assign(ghost.style, { top: at.top + 'px', left: at.left + 'px' })
        setTimeout(land, 160)
      }
      // the drop is not a click on the row
      const eat = (ev: Event) => {
        ev.preventDefault()
        ev.stopPropagation()
      }
      addEventListener('click', eat, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', eat, true), 400)
    }
    const noNative = (e: DragEvent) => {
      if ((e.target as Element).closest?.('a[data-slug]')) e.preventDefault() // not the browser's own link dragging
    }
    const down = (e: PointerEvent) => {
      const a = (e.target as Element).closest<HTMLElement>('a[data-slug]')
      if (!a || e.button || rowsIn(box).length < 2) return
      clearTimeout(s.t)
      Object.assign(s, { a, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse' })
      if (s.touch)
        s.t = window.setTimeout(() => {
          if (s.a === a) start()
        }, 450)
    }
    const move = (e: PointerEvent) => {
      if (!s.a || e.pointerId !== s.id) return
      if (!s.on) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return
        if (s.touch) {
          clearTimeout(s.t)
          s.a = null
          return
        }
        start()
      }
      if (s.ghost) s.ghost.style.top = e.clientY - s.dy + 'px'
      slide(e.clientY)
    }
    const touchMove = (e: TouchEvent) => {
      if (s.on) e.preventDefault() // dragging, not scrolling
    }
    const menu = (e: Event) => {
      if (s.a && s.touch) e.preventDefault() // a long press is for dragging here
    }
    box.addEventListener('dragstart', noNative)
    box.addEventListener('pointerdown', down)
    box.addEventListener('touchmove', touchMove, { passive: false })
    box.addEventListener('contextmenu', menu)
    addEventListener('pointermove', move)
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
    return () => {
      box.removeEventListener('dragstart', noNative)
      box.removeEventListener('pointerdown', down)
      box.removeEventListener('touchmove', touchMove)
      box.removeEventListener('contextmenu', menu)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', end)
      removeEventListener('pointercancel', end)
    }
  }, [boxRef])
}
