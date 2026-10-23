// B536 (r469): a prototype of the input box in light mode, to look at before anything is built. In light the box is
// white on the white page, apart only by a thin light grey border (the New input page most of all; also under an item's
// talk and under the list on the phone). Yadong (r469): the box's background and the background around it must
// differ. Each story is the real page (the Storybook demo project), as it is, with only the box's look changed (and in
// option 2 the ground it stands on): the page draws itself, then the prototype swaps a few Tailwind classes on the
// page's own elements (#composer, the box, and its buttons; #foot, what it stands on), on the light page only: dark
// stays as it is. Every class it uses is one the page already has (so the page's stylesheet has it, in any running
// Storybook). PROTOTYPE ONLY: nothing here changes Taska itself.
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

/** One change to the page's elements that match `el`: Tailwind classes they lose and get, and classes swapped where
 * they have them (from, to). */
type Change = { el: string; drop?: string[]; add?: string[]; swap?: [string, string][] }
interface Look {
  /** what changes, and where it is in the code */
  what: string
  /** which element of the page already looks like this */
  from: string
  /** what Yadong should know before picking it */
  note?: string
  /** the New input page also at rest (it opens with the caret in the box) */
  rest?: boolean
  changes: Change[]
}

const NOTE = 'Prototype for B536, not built yet.'
const DARK =
  'Dark: as it is now, in every option (the box zinc-900 on the zinc-950 page); built, the change would be for light only.'
// B345 took the box's shadow off: it read as a dark ring round the box where nothing passed under it
const SHADOW =
  ' B345 took the box\u2019s shadow off (it read as a dark ring); this one is the small one the New input button has.'

// option 1: the box's own buttons are grey under the pointer (hover:bg-zinc-100), the box's new grey: they get the next
// grey (on the desktop the line's x has lg:hover:bg-zinc-100; built it would be lg:hover:bg-zinc-200, which the page's
// stylesheet has no rule for yet, so here it is hover:bg-zinc-200)
const BUTTONS: Change = {
  el: '#composer button',
  swap: [
    ['hover:bg-zinc-100', 'hover:bg-zinc-200'],
    ['lg:hover:bg-zinc-100', 'hover:bg-zinc-200'],
  ],
}
const GREY_BUTTONS =
  ' Its buttons (+, the grey mic, the line\u2019s link and \u00d7) are grey under the pointer in the box\u2019s new grey: they get the next grey (hover:bg-zinc-100 \u2192 hover:bg-zinc-200).'
const KEEPS_F478 =
  'Meets r469 and keeps F478: the talk and the list still run on under the box\u2019s top corners. Where an agent\u2019s light grey card passes there (the 1920 item page), the grey box\u2019s top edge shows less.'

const LOOKS = {
  now: {
    what: 'Nothing: the box is white (bg-white) with a thin light grey border (border-zinc-200; zinc-300 while you write in it) on the white page.',
    from: 'The page as it is today.',
    changes: [],
  },
  // 1a: the box filled, as the page's search fields and the item page's pills are; it stays grey while you write
  greyKeep: {
    what:
      'Only the box (#composer, BOX in Composer.tsx): bg-white \u2192 bg-zinc-100 and no border line (border-transparent); while you write in it, it stays grey and its edge shows (zinc-300, as now).' +
      GREY_BUTTONS,
    from: 'The fill of the search fields (Search items, Search what you said) and of the item page\u2019s pills (In progress, P2, Task): bg-zinc-100 on white.',
    note: KEEPS_F478,
    changes: [
      { el: '#composer', drop: ['bg-white', 'border-zinc-200'], add: ['bg-zinc-100', 'border-transparent'] },
      BUTTONS,
    ],
  },
  // 1b: grey at rest, white with the search fields' blue ring while you write, as the search fields themselves
  greyWhite: {
    what:
      'Only the box (#composer, BOX in Composer.tsx): grey at rest (bg-zinc-100, no border line); while you write in it, white with a blue ring (focus-within:bg-white focus-within:ring-2 ring-blue-500/40) instead of the zinc-300 edge. The New input page opens with the caret in the box, so it is shown both ways.' +
      GREY_BUTTONS,
    from: 'The search fields, as they are: Search what you said (and Search items on the desktop) are grey at rest, white with that blue ring while you type.',
    note: KEEPS_F478,
    rest: true,
    changes: [
      {
        el: '#composer',
        drop: ['bg-white', 'border-zinc-200', 'focus-within:border-zinc-300'],
        add: ['bg-zinc-100', 'border-transparent', 'focus-within:bg-white', 'focus-within:ring-2', 'ring-blue-500/40'],
      },
      BUTTONS,
    ],
  },
  // 2: the ground grey, the box white and raised on it, as the sidebar and its New input button
  greyGround: {
    what: 'The ground under the box turns light grey (#foot in Shell.tsx \u2192 bg-zinc-50): the whole New input page under its head; at the bottom of an item and of the phone\u2019s list, a strip with a line on top (border-t border-zinc-200, and pt-3 for room over the box). The box stays white, with a small shadow (shadow-sm).',
    from:
      'The sidebar: its ground (bg-zinc-50) and line (border-zinc-200), and the white New input button on it (shadow-sm).' +
      SHADOW,
    note: 'It ends the talk at a line above the box: what F478 asked (the talk seen around the box\u2019s top corners) goes away.',
    changes: [
      { el: '#composer', add: ['shadow-sm'] },
      { el: '#foot', drop: ['after:bg-white'], add: ['bg-zinc-50'] },
      // under an item and the phone's list (not on the New input page, whose head has its line already)
      { el: '#app:not([data-compose]) #foot', drop: ['pt-1'], add: ['pt-3', 'border-t', 'border-zinc-200'] },
    ],
  },
  // 3: the box's own edge, stronger, and a small shadow, still white
  strongerEdge: {
    what: 'Only the box (#composer, BOX in Composer.tsx): its border always zinc-300 (border-zinc-200 \u2192 border-zinc-300; today zinc-300 only while you write in it), and a small shadow (shadow-sm); still white.',
    from:
      'The box\u2019s own border while you write in it (zinc-300), and the New input button\u2019s small shadow.' +
      SHADOW,
    note: 'On the New input page only a small shadow is added (the box opens with the caret in it, so its edge is zinc-300 already): the box is still white on white.',
    changes: [{ el: '#composer', drop: ['border-zinc-200'], add: ['border-zinc-300', 'shadow-sm'] }],
  },
} satisfies Record<string, Look>
type LookName = keyof typeof LOOKS

/** Puts the look on the page's elements, and again whenever the page draws them anew; an element a change no longer
 * matches (you went from an item to the New input page in a frame) gets its own classes back. */
function restyle(doc: Document, look: Look) {
  const on = new Map<Change, Set<Element>>()
  const put = (el: Element, c: Change, back = false) => {
    const cl = el.classList
    for (const k of (back ? c.add : c.drop) || []) if (cl.contains(k)) cl.remove(k)
    for (const k of (back ? c.drop : c.add) || []) if (!cl.contains(k)) cl.add(k)
    for (const [a, b] of c.swap || []) {
      const [was, now] = back ? [b, a] : [a, b]
      if (cl.contains(was)) cl.replace(was, now)
    }
  }
  const apply = () => {
    for (const c of look.changes) {
      const now = new Set(doc.querySelectorAll(c.el))
      for (const el of on.get(c) || []) if (!now.has(el)) put(el, c, true)
      for (const el of now) put(el, c)
      on.set(c, now)
    }
  }
  apply()
  const W = doc.defaultView as typeof window
  const mo = new W.MutationObserver(apply) // apply() changes nothing the second time, so this ends
  mo.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-compose'] })
  return () => {
    mo.disconnect()
    for (const [c, els] of on) for (const el of els) put(el, c, true)
  }
}

/** How a page is shown: in a frame of the board; at rest (as after a click elsewhere: the caret not in the box); its
 * talk scrolled to the middle (so the talk runs on under the box's top corners). */
interface Way {
  framed: boolean
  rest: boolean
  mid: boolean
}

/** One page, whole (in its frame, or alone at its own size): the real page, then the look on it. */
function OnePage({ at, scheme, look, way }: { at: string; scheme: string; look: Look; way: Way }) {
  const ref = useRef<HTMLDivElement>(null)
  const { framed, rest, mid } = way
  useEffect(() => {
    let stop = false,
      undo = () => {}
    const f = ref.current?.querySelector('iframe')
    // the page's focus(), changed as soon as the page is there: in a frame of the board it scrolls nothing (the New
    // input page puts the caret in its box as it opens, and the browser would scroll the whole board down to that
    // frame); at rest it does not put the caret in the box until you point into the page
    let touched = false,
      tries = 0
    const guard =
      framed || rest
        ? window.setInterval(() => {
            // the page's window, once it is the page's (not the frame's first blank one); the page moves its address
            // to the story's place at once, so it is known by not being blank
            const w = f?.contentWindow as (Window & typeof globalThis) | null
            if (++tries > 3000) clearInterval(guard)
            if (!w || w.location.protocol === 'about:') return
            clearInterval(guard)
            w.addEventListener('pointerdown', () => (touched = true), true)
            const own = w.HTMLElement.prototype.focus
            w.HTMLElement.prototype.focus = function (this: HTMLElement, o?: FocusOptions) {
              if (rest && !touched && this.id === 'text') return
              own.call(this, framed ? { ...o, preventScroll: true } : o)
            }
          }, 5)
        : 0
    void (async () => {
      for (let i = 0; i < 300 && !stop && !f?.contentDocument?.getElementById('composer'); i++) await wait(50)
      const doc = f?.contentDocument
      if (!doc || stop) return
      // the light page only: dark stays as it is
      if (scheme !== 'dark') undo = restyle(doc, look)
      if (rest && doc.activeElement?.id === 'text') (doc.activeElement as HTMLElement).blur()
      // the talk in the middle: set again while the page settles (it opens at the newest message)
      for (let i = 0; mid && i < 6 && !stop && !touched; i++) {
        await wait(400)
        const talk = [...doc.querySelectorAll<HTMLElement>('#itemTalk, #detailBody')].find(
          (e) => e.scrollHeight > e.clientHeight + 100,
        )
        if (talk) talk.scrollTop = Math.round((talk.scrollHeight - talk.clientHeight) / 2)
      }
    })()
    return () => {
      stop = true
      clearInterval(guard)
      undo()
    }
  }, [look, scheme, framed, rest, mid])
  return (
    <div ref={ref}>
      <App path={SHOP + at} scheme={scheme} />
    </div>
  )
}

// a wide desktop too: there the talk is beside the item (its pane 1100 wide or more), and it runs on under the box
type On = 'desktop' | 'wide' | 'phone'
const SIZE: Record<On, [number, number]> = { desktop: [1440, 900], wide: [1920, 1080], phone: [393, 852] }
interface Shot {
  at: string
  on: On
  scheme: 'light' | 'dark'
  name: string
  rest?: boolean
  mid?: boolean
}
// the New input page (the phone has none: its box under the list writes a new input) and an item page with a long talk,
// scrolled to its middle so the talk runs on under the box (F478)
const NEW_INPUT: Shot = {
  at: 'new',
  on: 'desktop',
  scheme: 'light',
  name: 'Desktop 1440 \u00b7 New input page, as it opens (the caret in the box)',
}
const NEW_INPUT_REST: Shot = {
  ...NEW_INPUT,
  rest: true,
  name: 'Desktop 1440 \u00b7 New input page at rest (after a click elsewhere)',
}
const ITEM: Shot = {
  at: 'B35',
  on: 'desktop',
  scheme: 'light',
  mid: true,
  name: 'Desktop 1440 \u00b7 Item page (B35, its long talk scrolled to the middle): under the item, the talk stops above the box (F478 asks about this one)',
}
const ITEM_WIDE: Shot = {
  ...ITEM,
  on: 'wide',
  name: 'Desktop 1920 \u00b7 Item page (B35): the talk beside the item, scrolled to the middle, runs on under the box\u2019s top corners (F478)',
}
const LIGHT_PHONE: Shot[] = [
  { at: '', on: 'phone', scheme: 'light', name: 'Phone 393 \u00b7 New input (the box under the list)' },
  { at: 'B35', on: 'phone', scheme: 'light', name: 'Phone 393 \u00b7 Item page (B35)' },
]
// in dark, pages that do not put the caret in the box as they open: one frame only (the first) can hold the caret, so
// the New input page above always shows the box as you write in it
const DARK_ROW: Shot[] = [
  { ...ITEM_WIDE, scheme: 'dark', name: 'Desktop 1920 \u00b7 Item page (B35, talk in the middle) \u00b7 dark' },
  { at: '', on: 'phone', scheme: 'dark', name: 'Phone 393 \u00b7 New input (the box under the list) \u00b7 dark' },
]

/** A frame of the page's size, scaled to the room there is: the same story alone in it (?single=1), so the page's own
 * "is this the desktop?" answers as on a real screen. */
function Frame({ id, s, width }: { id: string; s: Shot; width: number }) {
  const [w, h] = SIZE[s.on]
  const scale = Math.min(1, width / w)
  const way = `${s.rest ? '&rest=1' : ''}${s.mid ? '&mid=1' : ''}`
  const src = `${location.pathname}?id=${id}&viewMode=story&single=1&framed=1${way}&at=${encodeURIComponent(s.at)}&globals=scheme:${s.scheme}`
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
  const desk = look.rest ? [NEW_INPUT, NEW_INPUT_REST, ITEM, ITEM_WIDE] : [NEW_INPUT, ITEM, ITEM_WIDE]
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
        {look.note ? <p className="font-semibold text-amber-700 dark:text-amber-400">{look.note}</p> : null}
        <p className="text-zinc-500 dark:text-zinc-400">{DARK}</p>
      </header>
      <Row id={id} title={'Light \u00b7 desktop'} shots={desk} width={width} />
      <Row id={id} title={'Light \u00b7 phone'} shots={LIGHT_PHONE} width={width} />
      <Row id={id} title="Dark (unchanged)" shots={DARK_ROW} width={width} />
    </div>
  )
}

const story = (name: LookName, title: string): StoryObj => {
  const look: Look = LOOKS[name]
  return {
    parameters: {
      docs: {
        description: {
          story: `${NOTE} ${look.what} Borrows from: ${look.from}${look.note ? ' ' + look.note : ''}`,
        },
      },
    },
    render: (_, { id, globals }) => {
      if (!single()) return <Board id={id} look={look} title={title} />
      // alone, at its own size: the page at ?at= (the New input page when none is given), shown the ?rest= / ?mid= way
      const q = new URLSearchParams(location.search)
      const scheme = globals.scheme === 'dark' ? 'dark' : 'light'
      const way = { framed: q.has('framed'), rest: q.has('rest'), mid: q.has('mid') }
      return <OnePage at={q.get('at') ?? 'new'} scheme={scheme} look={look} way={way} />
    },
  }
}

// each story's name is written here, where Storybook's list reads it
export const Now: StoryObj = { ...story('now', 'Now (as it is)'), name: 'Now (as it is)' }
export const GreyBoxStaysGrey: StoryObj = {
  ...story('greyKeep', '1a \u00b7 Grey box, stays grey while you write'),
  name: '1a \u00b7 Grey box, stays grey while you write',
}
export const GreyBoxWhiteWhileWriting: StoryObj = {
  ...story('greyWhite', '1b \u00b7 Grey box, white while you write'),
  name: '1b \u00b7 Grey box, white while you write',
}
export const GreyGround: StoryObj = {
  ...story('greyGround', '2 \u00b7 Grey ground, white box'),
  name: '2 \u00b7 Grey ground, white box',
}
export const StrongerEdge: StoryObj = {
  ...story('strongerEdge', '3 \u00b7 Stronger edge and a small shadow'),
  name: '3 \u00b7 Stronger edge and a small shadow',
}
