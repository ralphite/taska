// B330: drag the sidebar's projects into your own order (as the old app did, F253). A mouse drags at once; a finger
// holds still first (moving at once scrolls). The row you hold follows the pointer, lifted; the others slide out of its
// way; on release it settles into the gap and the order is saved. The rows only move with transforms while you drag:
// React keeps the DOM, and draws the new order when it is saved.
import { DR, reduceMotion, titleOf } from './state'
import { saveProjOrder } from './settings'

export const PDRAG = {
  a: null as HTMLElement | null,
  on: false,
  id: 0,
  x: 0,
  y: 0,
  dy: 0,
  t: 0,
  touch: false,
  rows: [] as HTMLElement[],
  tops: [] as number[],
  from: 0,
  to: 0,
  ghost: null as HTMLElement | null,
}

const rowsIn = (box: HTMLElement) => [...box.querySelectorAll<HTMLElement>('a[data-slug]')]

function start() {
  const a = PDRAG.a!,
    r = a.getBoundingClientRect(),
    g = a.cloneNode(true) as HTMLElement
  PDRAG.on = true
  PDRAG.rows = rowsIn(a.parentElement!)
  PDRAG.tops = PDRAG.rows.map((x) => x.getBoundingClientRect().top)
  PDRAG.from = PDRAG.to = PDRAG.rows.indexOf(a)
  for (const x of ['href', 'data-act', 'aria-current', 'data-pressed', 'id']) g.removeAttribute(x)
  g.setAttribute('aria-hidden', 'true')
  g.classList.add('pointer-events-none', 'fixed', 'z-50', 'm-0', 'bg-white', 'shadow-xl', 'ring-1', 'ring-black/10')
  g.classList.add('dark:bg-zinc-800', 'dark:ring-white/10', 'scale-[1.03]')
  Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' })
  document.body.append(g)
  PDRAG.ghost = g
  PDRAG.dy = PDRAG.y - r.top
  a.dataset.dragging = ''
  navigator.vibrate?.(10)
}

// where the held row would land: the row under the pointer's middle half takes its place
function slide(y: number) {
  const { rows, tops, from } = PDRAG
  let to = PDRAG.to
  rows.forEach((x, i) => {
    const h = x.offsetHeight
    if (i !== from && y >= tops[i] + h / 4 && y < tops[i] + h - h / 4) to = i
  })
  if (to === PDRAG.to) return
  PDRAG.to = to
  const step = (tops[1] ?? tops[0] + rows[0].offsetHeight) - tops[0]
  rows.forEach((x, i) => {
    const shift =
      i === from
        ? tops[to] - tops[from]
        : from < to && i > from && i <= to
          ? -step
          : to < from && i >= to && i < from
            ? step
            : 0
    if (!reduceMotion()) x.style.transition = 'transform 160ms ease-out'
    x.style.transform = shift ? `translateY(${shift}px)` : ''
  })
}

function end(e?: PointerEvent) {
  clearTimeout(PDRAG.t)
  if (!PDRAG.a || (e && e.pointerId !== PDRAG.id)) return
  const a = PDRAG.a,
    on = PDRAG.on,
    ghost = PDRAG.ghost,
    { rows, from, to } = PDRAG
  PDRAG.a = null
  PDRAG.on = false
  PDRAG.ghost = null
  if (!on) return
  const tidy = () => {
    ghost?.remove()
    delete a.dataset.dragging
    for (const x of rows) x.style.transition = x.style.transform = ''
  }
  const names = rows.map((x) => x.dataset.slug!)
  names.splice(to, 0, names.splice(from, 1)[0])
  const land = () => {
    tidy()
    if (to !== from) {
      const p = (DR.list || []).find((x) => x.name === a.dataset.slug)
      void saveProjOrder(names, `${p ? titleOf(p) : a.dataset.slug} moved`)
    }
  }
  if (reduceMotion() || !ghost) land()
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

export function bindProjDrag(box: HTMLElement): () => void {
  const noNative = (e: DragEvent) => {
    if ((e.target as Element).closest?.('a[data-slug]')) e.preventDefault() // not the browser's own link dragging
  }
  const down = (e: PointerEvent) => {
    const a = (e.target as Element).closest<HTMLElement>('a[data-slug]')
    if (!a || e.button || rowsIn(box).length < 2) return
    clearTimeout(PDRAG.t)
    Object.assign(PDRAG, {
      a,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      on: false,
      touch: e.pointerType !== 'mouse',
    })
    if (PDRAG.touch)
      PDRAG.t = window.setTimeout(() => {
        if (PDRAG.a === a) start()
      }, 450)
  }
  const move = (e: PointerEvent) => {
    if (!PDRAG.a || e.pointerId !== PDRAG.id) return
    if (!PDRAG.on) {
      if (Math.hypot(e.clientX - PDRAG.x, e.clientY - PDRAG.y) < 6) return
      if (PDRAG.touch) {
        clearTimeout(PDRAG.t)
        PDRAG.a = null
        return
      }
      start()
    }
    PDRAG.ghost!.style.top = e.clientY - PDRAG.dy + 'px'
    slide(e.clientY)
  }
  const touchMove = (e: TouchEvent) => {
    if (PDRAG.on) e.preventDefault() // dragging, not scrolling
  }
  const menu = (e: Event) => {
    if (PDRAG.a && PDRAG.touch) e.preventDefault() // a long press is for dragging here
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
}
