// B555: a component story is the real page (the same app the Pages stories open, on the demo's data) at the story's
// address, after its steps, with only its part in sight: the page is laid out at the screen's full size, as on a real
// one, and moved so the part sits at the frame's top left; the frame is as big as the part. Nothing is drawn here
// but the page, so what the story shows is what the page shows.
import { useEffect, useRef, useState } from 'react'
import { App } from '../pages/screens'
import type { StoryObj } from '@storybook/react-vite'
import { doSteps, partOn, pointed, type Do, type Twin } from './twin'

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
/** Whether some of it is out of sight: past the window's edge, or cut off by a box around it that scrolls. */
function hidden(el: HTMLElement, win: Window) {
  const r = el.getBoundingClientRect()
  if (r.top < 0 || r.bottom > win.innerHeight) return true
  for (let a = el.parentElement; a && a !== el.ownerDocument.body; a = a.parentElement) {
    if (!/(auto|scroll|hidden)/.test(win.getComputedStyle(a).overflowY)) continue
    const o = a.getBoundingClientRect()
    if (r.top < o.top - 1 || (r.bottom > o.bottom + 1 && r.height <= o.height)) return true
  }
  return false
}
type Box = { x: number; y: number; w: number; h: number }
// a few pages load at once (a gallery of looks has many): the next starts once one has drawn its part
const SLOTS = { free: 3, queue: [] as (() => void)[] }
const slot = () =>
  new Promise<void>((ok) => {
    if (SLOTS.free > 0) {
      SLOTS.free--
      ok()
    } else SLOTS.queue.push(ok)
  })
const unslot = () => {
  const next = SLOTS.queue.shift()
  if (next) next()
  else SLOTS.free++
}

/** The real page at the twin's place, its part only. */
export function OnPage({ twin, scheme }: { twin: Twin; scheme: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [err, setErr] = useState('')
  const [on, setOn] = useState(false) // its turn to load
  useEffect(() => {
    let mine = false,
      gone = false
    void slot().then(() => {
      mine = true
      if (gone) unslot()
      else setOn(true)
    })
    return () => {
      gone = true
      if (mine) unslot()
    }
  }, [])
  useEffect(() => {
    const f = frame.current
    if (!on || !f) return
    let gone = false,
      freed = false,
      stop = () => {}
    const free = () => {
      if (!freed) unslot()
      freed = true
    }
    const go = async () => {
      // the page has drawn with its data: the project's list or its item, its home page (on the real server in the
      // page, Taska first starts there)
      let doc: Document | null = null
      for (let i = 0; i < 600 && !gone; i++) {
        doc = f.contentDocument
        if (doc?.querySelector('#home, #app, #root > *') && !/Loading\u2026/.test(doc.body.innerText)) break
        await wait(50)
      }
      if (!doc || gone) return
      // and has what it asked Taska for (its state, the real server in the page started): a person starts then (at
      // most 10 s: a story where Taska never answers starts anyway)
      const busy = (doc.defaultView as Window & { __storyBusy?: () => number }).__storyBusy
      for (let i = 0, quiet = 0; i < 200 && quiet < 8 && !gone; i++) {
        quiet = busy && busy() > 0 ? 0 : quiet + 1
        await wait(50)
      }
      await wait(700)
      await doSteps(doc, twin.steps || [], /^\/p\/([^/]+)/.exec(twin.at)?.[1] || 'shop')
      if (twin.hover) pointed(doc, twin.hover, 'hover')
      if (twin.focus) pointed(doc, twin.focus, 'focus-visible')
      // the part, measured again whenever the page moves it or it changes size; first scrolled into sight, as a person
      // scrolls to see it
      const win = doc.defaultView as Window & typeof globalThis,
        sels = partOn(twin.part, win.innerWidth >= 1024)
      for (const s of sels) {
        const el = [...doc.querySelectorAll<HTMLElement>(s)].find((e) => e.getClientRects().length)
        // only when it is out of sight, in the window or in what scrolls around it (a talk scrolled to its end): a
        // scroll would end what the steps hold (a drag)
        if (el && hidden(el, win))
          el.scrollIntoView({ block: el.getBoundingClientRect().height > win.innerHeight * 0.8 ? 'start' : 'center' })
      }
      await wait(300)
      const measure = () => {
        const rs = sels
          .map((s) => [...doc.querySelectorAll<HTMLElement>(s)].find((e) => e.getClientRects().length))
          .filter((e): e is HTMLElement => !!e)
          .map((e) => e.getBoundingClientRect())
        if (!rs.length) return setErr(`not on the page: ${sels.join(', ')}`)
        const x = Math.min(...rs.map((r) => r.left)),
          y = Math.min(...rs.map((r) => r.top)),
          w = Math.max(...rs.map((r) => r.right)) - x,
          h = Math.max(...rs.map((r) => r.bottom)) - y
        setErr('')
        setBox((b) => (b && b.x === x && b.y === y && b.w === w && b.h === h ? b : { x, y, w, h }))
      }
      measure()
      free()
      if (twin.still) {
        await wait(1200) // what the pointer brings (a tip) has come
        ;(win as Window & { __storyStill?: () => void }).__storyStill?.()
      }
      const ro = new win.ResizeObserver(measure),
        mo = new win.MutationObserver(measure)
      ro.observe(doc.body)
      mo.observe(doc.body, { subtree: true, childList: true, attributes: true })
      // and when what moves by itself has got where it goes (a tip sliding into place)
      for (const t of ['transitionend', 'animationend']) doc.addEventListener(t, measure, true)
      stop = () => {
        ro.disconnect()
        mo.disconnect()
        for (const t of ['transitionend', 'animationend']) doc.removeEventListener(t, measure, true)
      }
    }
    go()
      .catch((e: Error) => setErr(e.message))
      .finally(free)
    return () => {
      gone = true
      free()
      stop()
    }
  }, [on, twin])
  const W = innerWidth,
    H = twin.height || innerHeight
  return (
    <div
      data-story-part={partOn(twin.part, innerWidth >= 1024).join(', ')}
      data-ready={box ? '' : undefined}
      className="relative overflow-hidden"
      style={{ width: box ? box.w : W, height: box ? box.h : on ? H : 120 }}
    >
      {on ? (
        <div className="absolute" style={{ width: W, height: H, left: -(box?.x || 0), top: -(box?.y || 0) }}>
          <App
            path={twin.at}
            scheme={scheme}
            server={
              (twin.live ?? (!!twin.steps?.length && !twin.net))
                ? JSON.stringify(twin.heard ? { heard: twin.heard } : {})
                : undefined
            }
            as={{ net: twin.net, items: twin.words }}
            frameRef={frame}
          />
        </div>
      ) : null}
      {err ? <p className="absolute inset-x-0 top-0 bg-red-600 p-2 text-sm text-white">{err}</p> : null}
    </div>
  )
}

/** One look of a part: what is done to it (a press, a drag, a click with Cmd held), the pointer on it, the keyboard's
 * focus on it. */
export interface Look {
  /** what this look is, in a few words (Storybook's label above it, not the page's) */
  name: string
  /** another address than the gallery's */
  at?: string
  steps?: Do[]
  hover?: string
  focus?: string
  part?: Twin['part']
  /** how Taska answers here (a change still on its way) */
  net?: Twin['net']
}
/** T522 (r731, r762): every look of one part side by side, each the real page there (B555). */
export function Looks({ base, each, scheme }: { base: Twin; each: Look[]; scheme: string }) {
  return (
    <div className="flex flex-col gap-6 p-4">
      {each.map((l) => (
        <section key={l.name}>
          <h3 className="mb-2 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">{l.name}</h3>
          <OnPage
            twin={{
              ...base,
              ...l,
              steps: [...(base.steps || []), ...(l.steps || [])],
              live: base.live ?? false, // a look is a pointer, a key, a press, a drag: nothing Taska keeps
            }}
            scheme={scheme}
          />
        </section>
      ))}
    </div>
  )
}

/** What a component story is (B555): a place on the real page, a part's looks there, or (only for a gallery of one
 * component's looks, given its props: the icons, the status marks, the keys) the component itself. Nothing else: a
 * story cannot set the page's state, so it cannot show one the page is never in (.storybook/check.mjs). */
export interface TaskaParams {
  /** where on the real page the story stands (an address, then what is done there) and the part it shows */
  page?: Twin
  /** a part's looks side by side, each the real page there */
  looks?: { base: Twin; each: Look[] }
  /** one component's looks side by side, each from its own props: not a place on the page */
  gallery?: boolean
  /** words about the section (Components/About this section), no part of the page */
  about?: boolean
}
declare module '@storybook/react-vite' {
  interface Parameters {
    taska?: TaskaParams
  }
}

/** A story that is this place on the real page; `on`: a part only the desktop or only the phone has. */
export const place = (twin: Twin, on?: 'desktop' | 'phone'): StoryObj => ({
  parameters: { taska: { page: twin }, ...(on ? { platform: on } : {}) },
  render: () => <></>,
})
/** A story of a part's looks side by side, each the real page (the desktop's, unless `on` says otherwise). */
export const looksOf = (base: Twin, each: Look[], on: 'desktop' | 'phone' | 'both' = 'desktop'): StoryObj => ({
  parameters: { taska: { looks: { base, each } }, ...(on === 'both' ? {} : { platform: on }) },
  render: () => <></>,
})
