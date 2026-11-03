// The one shell of a guided tour (F566, D105): the phone or desktop frame, the spot on the part to tap next on a layer
// that takes no clicks, and the line under the frame (the step, what to do, Next, a missing part, Start again). You
// tap; nothing plays by itself. It looks at the screen once a frame and engine.ts says which step it is on.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Layout } from '../../app/context'
import { Frame, PHONE } from '../Frames'
import { advance, begin, finished, missing } from './engine'
import { find, shown, type Target, type Tour, type Until } from './tour'

interface Spot {
  x: number
  y: number
  d: number
}
const same = (a: Spot | null, b: Spot | null) => a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.d - b.d) < 0.5)

/** The part, still there from the last frame (found again only once it is gone: finding it each frame is slow). */
const keep = (root: Element, el: Element | null, t: Target | undefined) => (!t ? null : el && el.isConnected && root.contains(el) && shown(el) ? el : find(root, t))
const subjectOf = (u: Until) => ('shows' in u ? u.shows : 'gone' in u ? u.gone : u.hasText)

/** Scrolls the frame's own scrolling part (never the Storybook page) so the part is in sight. */
function bringIntoSight(el: Element, box: Element) {
  for (let p = el.parentElement; p && box.contains(p); p = p.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(p).overflowY) || p.scrollHeight <= p.clientHeight) continue
    const a = p.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    if (b.top < a.top || b.bottom > a.bottom) p.scrollTop += b.top - a.top - (a.height - b.height) / 2
    return
  }
}

/** Where to tap next, as guided tours on the web mark it (F566, r970/r1004): a round, see-through yellow spot laid over
 * the part, a colour and shape Taska itself never uses: no frame, no words, nothing dimmed. It takes no clicks (they
 * reach the part under it). */
const Mark = ({ at }: { at: Spot }) => (
  <span
    data-tour-mark
    className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-yellow-300/60 mix-blend-multiply dark:mix-blend-screen"
    style={{ left: at.x, top: at.y, width: at.d, height: at.d }}
  />
)

export interface TourFrameProps {
  layout: Layout
  tour: Tour
  label?: string
  width?: number
  height?: number
  /** each step as it begins (a Demo hands out the recorded answers of that step) */
  onStep?(i: number): void
  children: ReactNode
}

export function TourFrame({ layout, tour, label, width, height, onStep, children }: TourFrameProps) {
  const root = useRef<HTMLDivElement>(null)
  const target = useRef<Element | null>(null)
  const tapped = useRef(false)
  const next = useRef(false)
  const [again, setAgain] = useState(0)
  const [view, setView] = useState({ i: 0, missing: false, skipped: '' })
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
      const r = root.current
      if (!r) return
      const s = tour.steps[run.i]
      const now = performance.now()
      const el = (target.current = keep(r, target.current, s?.target))
      const u = s?.until
      subject = u ? keep(r, subject, subjectOf(u)) : null
      const has = !!subject && (!u || !('hasText' in u) || (subject.textContent ?? '').includes(u.words))
      if (el && scrolled !== run.i && r.parentElement) {
        scrolled = run.i
        bringIntoSight(el, r.parentElement)
      }
      const look = { now, target: !s?.target || !!el, subject: has, tapped: tapped.current, next: next.current }
      tapped.current = next.current = false
      const was = run.i
      run = advance(tour, run, look)
      if (run.i !== was) {
        target.current = subject = null
        setSpot(null)
      } else if (el) {
        const a = r.getBoundingClientRect()
        const b = el.getBoundingClientRect()
        const n = { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2, d: Math.max(44, Math.min(b.width, b.height) + 20) }
        setSpot((p) => (same(p, n) ? p : n))
      } else setSpot(null)
      const v = { i: run.i, missing: missing(tour, run, look), skipped: run.skipped.join(',') }
      setView((p) => (p.i === v.i && p.missing === v.missing && p.skipped === v.skipped ? p : v))
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [tour, again])
  useEffect(() => onStep?.(view.i), [onStep, view.i])
  const total = tour.steps.length
  const step = tour.steps[view.i]
  const over = finished(tour, view)
  // a tap on the part the step names (it is still there: the capture comes before the page's own click)
  const tap = (e: React.MouseEvent) => {
    if (target.current?.contains(e.target as Node)) tapped.current = true
  }
  // a missing part is an error only in the automated check (a browser driven by a program), else a grey note
  const checking = typeof navigator !== 'undefined' && navigator.webdriver
  return (
    <div
      data-tour
      data-step={view.i}
      data-done={over || undefined}
      data-missing={view.missing || undefined}
      data-skipped={view.skipped || undefined}
      className="flex flex-col gap-3"
      style={{ width: layout === 'phone' ? (width ?? PHONE.width) : width }}
    >
      <Frame layout={layout} width={width} height={height} label={label}>
        <div key={again} ref={root} onClickCapture={tap} className="relative h-full">
          {children}
          {spot ? <Mark at={spot} /> : null}
        </div>
      </Frame>
      <p className="flex min-h-10 items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <span className="font-mono text-xs text-zinc-400">
          {Math.min(view.i + 1, total)} / {total}
        </span>
        <span className="flex-1">{step?.say ?? 'Done'}</span>
        {step?.next ? (
          <button onClick={() => (next.current = true)} className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Next
          </button>
        ) : null}
      </p>
      {view.missing && step?.target ? (
        <p className={`text-xs ${checking ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {step.target.label}: not on screen
        </p>
      ) : null}
      <button
        onClick={() => (setAgain((x) => x + 1), setView({ i: 0, missing: false, skipped: '' }), setSpot(null))}
        className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30"
      >
        Start again
      </button>
    </div>
  )
}
