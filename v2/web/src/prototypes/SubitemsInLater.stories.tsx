// B532 (r733, r734; R534): a prototype, to look at before anything is built. A subitem put in Later, or finished,
// shows in its parent's Subitems on the item page, but the list's Active view hides it, so the two look out of step.
// Each story is the real page (the Storybook demo project) on the desktop and on the phone, side by side in one row
// that fits the window (R520), with only what an option adds drawn into it, in the page's own classes: the row's Later
// mark, the row's fold arrow, the "Show N more" line of the Needs-you band, the list's own rows as its All view draws
// them. Nothing here changes Taska itself.
// The demo's data for these stories: T12's only subitem, T13, is put in Later (and is open, not in progress): the list
// shows T12 with 0/1, no arrow and nothing under it (a row has its arrow only while a subitem of it shows). F01's
// subitems are as in the demo: T15 open, T14 finished. The data is changed in the page's own copy after it loads (its
// answer from the stand-in for Taska, app-shim.js, then the page loads it again); the saved answers stay as they are.
// ?screen=desktop|list|opened|item shows one screen at its own size (the screenshots).
import { useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ICON } from '../lib/icons'
import type { Item } from '../lib/types'

type Option = 'now' | 'one' | 'two' | 'three'
type Screen = 'desktop' | 'list' | 'opened' | 'item'
type Row = Pick<Item, 'n' | 'parent' | 'when' | 'status'>

const CHANGE: Record<number, Partial<Item>> = { 13: { when: 'later', status: 'open' } }
const SCREENS: Record<Screen, { path: string; w: number; h: number; label: string }> = {
  desktop: { path: '/p/shop/T12', w: 1440, h: 900, label: 'Desktop 1440' },
  list: { path: '/p/shop/', w: 393, h: 852, label: 'Phone \u00b7 list' },
  opened: { path: '/p/shop/', w: 393, h: 852, label: 'Phone \u00b7 list, lines tapped' },
  item: { path: '/p/shop/T12', w: 393, h: 852, label: 'Phone \u00b7 item page' },
}
// the screens each story shows; the row is as wide as the longest, so a screen is the same size in every story
const SHOWS: Record<Option, Screen[]> = {
  now: ['desktop', 'list', 'item'],
  one: ['desktop', 'list', 'opened', 'item'],
  two: ['desktop', 'list', 'item'],
  three: ['desktop', 'list', 'item'],
}
// the screens an option leaves as they are now
const SAME: Record<Option, Screen[]> = { now: [], one: [], two: ['item'], three: ['list'] }
const DRAWN = 'data-proto' // what the prototype added to the page; drawn again whenever the page draws
const PAD = ['pl-4', 'pl-10', 'pl-16', 'pl-22', 'pl-28', 'pl-34', 'pl-40', 'pl-46', 'pl-52'] // the list's, a level each
const closed = (r: Row) => r.status === 'done' || r.status === 'dropped'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until(ok: () => boolean, ms = 8000) {
  for (let t = 0; t < ms && !ok(); t += 25) await wait(25)
  return ok()
}
// the page's Icon, as markup
const icon = (n: keyof typeof ICON, c: string, sw: string) =>
  `<svg class="${c} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`

/** The page's answer with the stories' data in it, and the page loading it again (as when it is back online). */
function changeData(win: Window): Promise<Row[]> {
  return new Promise((done) => {
    const real = win.fetch.bind(win)
    win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = await real(input, init)
      const url = typeof input === 'string' ? input : 'href' in input ? input.href : input.url
      if (!/\/api\/state(\?|$)/.test(url) || !r.ok) return r
      const s = (await r.json()) as { items: Item[] }
      s.items = s.items.map((it) => ({ ...it, ...CHANGE[it.n] }))
      done(s.items.map(({ n, parent, when, status }) => ({ n, parent, when, status })))
      return new Response(JSON.stringify(s), { status: r.status, headers: { 'Content-Type': 'application/json' } })
    }
    const W = win as unknown as typeof globalThis
    win.dispatchEvent(new W.Event('online'))
  })
}

/** The rows the list's All view draws for the subitems Active hides, to put where an option shows them. */
async function allViewRows(doc: Document, rows: Row[]) {
  const want = rows.filter((r) => r.parent && (r.when === 'later' || closed(r))).map((r) => r.n),
    at = (n: number) => doc.querySelector<HTMLElement>(`#list article[data-n="${n}"]`),
    view = (v: string) => doc.querySelector<HTMLElement>(`[data-act="set-filter"][data-v="${v}"]`)?.click()
  const out = new Map<number, HTMLElement>()
  view('every')
  await until(() => want.every(at))
  for (const n of want) {
    const a = at(n)
    if (a) out.set(n, a.cloneNode(true) as HTMLElement)
  }
  view('all')
  await until(() => !want.some(at))
  return out
}

/** What the prototype keeps between drawings: the parents whose grey line was tapped, the arrows it drew closed. */
interface Kept {
  opened: Set<number>
  shut: Set<number>
}
/** What the option adds, drawn into the page as it is now. */
function draw(doc: Document, opt: Option, rows: Row[], copies: Map<number, HTMLElement>, k: Kept) {
  for (const e of doc.querySelectorAll(`[${DRAWN}]`)) e.remove()
  const again = () => draw(doc, opt, rows, copies, k),
    by = new Map(rows.map((r) => [r.n, r])),
    under = (n: number, p: number) => {
      for (let r = by.get(n); r?.parent; r = by.get(r.parent)) if (r.parent === p) return true
      return false
    },
    depth = (n: number) => {
      let d = 0
      for (let r = by.get(n); r?.parent; r = by.get(r.parent)) d++
      return d
    },
    mine = <T extends Element>(e: T) => {
      e.setAttribute(DRAWN, '')
      return e
    }
  // the item page's Subitems: a Later one says so, with the list row's own Later mark
  if (opt === 'one' || opt === 'three')
    for (const b of doc.querySelectorAll<HTMLElement>('#itemPage .divide-y > [data-act="goto"][data-n]')) {
      const r = by.get(Number(b.dataset.n))
      if (!r || r.when !== 'later' || closed(r)) continue
      const m = mine(doc.createElement('span'))
      m.className =
        'mt-0.5 shrink-0 rounded bg-zinc-100 px-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      m.textContent = 'Later'
      b.append(m)
    }
  if (opt !== 'one' && opt !== 'two') return
  // the list: each parent with subitems Active hides (option 1: Later and finished; option 2: Later)
  for (const p of new Set(rows.filter((r) => r.parent).map((r) => r.parent as number))) {
    const art = doc.querySelector<HTMLElement>(`#list article[data-n="${p}"]`),
      kids = rows.filter((r) => r.parent === p),
      later = kids.filter((r) => r.when === 'later' && !closed(r)),
      done = opt === 'one' ? kids.filter(closed) : []
    if (!art || !(later.length + done.length)) continue
    // the row's fold arrow: its own, or (none of its subitems shows) one drawn as the page draws it, since now
    // something shows under it
    const own = art.querySelector('[data-act="fold"]')
    const expanded = own ? own.getAttribute('aria-expanded') === 'true' : !k.shut.has(p)
    if (!own) {
      const b = mine(doc.createElement('button'))
      b.dataset.act = 'proto-fold' // no action of the page's: the row under it does not open
      b.className =
        '-my-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
      b.setAttribute('aria-expanded', String(expanded))
      b.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} subitems`)
      b.innerHTML = icon(expanded ? 'down' : 'right', 'size-4', '2')
      b.addEventListener('click', () => {
        if (expanded) k.shut.add(p)
        else k.shut.delete(p)
        again()
      })
      art.querySelector(`[data-act="open"][data-n="${p}"]`)?.append(b)
    }
    if (!expanded) continue
    let last: Element = art
    while (last.nextElementSibling?.matches('article[data-n]'))
      if (under(Number(last.nextElementSibling.getAttribute('data-n')), p)) last = last.nextElementSibling
      else break
    const add: Element[] = []
    const copy = (r: Row, grey: boolean) => {
      const c = copies.get(r.n)?.cloneNode(true) as HTMLElement | undefined
      if (!c) return
      if (grey) c.querySelector('[data-act="open"]')?.classList.add('opacity-55')
      add.push(mine(c))
    }
    if (opt === 'two')
      later.forEach((r) => copy(r, true)) // option 2: Later subitems in the list, greyed
    else {
      // option 1: one grey line, as the Needs-you band's "Show N more" (44 px high on the phone, as a row); a tap
      // shows them as All draws them
      const open = k.opened.has(p)
      if (open) [...later, ...done].forEach((r) => copy(r, false))
      const line = mine(doc.createElement('button'))
      line.className = `flex h-11 w-full items-center gap-1.5 border-b border-zinc-100 lg:h-10 ${PAD[Math.min(depth(p) + 1, 8)]} text-[13px] font-semibold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800/70 dark:text-zinc-400 dark:hover:bg-zinc-900`
      const n = later.length + done.length,
        said =
          later.length && done.length
            ? `${n} more: ${later.length} in Later, ${done.length} finished`
            : later.length
              ? `${n} more in Later`
              : `${n} more finished`
      line.innerHTML = icon(open ? 'chevup' : 'down', 'size-4', '2.25') + (open ? 'Show fewer' : said)
      line.addEventListener('click', () => {
        if (open) k.opened.delete(p)
        else k.opened.add(p)
        again()
      })
      add.push(line)
    }
    last.after(...add)
  }
}

/** Draws the option now and again each time the page draws, until stopped. */
function keep(doc: Document, paint: () => void) {
  const win = doc.defaultView
  let raf = 0
  const obs = new MutationObserver(() => {
    if (!raf && win) raf = win.requestAnimationFrame(run)
  })
  const run = () => {
    raf = 0
    obs.disconnect()
    paint()
    obs.takeRecords()
    obs.observe(doc.body, { childList: true, subtree: true })
  }
  run()
  return () => {
    obs.disconnect()
    if (raf) win?.cancelAnimationFrame(raf)
  }
}

/** The page with the stories' data, the parts each screen shows in view, and the option drawn in. */
async function prepare(f: HTMLIFrameElement, screen: Screen, opt: Option, gone: () => boolean) {
  const doc = () => f.contentDocument,
    has = (sel: string) => !!doc()?.querySelector(sel),
    list = screen !== 'item',
    page = screen === 'desktop' || screen === 'item'
  await until(() => has(list ? '#list [data-n]' : '#itemPage'), 15000)
  const win = f.contentWindow,
    d = doc()
  if (!win || !d || gone()) return null
  const rows = await changeData(win)
  // the list without T13 under T12 (no arrow); T12's item page with T13 among its subitems
  await until(
    () =>
      (!list || (has('#list article[data-n="12"]') && !has('#list article[data-n="13"]'))) &&
      (!page || has('#itemPage .divide-y > [data-act="goto"][data-n="13"]')),
  )
  const clip = d.getElementById('itemClip'),
    top = clip?.firstElementChild as HTMLElement | null
  if (screen === 'desktop' && clip && top && top.offsetHeight > clip.clientHeight)
    // the line between the item and its talk dragged down, as you would, so the item shows down to its Subitems
    d.documentElement.style.setProperty(
      '--top-h',
      Math.min(top.offsetHeight + 1, Math.round(d.documentElement.clientHeight * 0.76)) + 'px',
    )
  const copies = list && (opt === 'one' || opt === 'two') ? await allViewRows(d, rows) : new Map()
  await wait(150)
  if (gone()) return null
  const k: Kept = { opened: new Set(), shut: new Set() }
  if (screen === 'opened') for (const r of rows) if (r.parent) k.opened.add(r.parent) // every grey line tapped open
  return keep(d, () => draw(d, opt, rows, copies, k))
}

const LABEL = 36 // px: a screen's name above it, two short lines
/** How tall the screens are: one row (the desktop and three phones) as wide as the room, never taller than it. */
function rowHeight() {
  const n = Math.max(...Object.values(SHOWS).map((s) => s.length)),
    across = SCREENS.desktop.w / SCREENS.desktop.h + ((n - 1) * SCREENS.list.w) / SCREENS.list.h
  return Math.floor(Math.min((window.innerWidth - 32 - (n - 1) * 12) / across, window.innerHeight - 32 - 124 - LABEL))
}

/** One screen: the real page at its size (scaled to the row), shown once the option is drawn in. */
function Shot({
  id,
  screen,
  opt,
  scheme,
  rowH = 0,
}: {
  id?: string
  screen: Screen
  opt: Option
  scheme: string
  rowH?: number
}) {
  const s = SCREENS[screen],
    scale = rowH / s.h
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    let gone = false,
      stop: (() => void) | null = null
    const f = ref.current
    if (f)
      void prepare(f, screen, opt, () => gone).then((s) => {
        stop = s
        if (gone) s?.()
        else f.classList.remove('opacity-0')
      })
    return () => {
      gone = true
      stop?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const src = `/storybook/app.html#path=${encodeURIComponent(s.path)}&theme=${scheme === 'dark' ? 'dark' : 'light'}`
  if (!rowH) return <iframe ref={ref} title="Taska" src={src} className="block h-screen w-full border-0 opacity-0" />
  const big = `${location.pathname}?id=${id}&viewMode=story&screen=${screen}&globals=scheme:${scheme}`
  return (
    <section className="shrink-0" style={{ width: s.w * scale }}>
      <h3 className="mb-1 h-8 text-xs leading-4 font-semibold text-zinc-500 dark:text-zinc-400">
        <a href={big} target="_blank" rel="noreferrer" title="Open at full size" className="hover:underline">
          {s.label}
        </a>
        {SAME[opt].includes(screen) ? <span className="block font-normal">the same as now</span> : null}
      </h3>
      <div
        className="relative overflow-hidden bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-950 dark:ring-white/10"
        style={{ width: s.w * scale, height: rowH }}
      >
        <iframe
          ref={ref}
          title={s.label}
          src={src}
          className="absolute top-0 left-0 border-0 opacity-0"
          style={{ width: s.w, height: s.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
    </section>
  )
}

// what each story shows, and where to look
const NOTE: Record<Option, [string, string]> = {
  now: [
    'Now (as it is): T13, the only subitem of T12, is in Later; T14, one of F01\u2019s, is finished.',
    'List: T12 shows 0/1, no arrow, nothing under it; under F01 only T15. Item page: T12\u2019s Subitems lists T13 with no mark.',
  ],
  one: [
    'Option 1 (recommended): the item page marks Later; the list has one grey line for what Active hides.',
    'Item page: a Later mark at the right end of T13\u2019s row in Subitems. List: under F01, after T15, the line \u201c1 more finished\u201d; T12 gets its arrow, with the line \u201c1 more in Later\u201d right under its row. A tap on a line shows them (third screen), \u201cShow fewer\u201d hides them.',
  ],
  two: [
    'Option 2: the Active view also shows Later subitems, greyed.',
    'List: T12 gets its arrow, and T13 shows under it, greyed, with its Later mark. F01 is as now (finished T14 stays hidden). Item page: as now.',
  ],
  three: [
    'Option 3: only the item page marks Later.',
    'Item page: a Later mark at the right end of T13\u2019s row in Subitems. List: as now (T12 0/1, no arrow, nothing under it).',
  ],
}
const SAME_DATA =
  'Both sides count from the same data (one list of each item\u2019s subitems in the page): T12 shows 0/1 in the list and \u201cSubitems \u00b7 0/1\u201d on its item page; the list only hides what Active leaves out (Later, finished).'

function Board({ id, opt, scheme }: { id: string; opt: Option; scheme: string }) {
  const only = new URLSearchParams(location.search).get('screen') as Screen | null
  const [rowH, setRowH] = useState(rowHeight)
  useEffect(() => {
    const on = () => setRowH(rowHeight())
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  if (only && only in SCREENS) return <Shot key={scheme} screen={only} opt={opt} scheme={scheme} />
  const [what, where] = NOTE[opt]
  return (
    <div data-story-links className="min-h-screen bg-zinc-100 p-4 dark:bg-zinc-900">
      {/* as tall in every story, so the screens stand at the same place when you switch stories */}
      <div className="mb-3 flex min-h-28 flex-col gap-0.5 text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">
        <p className="text-zinc-900 dark:text-zinc-100">
          <span className="font-semibold">Prototype for B532, not built yet.</span> {what}
        </p>
        <p>
          <span className="font-semibold">Where: </span>
          {where}
        </p>
        <p>{SAME_DATA}</p>
      </div>
      <div className="flex items-start gap-3">
        {SHOWS[opt].map((s) => (
          <Shot key={s + scheme} id={id} screen={s} opt={opt} scheme={scheme} rowH={rowH} />
        ))}
      </div>
    </div>
  )
}

const meta: Meta = {
  title: 'Prototype/B532 Subitems in Later',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

const story = (opt: Option): StoryObj => ({
  parameters: { docs: { description: { story: `Prototype, not built yet. ${NOTE[opt].join(' ')} ${SAME_DATA}` } } },
  render: (_, { id, globals }) => <Board id={id} opt={opt} scheme={String(globals.scheme)} />,
})
export const Now: StoryObj = { ...story('now'), name: 'Now (as it is)' }
export const Option1: StoryObj = { ...story('one'), name: 'Option 1 \u00b7 Later mark and a grey line' }
export const Option2: StoryObj = { ...story('two'), name: 'Option 2 \u00b7 Later subitems shown, grey' }
export const Option3: StoryObj = { ...story('three'), name: 'Option 3 \u00b7 Later mark only' }
