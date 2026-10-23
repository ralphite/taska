// B536 (r469): a prototype of the input box in light mode, to look at before anything is built. In light the box is
// white on the white page, apart only by a thin light grey border (the New input page most of all; also under an item's
// talk and under the list on the phone). Yadong (r469): the box's background and the background around it must
// differ. Each story is the real page (the Storybook demo project), as it is, with only the box's look changed (and in
// option 2 the ground it stands on): the page draws itself, then the prototype swaps a few Tailwind classes on the
// page's own elements (#composer, the box; #foot, what it stands on), on the light page only: dark stays as it is.
// It uses only classes the page already has (so the page's stylesheet has them, in any running Storybook).
// PROTOTYPE ONLY: nothing here changes Taska itself.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { single } from '../stories/lib/both'
import { App, SHOP, wait } from '../stories/pages/screens'

const meta: Meta = {
  title: 'Prototype/B536 Input box in light mode',
  // the frames fit the room Storybook has: no fixed preview size around them
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

/** One change to one of the page's elements: Tailwind classes it loses, and classes it gets. */
type Change = { el: string; drop: string[]; add: string[] }
interface Look {
  /** what changes, and where it is in the code */
  what: string
  /** which element of the page already looks like this */
  from: string
  changes: Change[]
}

const NOTE = 'Prototype for B536, not built yet.'
const DARK =
  'Dark: as it is now, in every option (the box zinc-900 on the zinc-950 page); built, the change would be for light only.'
// B345 took the box's shadow off: it read as a dark ring round the box where nothing passed under it
const SHADOW =
  ' B345 took the box\u2019s shadow off (it read as a dark ring); this one is the small one the New input button has.'

const LOOKS = {
  now: {
    what: 'Nothing: the box is white (bg-white) with a thin light grey border (border-zinc-200; zinc-300 while you write in it) on the white page.',
    from: 'The page as it is today.',
    changes: [],
  },
  // 1: the box filled, as the page's search fields and the item page's pills are
  greyBox: {
    what: 'Only the box (#composer, BOX in Composer.tsx): bg-white \u2192 bg-zinc-100, and no border line (border-transparent) until you write in it (then zinc-300, as now).',
    from: 'The search fields (Search items, Search what you said) and the item page\u2019s pills (In progress, P2, Task): bg-zinc-100 on white. Built, the + and mic buttons would need a darker grey under the pointer: theirs is zinc-100 too.',
    changes: [{ el: '#composer', drop: ['bg-white', 'border-zinc-200'], add: ['bg-zinc-100', 'border-transparent'] }],
  },
  // 2: the ground grey, the box white and raised on it, as the sidebar and its New input button
  greyGround: {
    what: 'The ground under the box turns light grey (#foot in Shell.tsx \u2192 bg-zinc-50): the whole New input page under its head; at the bottom of an item and of the phone\u2019s list, a strip with a line on top (border-t border-zinc-200, and pt-3 for room over the box), where the talk and the list end (today they run on under the box\u2019s top corners, F478). The box stays white, with a small shadow (shadow-sm).',
    from:
      'The sidebar: its ground (bg-zinc-50) and line (border-zinc-200), and the white New input button on it (shadow-sm).' +
      SHADOW,
    changes: [
      { el: '#composer', drop: [], add: ['shadow-sm'] },
      { el: '#foot', drop: ['after:bg-white'], add: ['bg-zinc-50'] },
      // under an item and the phone's list (not on the New input page, whose head has its line already)
      { el: '#app:not([data-compose]) #foot', drop: ['pt-1'], add: ['pt-3', 'border-t', 'border-zinc-200'] },
    ],
  },
  // 3: the box's own edge, stronger, and a small shadow, still white
  strongerEdge: {
    what: 'Only the box (#composer, BOX in Composer.tsx): its border always zinc-300 (border-zinc-200 \u2192 border-zinc-300; today zinc-300 only while you write in it, so on the New input page, where you are writing, only the shadow is new), and a small shadow (shadow-sm); still white.',
    from:
      'The box\u2019s own border while you write in it (zinc-300), and the New input button\u2019s small shadow.' +
      SHADOW,
    changes: [{ el: '#composer', drop: ['border-zinc-200'], add: ['border-zinc-300', 'shadow-sm'] }],
  },
} satisfies Record<string, Look>
type LookName = keyof typeof LOOKS

/** Puts the look on the page's elements, and again whenever the page draws them anew; an element a change no longer
 * matches (you went from an item to the New input page in a frame) gets its own classes back. */
function restyle(doc: Document, look: Look) {
  const on = new Map<Change, Element>()
  const put = (el: Element, drop: string[], add: string[]) => {
    for (const k of drop) if (el.classList.contains(k)) el.classList.remove(k)
    for (const k of add) if (!el.classList.contains(k)) el.classList.add(k)
  }
  const apply = () => {
    for (const c of look.changes) {
      const el = doc.querySelector(c.el),
        was = on.get(c)
      if (was && was !== el) put(was, c.add, c.drop)
      if (el) put(el, c.drop, c.add)
      if (el) on.set(c, el)
      else on.delete(c)
    }
  }
  apply()
  const W = doc.defaultView as typeof window
  const mo = new W.MutationObserver(apply) // apply() changes nothing the second time, so this ends
  mo.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-compose'] })
  return () => {
    mo.disconnect()
    for (const [c, el] of on) put(el, c.add, c.drop)
  }
}

/** One page, whole (in its frame, or alone at its own size): the real page, then the look on it. */
function OnePage({ at, scheme, look, framed }: { at: string; scheme: string; look: Look; framed: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let stop = false,
      undo = () => {}
    const f = ref.current?.querySelector('iframe')
    // in a frame of the board: the New input page puts the caret in its box as it opens, and the browser would scroll
    // the whole board down to that frame; here the page's focus() keeps the caret but scrolls nothing
    const guard = framed
      ? window.setInterval(() => {
          const w = f?.contentWindow as (Window & typeof globalThis) | null
          if (!w || !w.location.pathname.endsWith('/app.html')) return
          clearInterval(guard)
          const own = w.HTMLElement.prototype.focus
          w.HTMLElement.prototype.focus = function (this: HTMLElement, o?: FocusOptions) {
            own.call(this, { ...o, preventScroll: true })
          }
        }, 5)
      : 0
    void (async () => {
      for (let i = 0; i < 300 && !stop && !f?.contentDocument?.getElementById('composer'); i++) await wait(50)
      const doc = f?.contentDocument
      // the light page only: dark stays as it is
      if (doc && !stop && scheme !== 'dark') undo = restyle(doc, look)
    })()
    return () => {
      stop = true
      clearInterval(guard)
      undo()
    }
  }, [look, scheme, framed])
  return (
    <div ref={ref}>
      <App path={SHOP + at} scheme={scheme} />
    </div>
  )
}

type On = 'desktop' | 'phone'
const SIZE: Record<On, [number, number]> = { desktop: [1440, 900], phone: [393, 852] }
interface Shot {
  at: string
  on: On
  scheme: 'light' | 'dark'
  name: string
}
// the New input page (the phone has none: its box under the list writes a new input) and an item page whose talk runs
// down to the box
const LIGHT_DESK: Shot[] = [
  { at: 'new', on: 'desktop', scheme: 'light', name: 'Desktop 1440 \u00b7 New input page' },
  { at: 'B35', on: 'desktop', scheme: 'light', name: 'Desktop 1440 \u00b7 Item page (B35)' },
]
const LIGHT_PHONE: Shot[] = [
  { at: '', on: 'phone', scheme: 'light', name: 'Phone 393 \u00b7 New input (the box under the list)' },
  { at: 'B35', on: 'phone', scheme: 'light', name: 'Phone 393 \u00b7 Item page (B35)' },
]
// in dark, pages that do not put the caret in the box as they open: one frame only (the first) can hold the caret, so
// the New input page above always shows the box as you write in it
const DARK_ROW: Shot[] = [
  { at: 'B35', on: 'desktop', scheme: 'dark', name: 'Desktop 1440 \u00b7 Item page (B35) \u00b7 dark' },
  { at: '', on: 'phone', scheme: 'dark', name: 'Phone 393 \u00b7 New input (the box under the list) \u00b7 dark' },
]

/** A frame of the page's size, scaled to the room there is: the same story alone in it (?single=1), so the page's own
 * "is this the desktop?" answers as on a real screen. */
function Frame({ id, s, width }: { id: string; s: Shot; width: number }) {
  const [w, h] = SIZE[s.on]
  const scale = Math.min(1, width / w)
  const src = `${location.pathname}?id=${id}&viewMode=story&single=1&framed=1&at=${encodeURIComponent(s.at)}&globals=scheme:${s.scheme}`
  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">{s.name}</figcaption>
      <div
        style={{ width: w * scale, height: h * scale }}
        className="relative overflow-hidden rounded-lg ring-1 ring-zinc-300 dark:ring-zinc-700"
      >
        <iframe
          title={s.name}
          src={src}
          loading="lazy"
          style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
          className="absolute top-0 left-0 border-0"
        />
      </div>
    </figure>
  )
}

function Row({ id, title, shots, width }: { id: string; title: string; shots: Shot[]; width: number }) {
  return (
    <section className="pt-8">
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{title}</h3>
      <div className="flex flex-wrap gap-6">
        {shots.map((s) => (
          <Frame key={s.name} id={id} s={s} width={width} />
        ))}
      </div>
    </section>
  )
}

/** The option's pages: light on the desktop and the phone, and one row in dark to show it unchanged. */
function Board({ id, look, title }: { id: string; look: Look; title: string }) {
  const [width, setWidth] = useState(() => innerWidth - 32)
  useEffect(() => {
    const on = () => setWidth(innerWidth - 32)
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <header className="max-w-3xl space-y-1 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="font-medium">{NOTE}</p>
        <p>
          <span className="font-semibold">Changes: </span>
          {look.what}
        </p>
        <p>
          <span className="font-semibold">Borrows from: </span>
          {look.from}
        </p>
        <p className="text-zinc-500 dark:text-zinc-400">{DARK}</p>
      </header>
      <Row id={id} title={'Light \u00b7 desktop'} shots={LIGHT_DESK} width={width} />
      <Row id={id} title={'Light \u00b7 phone'} shots={LIGHT_PHONE} width={width} />
      <Row id={id} title="Dark (unchanged)" shots={DARK_ROW} width={width} />
    </div>
  )
}

const story = (name: LookName, title: string): StoryObj => {
  const look: Look = LOOKS[name]
  return {
    parameters: { docs: { description: { story: `${NOTE} ${look.what} Borrows from: ${look.from}` } } },
    render: (_, { id, globals }) => {
      if (!single()) return <Board id={id} look={look} title={title} />
      // alone, at its own size: the page at ?at= (the New input page when none is given)
      const q = new URLSearchParams(location.search)
      const scheme = globals.scheme === 'dark' ? 'dark' : 'light'
      return <OnePage at={q.get('at') ?? 'new'} scheme={scheme} look={look} framed={q.has('framed')} />
    },
  }
}

// each story's name is written here, where Storybook's list reads it
export const Now: StoryObj = { ...story('now', 'Now (as it is)'), name: 'Now (as it is)' }
export const GreyBox: StoryObj = {
  ...story('greyBox', '1 \u00b7 Grey box on the white page'),
  name: '1 \u00b7 Grey box on the white page',
}
export const GreyGround: StoryObj = {
  ...story('greyGround', '2 \u00b7 Grey ground, white box'),
  name: '2 \u00b7 Grey ground, white box',
}
export const StrongerEdge: StoryObj = {
  ...story('strongerEdge', '3 \u00b7 Stronger edge and a small shadow'),
  name: '3 \u00b7 Stronger edge and a small shadow',
}
