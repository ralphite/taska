// A Demo's shell (T589, D124): the phone's frame and the desktop's side by side, each a page of its own (an iframe:
// its keys, storage and address its own). Each is drawn by the guided tour's own shell (tour/TourFrame.tsx, F566):
// the yellow spot on what to press next, and under it the step, what to do, Next and Start again. It opens at step 1
// and waits for you; Play, in the line, presses for you at a person's pace, the same spot on each part it presses (no
// mark of its own). Play is only here: a Demo is the only story that plays itself (scripts/check-architecture.mjs).

import { useEffect, useRef, useState } from 'react'
import type { Layout } from '../../app/context'
import { finished } from '../tour/engine'
import { LineButton, TourShell } from '../tour/TourFrame'
import { useTour } from '../tour/useTour'
import type { Demo } from './demos'

/** each frame's window */
const SIZE: Record<Layout, { w: number; h: number }> = { phone: { w: 393, h: 852 }, desk: { w: 1280, h: 832 } }
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

export function DemoFrame({ demo, layout, theme, record = false }: { demo: Demo; layout: Layout; theme: string; record?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [again, setAgain] = useState(0)
  const [playing, setPlaying] = useState(record)
  const tour = demo.tours[layout]
  const size = SIZE[layout]
  // the page in the frame, once it has drawn itself (it fills the frame from its corner: its pixels are the shell's)
  const screen = () => {
    const doc = frame.current?.contentDocument
    const root = doc?.body
    if (!root || !doc.documentElement.contains(root.querySelector('[data-layout]'))) return null
    return { root, place: (b: DOMRect) => ({ x: b.left, y: b.top, w: b.width, h: b.height }) }
  }
  const { view, spot, target, tap, pressNext } = useTour(tour, again, screen)
  const over = finished(tour, view)

  // a press on the part the step names, in the frame's own page (before the page's own click)
  const listen = () => {
    const doc = frame.current?.contentDocument
    doc?.addEventListener('click', (e) => tap(e.target as Node), true)
  }

  // Play: at a person's pace, the spot on the part, then the press; a step that only waits is waited for
  const active = playing && !over
  useEffect(() => {
    if (!active) return
    const s = tour.steps[view.i]
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => void timers.push(window.setTimeout(fn, ms))
    const go = () => {
      const el = target()
      if (el) press(el)
      else after(250, go)
    }
    if (s.next) after(s.pace ?? 1500, pressNext)
    else if (s.target) after(s.pace ?? 1200, go)
    return () => timers.forEach((t) => clearTimeout(t))
  }, [active, view.i, again, tour, target, pressNext])

  const src = `iframe.html?id=demo-frames--page&viewMode=story&demo=${demo.id}&layout=${layout}${record ? '&net=record' : ''}&globals=theme:${theme}`
  // Play at the end plays it again from the start
  const play = () => (over ? (setAgain((x) => x + 1), setPlaying(true)) : setPlaying(!active))
  return (
    <TourShell
      layout={layout}
      tour={tour}
      view={view}
      spot={spot}
      again={again}
      label={NAME[layout]}
      width={size.w}
      height={size.h}
      onNext={active ? undefined : pressNext}
      onAgain={() => (setAgain((x) => x + 1), setPlaying(false))}
      more={record ? null : <LineButton onClick={play}>{active ? 'Pause' : 'Play'}</LineButton>}
      data={{ demo: layout, playing: active ? 'true' : undefined }}
    >
      <iframe ref={frame} src={src} title={`${NAME[layout]}: the page`} onLoad={listen} className="absolute inset-0 size-full border-0" />
    </TourShell>
  )
}

/** A Demo: the phone and the desktop side by side. While web/scripts/record-demo.mjs records one layout (?record=phone),
 * only that one, playing from the start against the real server it gives. */
export function DemoFrames({ demo, theme }: { demo: Demo; theme: string }) {
  const record = new URLSearchParams(window.location.search).get('record')
  const layouts: Layout[] = record === 'phone' || record === 'desk' ? [record] : ['phone', 'desk']
  return (
    <div className="flex flex-wrap items-start gap-8">
      {layouts.map((l) => (
        <DemoFrame key={l} demo={demo} layout={l} theme={theme} record={!!record} />
      ))}
    </div>
  )
}
