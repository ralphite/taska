// A Demo's shell (T589, D124): the phone's frame and the desktop's side by side, each a page of its own (an iframe:
// its keys, storage and address its own), at a fixed size. Over each, the yellow spot on what to press next (the
// guided tour of F566); under each, the step and what to do, Play and Restart. It opens at step 1 and waits for you;
// Play presses for you at a person's pace, a pointer showing each press. Play is only here: a Demo is the only story
// that plays itself (scripts/check-architecture.mjs).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Layout } from '../../app/context'
import { finished } from '../tour/engine'
import { Mark } from '../tour/TourFrame'
import { useTour, type Spot } from '../tour/useTour'
import type { Demo } from './demos'

/** each frame's window, and how small it is drawn */
const SIZE: Record<Layout, { w: number; h: number }> = { phone: { w: 393, h: 852 }, desk: { w: 1280, h: 832 } }
const SCALE = 0.8
const NAME: Record<Layout, string> = { phone: 'Phone', desk: 'Desktop' }

/** Presses `el` as a finger or a mouse does: down, up, click, at its middle, in its own window. */
function press(el: Element) {
  const w = el.ownerDocument.defaultView
  if (!w) return
  const b = el.getBoundingClientRect()
  const at = { bubbles: true, cancelable: true, composed: true, view: w, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, button: 0 }
  el.dispatchEvent(new w.PointerEvent('pointerdown', { ...at, pointerId: 1, isPrimary: true, buttons: 1 }))
  el.dispatchEvent(new w.MouseEvent('mousedown', { ...at, buttons: 1 }))
  el.dispatchEvent(new w.PointerEvent('pointerup', { ...at, pointerId: 1, isPrimary: true }))
  el.dispatchEvent(new w.MouseEvent('mouseup', at))
  el.dispatchEvent(new w.MouseEvent('click', at))
}

/** Where Play's pointer is, and whether it is pressing. */
interface Pointer {
  x: number
  y: number
  down: boolean
}

/** Play's pointer: a dark dot that moves to the part, and a ring where it presses. */
const PointerMark = ({ at }: { at: Pointer }) => (
  <span data-demo-pointer={at.down || undefined} className="pointer-events-none absolute z-50 transition-[left,top] duration-500 ease-out" style={{ left: at.x, top: at.y }}>
    <span className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900/75 ring-2 ring-white transition-[width,height] duration-150 dark:bg-white/80 dark:ring-zinc-900 ${at.down ? 'size-4' : 'size-6'}`} />
    {at.down ? <span className="absolute size-12 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-zinc-900/70 dark:border-white/80" /> : null}
  </span>
)

export function DemoFrame({ demo, layout, theme, record = false }: { demo: Demo; layout: Layout; theme: string; record?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [again, setAgain] = useState(0)
  const [playing, setPlaying] = useState(record)
  const [pointer, setPointer] = useState<Pointer | null>(null)
  const tour = demo.tours[layout]
  const size = SIZE[layout]
  // the page in the frame, once it has drawn itself
  const screen = () => {
    const doc = frame.current?.contentDocument
    const root = doc?.body
    if (!root || !doc.documentElement.contains(root.querySelector('[data-layout]'))) return null
    return { root, place: (b: DOMRect) => ({ x: b.left * SCALE, y: b.top * SCALE, w: b.width * SCALE, h: b.height * SCALE }) }
  }
  const { view, spot, target, tap, pressNext } = useTour(tour, again, screen)
  const spotNow = useRef<Spot | null>(null)
  useLayoutEffect(() => {
    spotNow.current = spot
  })
  const over = finished(tour, view)
  const step = tour.steps[view.i]

  // a press on the part the step names, in the frame's own page (before the page's own click)
  const listen = () => {
    const doc = frame.current?.contentDocument
    doc?.addEventListener('click', (e) => tap(e.target as Node), true)
  }

  // Play: at a person's pace, to the part, then press it; a step that only waits is waited for
  const active = playing && !over
  useEffect(() => {
    if (!active) return
    const s = tour.steps[view.i]
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => void timers.push(window.setTimeout(fn, ms))
    const go = () => {
      const el = target()
      const at = spotNow.current
      if (!el || !at) return after(250, go)
      setPointer({ x: at.x, y: at.y, down: false })
      after(650, () => {
        setPointer({ x: at.x, y: at.y, down: true })
        press(el)
        after(400, () => setPointer((p) => p && { ...p, down: false }))
      })
    }
    if (s.next) after(s.pace ?? 1500, pressNext)
    else if (s.target) after(s.pace ?? 1200, go)
    return () => timers.forEach((t) => clearTimeout(t))
  }, [active, view.i, again, tour, target, pressNext])

  const src = `iframe.html?id=demo-frames--page&viewMode=story&demo=${demo.id}&layout=${layout}${record ? '&net=record' : ''}&globals=theme:${theme}`
  const checking = typeof navigator !== 'undefined' && navigator.webdriver
  const total = tour.steps.length
  return (
    <figure
      data-demo={layout}
      data-step={view.i}
      data-done={over || undefined}
      data-missing={view.missing || undefined}
      data-skipped={view.skipped || undefined}
      data-playing={active || undefined}
      className="m-0 flex flex-col gap-2"
      style={{ width: size.w * SCALE }}
    >
      <figcaption className="font-sans text-xs text-zinc-500">{NAME[layout]}</figcaption>
      <div className="relative overflow-hidden bg-white ring-1 ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-600" style={{ width: size.w * SCALE, height: size.h * SCALE }}>
        <iframe
          key={again}
          ref={frame}
          src={src}
          title={`${NAME[layout]}: the page`}
          onLoad={listen}
          className="absolute top-0 left-0 origin-top-left border-0"
          style={{ width: size.w, height: size.h, transform: `scale(${SCALE})` }}
        />
        {spot ? <Mark at={spot} /> : null}
        {active && pointer ? <PointerMark at={pointer} /> : null}
      </div>
      <div className="flex min-h-10 flex-wrap items-center justify-end gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <p className="m-0 flex grow basis-72 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs whitespace-nowrap text-zinc-400">
            {Math.min(view.i + 1, total)} / {total}
          </span>
          <span>{step?.say ?? 'Done'}</span>
        </p>
        {step?.next && !active ? (
          <button onClick={pressNext} className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Next
          </button>
        ) : null}
        {!record ? (
          <>
            <button
              onClick={() => (over ? (setAgain((x) => x + 1), setPlaying(true)) : setPlaying(!active))}
              className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {active ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => (setAgain((x) => x + 1), setPlaying(false), setPointer(null))}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30"
            >
              Restart
            </button>
          </>
        ) : null}
      </div>
      {view.missing && step?.target ? (
        <p className={`text-xs ${checking ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>{step.target.label}: not on screen</p>
      ) : null}
    </figure>
  )
}

/** A Demo: the phone and the desktop side by side. While web/scripts/record-demo.mjs records one layout (?record=phone),
 * only that one, playing from the start against the real server it gives. */
export function DemoFrames({ demo, theme }: { demo: Demo; theme: string }) {
  const record = new URLSearchParams(window.location.search).get('record')
  const layouts: Layout[] = record === 'phone' || record === 'desk' ? [record] : ['phone', 'desk']
  return (
    <div className="flex min-h-screen flex-wrap items-start gap-8 bg-zinc-100 p-6 dark:bg-zinc-900">
      {layouts.map((l) => (
        <DemoFrame key={l} demo={demo} layout={l} theme={theme} record={!!record} />
      ))}
    </div>
  )
}
