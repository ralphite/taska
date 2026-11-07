// The one shell of a guided tour (F566, D105): the phone or desktop frame, the spot on the part to tap next on a layer
// that takes no clicks, and the line under the frame (the step, what to do, Next, a missing part, Start again). You
// tap; nothing plays by itself. It looks at the screen once a frame and engine.ts says which step it is on.
import { useState, useRef, type ReactNode } from 'react'
import type { Layout } from '../../app/context'
import { Frame, PHONE } from '../Frames'
import { finished } from './engine'
import type { Tour } from './tour'
import { useTour, type Spot } from './useTour'

/** Where to tap next, as guided tours on the web mark it (F566, r970/r1004): a round, see-through yellow spot laid over
 * the part, a colour and shape Taska itself never uses: no frame, no words, nothing dimmed. It takes no clicks (they
 * reach the part under it). */
export const Mark = ({ at }: { at: Spot }) => (
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
  const [again, setAgain] = useState(0)
  const screen = () => {
    const r = root.current
    if (!r) return null
    const a = r.getBoundingClientRect()
    return { root: r, box: r.parentElement ?? r, place: (b: DOMRect) => ({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }) }
  }
  const { view, spot, tap: tapOn, pressNext } = useTour(tour, again, screen, onStep)
  const total = tour.steps.length
  const step = tour.steps[view.i]
  const over = finished(tour, view)
  // a tap on the part the step names (it is still there: the capture comes before the page's own click)
  const tap = (e: React.MouseEvent) => tapOn(e.target as Node)
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
          <button onClick={pressNext} className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
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
        onClick={() => setAgain((x) => x + 1)}
        className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30"
      >
        Start again
      </button>
    </div>
  )
}
