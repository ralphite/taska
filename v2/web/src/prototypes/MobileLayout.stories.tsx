// T456 (#5708, #5712): a prototype of a new phone layout, to look at before anything is built. Each story is the real
// page (the Storybook demo project) on a phone-sized screen of a fixed size, with the new bottom bar drawn over it:
// Projects · Items · Comments, in the order of the levels (a project holds items, an item holds its comments). An
// opened item is two pages: its detail under Items, its conversation under Comments.
// Walkthrough plays it through as a person would (R488): a big mark where it taps, the time a person takes, a line
// under the screen saying each step; Autoplay off, you tap yourself and the bar works. What is said and the buttons sit
// under the screen, never on it, and the screen never changes its size or place. Nothing here changes Taska itself.
// T456 (#6226): a second version has a voice button in the middle of the bar, between Items and Comments: the lists
// have no box, the button records into the page's own box, which comes up for it (a new input on a list, a reply in
// an opened item); the recording is the page's own (Storybook's microphone is a quiet tone, app-shim.js).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

type Tab = 'Projects' | 'Items' | 'Comments'
type Place = 'items' | 'inputs' | 'detail' | 'comments' | 'projects'
const TABS: Tab[] = ['Projects', 'Items', 'Comments']
const LISTS: Place[] = ['items', 'inputs', 'projects'] // no item open: with the voice button, no box
const TAB_OF: Record<Place, Tab> = {
  items: 'Items',
  inputs: 'Comments',
  detail: 'Items',
  comments: 'Comments',
  projects: 'Projects',
}
const ICON = {
  Projects:
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  Items:
    '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  Comments:
    '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
}
const DRAWN = 'data-proto' // what the prototype changed in the page, so the next screen starts from the page itself
const W = 393,
  H = 852
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Runs inside the page: the new bar, and an opened item split into its two pages. onTab: a tap on the bar. mic: the
 * version with the voice button in the middle. */
function draw(doc: Document, place: Place, onTab?: (t: Tab | 'Mic') => void, mic = false) {
  const byId = (id: string) => doc.getElementById(id)
  for (const e of doc.querySelectorAll<HTMLElement>(`[${DRAWN}]`)) {
    if (e.getAttribute(DRAWN) === 'added') e.remove()
    else {
      e.style.cssText = e.dataset.protoWas || ''
      e.removeAttribute(DRAWN)
    }
  }
  const restyle = (e: HTMLElement | null, css: Partial<CSSStyleDeclaration>) => {
    if (!e) return
    if (!e.hasAttribute(DRAWN)) e.dataset.protoWas = e.style.cssText
    e.setAttribute(DRAWN, 'styled')
    Object.assign(e.style, css)
  }
  restyle(byId('tabs'), { display: 'none' }) // Items / Inputs / Rules go: the bar has the levels; Rules move into Items' views
  if (place === 'projects') {
    restyle(byId('drawer'), { width: '100%', maxWidth: 'none', transform: 'none' })
    restyle(byId('app'), { visibility: 'hidden' })
  }
  if (place === 'detail') {
    restyle(byId('itemTalk'), { display: 'none' })
    restyle(byId('foot'), { display: 'none' }) // nothing to write on the detail page: the box is under Comments
  }
  // the voice button's version: no box on the lists; it comes up while the button records (see boxUp)
  if (mic && LISTS.includes(place)) restyle(byId('foot'), { display: 'none' })
  if (place === 'comments') {
    restyle(byId('itemTop'), { display: 'none' })
    const b = byId('detailBody')
    if (b) b.scrollTop = b.scrollHeight
  }
  const bar = doc.createElement('div')
  bar.setAttribute(DRAWN, 'added')
  bar.id = 'protoBar'
  bar.className =
    'fixed inset-x-0 bottom-0 z-60 flex h-[78px] items-center justify-around border-t border-zinc-200 bg-white pb-5 ' +
    'text-[10.5px] font-medium dark:border-zinc-800 dark:bg-zinc-950'
  const open = place === 'detail' || place === 'comments'
  // the page's own voice button, the one in its box
  const voice = mic
    ? (doc.querySelector('#foot #sendBtn[data-act="mic"]')?.cloneNode(true) as HTMLElement | null)
    : null
  for (const t of mic ? (['Projects', 'Items', 'Mic', 'Comments'] as const) : TABS) {
    if (t === 'Mic') {
      if (!voice) continue
      voice.removeAttribute('id')
      voice.removeAttribute('data-act') // the bar's button: it goes to the box's own (see go)
      voice.dataset.tab = 'Mic'
      voice.classList.remove('size-11', 'lg:size-9')
      voice.classList.add('size-14')
      if (onTab) voice.addEventListener('click', () => onTab('Mic'))
      bar.append(voice)
      continue
    }
    const on = t === TAB_OF[place],
      count = t === 'Comments' && open ? '<span class="ml-0.5 text-zinc-400">4</span>' : ''
    const el = doc.createElement('button')
    el.dataset.tab = t
    el.className = `flex w-24 cursor-pointer flex-col items-center gap-[3px] py-1.5 ${on ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`
    el.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
      `stroke-linejoin="round">${ICON[t]}</svg><span>${t}${count}</span>`
    if (onTab) el.addEventListener('click', () => onTab(t))
    bar.append(el)
  }
  doc.body.append(bar)
  restyle(byId('app'), { paddingBottom: '78px', ...(place === 'projects' ? { visibility: 'hidden' } : {}) })
}

/** The voice button's version, on a list: the box is up while it records or holds words, and gone when empty. */
function boxUp(doc: Document) {
  const foot = doc.getElementById('foot')
  if (!foot?.hasAttribute(DRAWN)) return
  const text = doc.querySelector<HTMLTextAreaElement>('#text')
  const busy =
    !!doc.querySelector('#recBar:not([hidden])') ||
    !!text?.value.trim() ||
    !!doc.querySelector('#foot [data-act="unfile"]')
  foot.style.display = busy ? '' : 'none'
}

/** A big mark where a finger taps: it stays a moment, then spreads (R488) */
async function tap(doc: Document, el: Element | null | undefined) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const dot = doc.createElement('div')
  dot.style.cssText =
    `position:fixed;left:${r.left + r.width / 2 - 28}px;top:${r.top + r.height / 2 - 28}px;width:56px;height:56px;` +
    'border-radius:50%;z-index:95;pointer-events:none;background:rgba(37,99,235,.35);border:3px solid rgba(37,99,235,.95);' +
    'box-shadow:0 0 0 6px rgba(37,99,235,.15)'
  doc.body.append(dot)
  dot.animate(
    [
      { transform: 'scale(.4)', opacity: 0.4 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: 220, fill: 'forwards' },
  )
  await wait(650) // the finger is down long enough to be seen
  await dot.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.8)', opacity: 0 },
    ],
    {
      duration: 450,
      fill: 'forwards',
    },
  ).finished
  dot.remove()
}
/** Where to tap next, when you tap yourself: a ring that breathes around it, until the screen changes */
function hint(doc: Document, el: Element | null | undefined) {
  doc.getElementById('protoHint')?.remove()
  if (!el) return
  const r = el.getBoundingClientRect(),
    ring = doc.createElement('div')
  ring.id = 'protoHint'
  ring.setAttribute(DRAWN, 'added')
  ring.style.cssText =
    `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;` +
    'border-radius:14px;z-index:94;pointer-events:none;border:3px solid rgba(37,99,235,.9)'
  doc.body.append(ring)
  ring.animate([{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], { duration: 1400, iterations: Infinity })
}

/** The phone's screen, of one size that never changes, with what is said and the buttons under it */
function Phone({
  path,
  scheme,
  onPage,
  children,
}: {
  path: string
  scheme: string
  onPage: (f: HTMLIFrameElement) => void
  children: ReactNode
}) {
  // the screen as tall as the window holds with the panel under it; fixed once, so it never moves or changes size
  const [scale] = useState(() => Math.min(1, Math.max(0.5, (window.innerHeight - 32 - 120) / H)))
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    let gone = false
    void (async () => {
      const f = ref.current
      // T456 (#6059): shown the moment the page has drawn its items, with nothing more to wait for
      for (let i = 0; i < 400 && !f?.contentDocument?.querySelector('#list [data-n]'); i++) await wait(25)
      await new Promise((r) => requestAnimationFrame(r))
      if (!gone && f) onPage(f)
    })()
    return () => {
      gone = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-zinc-100 py-4 dark:bg-zinc-900">
      <div
        className="relative shrink-0 overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ring-zinc-900/10 dark:bg-zinc-950 dark:ring-white/10"
        style={{ width: W * scale, height: H * scale }}
      >
        <iframe
          ref={ref}
          title="Taska"
          src={`/storybook/app.html#path=${encodeURIComponent(path)}&theme=${scheme === 'dark' ? 'dark' : 'light'}`}
          // R488: the screen shows once it is drawn, never drawn in front of you
          className="absolute top-0 left-0 border-0 opacity-0"
          style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
      <div className="h-[104px] shrink-0" style={{ width: W * scale }}>
        {children}
      </div>
    </div>
  )
}

const meta: Meta = {
  title: 'Prototype/New mobile layout',
  // the screen fits the room Storybook has, with what is said under it in sight: no fixed preview size around it
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

// ---------------------------------------------------------------- the walkthrough
const F1 = '/p/shop/F1'
const SAY: Record<Place, string> = {
  items: 'Items: this project’s items. Tap one to open it.',
  detail: 'Its detail: title, state, what it is, its documents and subitems. Tap Comments for its talk.',
  comments: 'Its conversation with the agents, and the box to reply. Tap Items for its detail, or Projects.',
  projects: 'Every project, and Documents, Activity, Settings. Tap Items to go back.',
  inputs: 'Comments with no item open: everything said in the project. Tap Items to go back.',
}
type Tap = 'row' | Tab | 'Mic' | 'Discard'
// the tour: from the items, open one, its talk, back to its detail, the projects
const TOUR: { from: Place; tap: Tap }[] = [
  { from: 'items', tap: 'row' },
  { from: 'detail', tap: 'Comments' },
  { from: 'comments', tap: 'Items' },
  { from: 'detail', tap: 'Projects' },
]
// with the voice button: first it records a new input (and lets it go), then the same tour
const MIC_TOUR: { from: Place; tap: Tap }[] = [
  { from: 'items', tap: 'Mic' },
  { from: 'items', tap: 'Discard' },
  ...TOUR,
]
const RECORDING =
  'The voice button records a new input in the box that comes up. \u2713 puts the words in the box, \u2191 sends. \u2715 lets it go.'
const SAY_MIC: Record<Place, string> = {
  ...SAY,
  items: 'Items: no box here. Tap the voice button to say something new, or an item to open it.',
}
const NEXT_TAP: Record<Place, 'row' | Tab> = {
  items: 'row',
  detail: 'Comments',
  comments: 'Projects',
  projects: 'Items',
  inputs: 'Items',
}

function Walkthrough({ scheme, mic = false }: { scheme: string; mic?: boolean }) {
  const tour = mic ? MIC_TOUR : TOUR,
    words = mic ? SAY_MIC : SAY
  const [say, setSay] = useState(words.items)
  const [auto, setAuto] = useState(true)
  const [step, setStep] = useState(0)
  const S = useRef({
    f: null as HTMLIFrameElement | null,
    place: 'items' as Place,
    run: 0,
    auto: true,
    path: '',
    busy: 0,
  })
  const doc = () => S.current.f?.contentDocument || null
  const win = () => S.current.f?.contentWindow || null
  const target = (t: Tap) =>
    t === 'row'
      ? doc()?.querySelector('#list [data-act="open"][data-n="1"]') ||
        doc()?.querySelector('#list [data-act="open"][data-n]')
      : t === 'Discard'
        ? doc()?.querySelector('#foot [data-act="rec-cancel"]')
        : doc()?.querySelector(`#protoBar [data-tab="${t}"]`)
  /** the page goes to an address as Back would take it there */
  const goto = async (path: string) => {
    const w = win()
    if (!w || w.location.pathname === path) return
    w.history.pushState(null, '', path)
    w.dispatchEvent(new PopStateEvent('popstate'))
    for (let i = 0; i < 40 && w.location.pathname !== path; i++) await wait(25)
    await wait(150)
  }
  const show = (place: Place) => {
    const d = doc()
    if (!d) return
    S.current.place = place
    S.current.path = win()?.location.pathname || ''
    draw(d, place, (t) => void tapped(t), mic)
    setSay(words[place])
    if (!S.current.auto) hint(d, target(NEXT_TAP[place]))
  }
  /** where a tap takes you, the same whether you or the autoplay tapped */
  const to = async (t: Tap) => {
    S.current.busy++
    try {
      await go(t)
    } finally {
      S.current.busy--
    }
  }
  const go = async (t: Tap) => {
    const d = doc(),
      here = S.current.place
    if (!d) return
    if (t === 'Mic') {
      // the box's own voice button: a new input on a list, a reply in an opened item (on its Comments page)
      if (here === 'projects') await go('Items')
      if (S.current.place === 'detail') show('comments')
      const foot = d.getElementById('foot')
      if (foot) foot.style.display = ''
      d.querySelector<HTMLElement>('#foot [data-act="mic"]')?.click()
      await wait(300)
      setSay(RECORDING)
      return
    }
    if (t === 'Discard') {
      ;(target('Discard') as HTMLElement | null)?.click()
      await wait(300)
      return show(S.current.place)
    }
    if (here === 'projects' && t !== 'Projects') {
      d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(120)
    }
    if (t === 'row') {
      ;(target('row') as HTMLElement | null)?.click()
      for (let i = 0; i < 40 && !d.getElementById('itemTop'); i++) await wait(25)
      return show('detail')
    }
    if (t === 'Projects') {
      if (here !== 'projects') d.getElementById('projBtn')?.click()
      await wait(120)
      return show('projects')
    }
    const open = /\/[A-Z]\d+$/.test(win()?.location.pathname || '')
    if (t === 'Comments') {
      if (open) return show('comments')
      await goto('/p/shop/inputs')
      return show('inputs')
    }
    // Items: an open item's detail; on its detail already, back to the list
    if (open && here !== 'detail') return show('detail')
    await goto('/p/shop/')
    return show('items')
  }
  /** you tapped the bar yourself: the autoplay stops, the screen follows your tap */
  const tapped = async (t: Tab | 'Mic') => {
    if (S.current.auto) toggle(false)
    await to(t)
  }
  const play = async () => {
    const run = ++S.current.run
    for (let i = 0; i < tour.length; i++) {
      if (run !== S.current.run) return
      const s = tour[i]
      if (S.current.place !== s.from) continue
      setStep(i + 1)
      await wait(i === 0 ? 2500 : s.tap === 'Discard' ? 4000 : 2800) // look at this screen first
      if (run !== S.current.run) return
      await tap(doc() as Document, target(s.tap))
      if (run !== S.current.run) return
      await to(s.tap)
    }
    if (run !== S.current.run) return
    await wait(2800)
    if (run === S.current.run) setSay('That is the tour. Tap the bar to look around, or Restart.')
  }
  const toggle = (on: boolean) => {
    S.current.auto = on
    S.current.run++
    setAuto(on)
    const d = doc()
    if (!d) return
    if (on) {
      d.getElementById('protoHint')?.remove()
      void play()
    } else hint(d, target(NEXT_TAP[S.current.place]))
  }
  const restart = async () => {
    S.current.run++
    const d = doc()
    if (!d) return
    if (S.current.place === 'projects') d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    ;(target('Discard') as HTMLElement | null)?.click() // a recording still going
    await goto('/p/shop/')
    show('items')
    setStep(0)
    if (S.current.auto) void play()
  }
  // you went somewhere in the page yourself (opened an item, its Back): the screen and the bar follow
  useEffect(() => {
    const t = window.setInterval(() => {
      const d = doc()
      if (mic && d) boxUp(d)
      const p = win()?.location.pathname
      if (!p || p === S.current.path || S.current.busy || S.current.place === 'projects') return
      if (S.current.auto) toggle(false)
      show(/\/[A-Z]\d+$/.test(p) ? 'detail' : /\/inputs$/.test(p) ? 'inputs' : 'items')
    }, 300)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const onPage = (f: HTMLIFrameElement) => {
    S.current.f = f
    show('items')
    f.classList.remove('opacity-0')
    if (S.current.auto) void play()
  }
  return (
    <Phone path="/p/shop/" scheme={scheme} onPage={onPage}>
      <div className="flex h-full flex-col gap-3">
        <p className="line-clamp-3 h-[3.9em] text-[15px] leading-[1.3] font-semibold text-zinc-900 dark:text-zinc-100">
          {say}
        </p>
        <div className="flex items-center gap-2">
          <button
            role="switch"
            aria-checked={auto}
            onClick={() => toggle(!auto)}
            className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <span
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${auto ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
            >
              <span
                className={`size-4 rounded-full bg-white shadow transition-transform ${auto ? 'translate-x-4' : ''}`}
              />
            </span>
            Autoplay
          </button>
          <button
            onClick={() => void restart()}
            className="h-9 rounded-full bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Restart
          </button>
          <span className="ml-auto text-xs whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
            {auto ? `${Math.min(step, tour.length)} / ${tour.length} taps` : 'You tap'}
          </span>
        </div>
      </div>
    </Phone>
  )
}

export const Tour: StoryObj = {
  name: 'Walkthrough',
  parameters: {
    docs: {
      description: {
        story:
          'Plays the new layout through: open an item, its talk, its detail, the projects. Autoplay off: tap the bar yourself.',
      },
    },
  },
  render: (_, { globals }) => <Walkthrough scheme={String(globals.scheme)} />,
}
export const TourVoiceButton: StoryObj = {
  name: 'Walkthrough \u00b7 voice button',
  parameters: {
    docs: {
      description: {
        story:
          'The same layout with a voice button in the middle of the bar: it records a new input, then the same tour. Autoplay off: tap yourself.',
      },
    },
  },
  render: (_, { globals }) => <Walkthrough scheme={String(globals.scheme)} mic />,
}

// ---------------------------------------------------------------- one screen each
const screen = (path: string, place: Place | 'sheet', note: string, mic = false): StoryObj => ({
  parameters: { docs: { description: { story: note } } },
  render: (_, { globals }) => (
    <Phone
      path={path}
      scheme={String(globals.scheme)}
      onPage={(f) => {
        const d = f.contentDocument
        if (!d) return
        if (place === 'projects') d.getElementById('projBtn')?.click()
        const tabs = d.getElementById('tabs')
        if (place !== 'sheet') draw(d, place, undefined, mic)
        else if (tabs) tabs.style.display = 'none' // a sheet over the page: no bar under it
        f.classList.remove('opacity-0')
      }}
    >
      <p className="text-[15px] leading-[1.3] text-zinc-700 dark:text-zinc-300">{note}</p>
    </Phone>
  ),
})

export const Projects = screen(
  '/p/shop/',
  'projects',
  'The top level: every project, and Documents, Activity, Deleted, Settings.',
)
export const Items = screen('/p/shop/', 'items', "A project's items; the box writes a new input.")
export const ItemsVoiceButton = screen(
  '/p/shop/',
  'items',
  'With the voice button: no box on the list; the button in the middle records a new input.',
  true,
)
ItemsVoiceButton.name = 'Items \u00b7 voice button'
export const ItemDetail = screen(
  F1,
  'detail',
  'An opened item, its first page: title, state, what it is, its documents and subitems. No box here.',
)
export const ItemComments = screen(
  F1,
  'comments',
  'The same item, its second page: the conversation with the agents, and the box to reply.',
)
export const ItemWaitingOnYou = screen(
  '/p/shop/T7',
  'comments',
  'An item whose agent asks you: the question is on the Comments page, where you answer.',
)
export const ProjectComments = screen(
  '/p/shop/inputs',
  'inputs',
  'Comments with no item open: everything said in the project, newest first.',
)
export const Document = screen(
  '/p/shop/D1',
  'sheet',
  "A document opens over the item's detail, as a sheet: no bar under it.",
)
