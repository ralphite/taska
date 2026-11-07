// The one shell of a guided tour (F566, D105): the phone or desktop frame, the spot on the part to tap next on a layer
// that takes no clicks, and the line under the frame (the step, what to do, Next, a missing part, Start again). You
// tap; nothing plays by itself. It looks at the screen once a frame and engine.ts says which step it is on. A Demo
// (T589) draws the same shell round its page, with Play in the line.
import { useState, useRef, type ReactNode, type Ref } from 'react'
import type { Layout } from '../../app/context'
import { Frame, PHONE } from '../Frames'
import { finished } from './engine'
import type { Tour } from './tour'
import { useTour, type Spot, type TourView } from './useTour'

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

/** What the shell draws of a running tour: its step, where the spot is, and what its buttons do. */
export interface TourShellProps {
  layout: Layout
  tour: Tour
  view: TourView
  spot: Spot | null
  /** each Start again draws the screen anew */
  again: number
  label?: string
  width?: number
  height?: number
  /** Next, while the step waits for it (none: Next is not offered now) */
  onNext?(): void
  onAgain(): void
  /** a tap on the screen (the capture, before the page's own click) */
  onTap?(e: React.MouseEvent): void
  /** the box the screen is drawn in (a story's own screen: the tour looks at it) */
  screenRef?: Ref<HTMLDivElement>
  /** a button of the line's own after Next, in Next's style (a Demo's Play, T589) */
  more?: ReactNode
  /** the shell's own marks for a program that watches it (a Demo's: data-demo, data-playing) */
  data?: Record<string, string | undefined>
  children: ReactNode
}

/** The shell itself: the frame with the spot on it, the line under it, Start again. A guided tour and a Demo (T589)
 * draw it the same. */
export function TourShell({ layout, tour, view, spot, again, label, width, height, onNext, onAgain, onTap, screenRef, more, data, children }: TourShellProps) {
  const total = tour.steps.length
  const step = tour.steps[view.i]
  // a missing part is an error only in the automated check (a browser driven by a program), else a grey note
  const checking = typeof navigator !== 'undefined' && navigator.webdriver
  const marks = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]))
  return (
    <div
      data-tour
      data-step={view.i}
      data-done={finished(tour, view) || undefined}
      data-missing={view.missing || undefined}
      data-skipped={view.skipped || undefined}
      {...marks}
      className="flex flex-col gap-3"
      style={{ width: layout === 'phone' ? (width ?? PHONE.width) : width }}
    >
      <Frame layout={layout} width={width} height={height} label={label}>
        <div key={again} ref={screenRef} onClickCapture={onTap} className="relative h-full">
          {children}
          {spot ? <Mark at={spot} /> : null}
        </div>
      </Frame>
      <p className="flex min-h-10 items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <span className="font-mono text-xs text-zinc-400">
          {Math.min(view.i + 1, total)} / {total}
        </span>
        <span className="flex-1">{step?.say ?? 'Done'}</span>
        {step?.next && onNext ? <LineButton onClick={onNext}>Next</LineButton> : null}
        {more}
      </p>
      {view.missing && step?.target ? (
        <p className={`text-xs ${checking ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {step.target.label}: not on screen
        </p>
      ) : null}
      <button
        onClick={onAgain}
        className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30"
      >
        Start again
      </button>
    </div>
  )
}

/** A button in the line under the frame: Next, or a Demo's Play and Pause. */
export const LineButton = ({ onClick, children }: { onClick(): void; children: ReactNode }) => (
  <button onClick={onClick} className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
    {children}
  </button>
)

export interface TourFrameProps {
  layout: Layout
  tour: Tour
  label?: string
  width?: number
  height?: number
  /** each step as it begins */
  onStep?(i: number): void
  children: ReactNode
}

/** A guided tour over a story's own frame. */
export function TourFrame({ layout, tour, label, width, height, onStep, children }: TourFrameProps) {
  const root = useRef<HTMLDivElement>(null)
  const [again, setAgain] = useState(0)
  const screen = () => {
    const r = root.current
    if (!r) return null
    const a = r.getBoundingClientRect()
    return { root: r, box: r.parentElement ?? r, place: (b: DOMRect) => ({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }) }
  }
  const { view, spot, tap, pressNext } = useTour(tour, again, screen, onStep)
  return (
    <TourShell
      layout={layout}
      tour={tour}
      view={view}
      spot={spot}
      again={again}
      label={label}
      width={width}
      height={height}
      onNext={pressNext}
      onAgain={() => setAgain((x) => x + 1)}
      onTap={(e) => tap(e.target as Node)}
      screenRef={root}
    >
      {children}
    </TourShell>
  )
}
