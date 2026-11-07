// A tour running over a screen (F566, D105): once a frame it looks at the screen, hands what it saw to engine.ts and
// says where the spot goes. TourFrame runs it over a story's own frame; a Demo's frame (T589) over a page in a frame
// of its own. The screen is found again each frame (a Demo's page is new after Start again).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { advance, begin, missing } from './engine'
import { find, shown, type Target, type Tour, type Until } from './tour'

/** Where the spot goes, in the shell's own pixels: its centre and its size. */
export interface Spot {
  x: number
  y: number
  d: number
}
export const sameSpot = (a: Spot | null, b: Spot | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.d - b.d) < 0.5)

/** The screen a tour looks at: the part that holds the page, and where a part of it is on the shell. */
export interface Screen {
  root: Element
  /** where its scrolling parts are (the root, unless it scrolls inside a frame round it) */
  box?: Element
  /** a part's box as the shell draws it */
  place(box: DOMRect): { x: number; y: number; w: number; h: number }
}

export interface TourView {
  i: number
  missing: boolean
  skipped: string
}

/** The part, still there from the last frame (found again only once it is gone: finding it each frame is slow). */
const keep = (root: Element, el: Element | null, t: Target | undefined) => (!t ? null : el && el.isConnected && root.contains(el) && shown(el) ? el : find(root, t))
const subjectOf = (u: Until) => ('shows' in u ? u.shows : 'gone' in u ? u.gone : u.hasText)

/** Scrolls the screen's own scrolling part (never the page around it) so the part is in sight. */
function bringIntoSight(el: Element, box: Element) {
  for (let p = el.parentElement; p && box.contains(p); p = p.parentElement) {
    if (!/(auto|scroll)/.test((p.ownerDocument.defaultView ?? window).getComputedStyle(p).overflowY) || p.scrollHeight <= p.clientHeight) continue
    const a = p.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    if (b.top < a.top || b.bottom > a.bottom) p.scrollTop += b.top - a.top - (a.height - b.height) / 2
    return
  }
}

/** Runs `tour` over the screen `screen()` gives, from its first step each time `again` changes. -> the step, the spot,
 * the part the step names now, and what the shell tells it: something was tapped (its part, or not), Next was tapped. */
export function useTour(tour: Tour, again: number, screen: () => Screen | null, onStep?: (i: number) => void) {
  const target = useRef<Element | null>(null)
  const tapped = useRef(false)
  const next = useRef(false)
  const screenOf = useRef(screen)
  useLayoutEffect(() => {
    screenOf.current = screen
  })
  const [view, setView] = useState<TourView>({ i: 0, missing: false, skipped: '' })
  const [spot, setSpot] = useState<Spot | null>(null)
  useLayoutEffect(() => {
    let run = begin(performance.now())
    let subject: Element | null = null
    let scrolled = -1
    let raf = 0
    target.current = null
    tapped.current = next.current = false
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const sc = screenOf.current()
      if (!sc) return
      const r = sc.root
      const s = tour.steps[run.i]
      const now = performance.now()
      const el = (target.current = keep(r, target.current, s?.target))
      const u = s?.until
      subject = u ? keep(r, subject, subjectOf(u)) : null
      const has = !!subject && (!u || !('hasText' in u) || (subject.textContent ?? '').includes(u.words))
      if (el && scrolled !== run.i) {
        scrolled = run.i
        bringIntoSight(el, sc.box ?? r)
      }
      const look = { now, target: !s?.target || !!el, subject: has, tapped: tapped.current, next: next.current }
      tapped.current = next.current = false
      const was = run.i
      run = advance(tour, run, look)
      if (run.i !== was) {
        target.current = subject = null
        setSpot(null)
      } else if (el) {
        const b = sc.place(el.getBoundingClientRect())
        const n = { x: b.x + b.w / 2, y: b.y + b.h / 2, d: Math.max(44, Math.min(b.w, b.h) + 20) }
        setSpot((p) => (sameSpot(p, n) ? p : n))
      } else setSpot(null)
      const v = { i: run.i, missing: missing(tour, run, look), skipped: run.skipped.join(',') }
      setView((p) => (p.i === v.i && p.missing === v.missing && p.skipped === v.skipped ? p : v))
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [tour, again])
  useEffect(() => onStep?.(view.i), [onStep, view.i])
  // the shell's hands on the tour, the same each time (a player's effect depends on them)
  const [hands] = useState(() => ({
    /** the part the step names, as it was last found */
    target: () => target.current,
    /** something on the screen was tapped (the capture, before the page's own click: the part is still there) */
    tap: (on: Node) => {
      if (target.current?.contains(on)) tapped.current = true
    },
    /** Next was tapped */
    pressNext: () => {
      next.current = true
    },
  }))
  return { view, spot, ...hands }
}
