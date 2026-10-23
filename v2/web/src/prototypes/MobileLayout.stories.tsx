// T456 (#5708, #5712): a prototype of a new phone layout, to look at before anything is built. Each story is the real
// page (the Storybook demo project) with the new bottom bar drawn over it: Projects · Items · Comments, in the order
// of the levels (a project holds items, an item holds its comments). An opened item is two pages: its detail under
// Items, its conversation under Comments. Walkthrough plays it through as a person would (R488: a big mark where it
// taps, the time a person takes, a line saying each step). Nothing here changes Taska itself.
import type { Meta, StoryObj } from '@storybook/react-vite'

type Tab = 'Projects' | 'Items' | 'Comments'
interface Screen {
  path: string
  tab: Tab
  /** what the page shows of an opened item: its detail, or its conversation */
  item?: 'detail' | 'comments'
  /** the project list as a page of its own */
  projects?: boolean
  /** a sheet over the page: no bar */
  sheet?: boolean
  note: string
}

const ICON = {
  Projects:
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  Items:
    '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  Comments:
    '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
}
const TABS: Tab[] = ['Projects', 'Items', 'Comments']
const DRAWN = 'data-proto' // what the prototype changed in the page, so the next screen starts from the page itself

/** Runs inside the page: the new bar, and the item split into its two pages. */
function draw(doc: Document, s: Screen) {
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
  if (s.projects) {
    const d = byId('drawer')?.getBoundingClientRect()
    if (!d || d.right <= 0) byId('projBtn')?.click()
    restyle(byId('drawer'), { width: '100%', maxWidth: 'none', transform: 'none' })
    restyle(byId('app'), { visibility: 'hidden' })
  }
  if (s.item === 'detail') {
    restyle(byId('itemTalk'), { display: 'none' })
    restyle(byId('foot'), { display: 'none' }) // nothing to write on the detail page: the box is under Comments
  }
  if (s.item === 'comments') {
    restyle(byId('itemTop'), { display: 'none' })
    const b = byId('detailBody')
    if (b) b.scrollTop = b.scrollHeight
  }
  if (s.sheet) return
  const bar = doc.createElement('div')
  bar.setAttribute(DRAWN, 'added')
  bar.id = 'protoBar'
  bar.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;height:78px;padding-bottom:20px;background:#fff;border-top:1px solid #e4e4e7;' +
    'display:flex;align-items:center;justify-content:space-around;z-index:60;font:500 10.5px -apple-system,system-ui'
  for (const t of TABS) {
    const on = t === s.tab,
      color = on ? '#2563eb' : '#71717a',
      count = t === 'Comments' && s.item ? '<span style="margin-left:2px;color:#a1a1aa">4</span>' : ''
    const el = doc.createElement('div')
    el.dataset.tab = t
    el.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:3px;width:96px;color:${color}`
    el.innerHTML =
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" ` +
      `stroke-linejoin="round">${ICON[t]}</svg><span>${t}${count}</span>`
    bar.append(el)
  }
  doc.body.append(bar)
  restyle(byId('app'), { paddingBottom: '78px', ...(s.projects ? { visibility: 'hidden' } : {}) })
}

// ---------------------------------------------------------------- the walkthrough (R488)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The line under the screen saying what happens now (under it, so it hides none of the page) */
function say(canvas: HTMLElement, text: string) {
  const el = canvas.querySelector<HTMLElement>('[data-say]')
  if (!el) return
  el.textContent = text
  el.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 250 })
}
/** A big mark where a finger taps, which stays a moment and spreads */
async function tap(doc: Document, el: Element | null | undefined) {
  if (!el) return
  const r = el.getBoundingClientRect(),
    x = r.left + r.width / 2,
    y = r.top + r.height / 2
  const dot = doc.createElement('div')
  dot.style.cssText =
    `position:fixed;left:${x - 28}px;top:${y - 28}px;width:56px;height:56px;border-radius:50%;z-index:95;pointer-events:none;` +
    'background:rgba(37,99,235,.35);border:3px solid rgba(37,99,235,.95);box-shadow:0 0 0 6px rgba(37,99,235,.15)'
  doc.body.append(dot)
  dot.animate(
    [
      { transform: 'scale(.4)', opacity: 0.4 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: 220, fill: 'forwards' },
  )
  await wait(650) // the finger is down long enough to be seen
  const ring = dot.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.8)', opacity: 0 },
    ],
    {
      duration: 450,
      fill: 'forwards',
    },
  )
  await ring.finished
  dot.remove()
}

// r679 (T457): the words go under the page with room between, never on it; the page keeps one size while they change
function App({ s, scheme, caption }: { s: Screen; scheme: string; caption?: boolean }) {
  return (
    <div className="flex h-screen flex-col bg-zinc-900">
      <iframe
        title="Taska"
        src={`/storybook/app.html#path=${encodeURIComponent(s.path)}&theme=${scheme === 'dark' ? 'dark' : 'light'}`}
        // R488: the prototype appears drawn, not drawn in front of you
        className={`block w-full shrink-0 border-0 bg-white opacity-0 transition-opacity duration-300 ${caption ? 'h-[calc(100vh-5.5rem)]' : 'h-screen'}`}
      />
      {caption ? (
        <div
          data-say
          className="mx-3 mt-3 line-clamp-2 h-14 shrink-0 rounded-xl bg-zinc-800 px-4 py-2 text-[15px] leading-snug font-semibold text-white"
        >
          Starting…
        </div>
      ) : null}
    </div>
  )
}
async function pageOf(canvas: HTMLElement) {
  const f = canvas.querySelector('iframe')
  for (let i = 0; i < 100 && !f?.contentDocument?.getElementById('app'); i++) await wait(100)
  await wait(900)
  return f
}

const meta: Meta = {
  title: 'Prototype/New mobile layout',
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'phone', isRotated: false } },
}
export default meta

const story = (s: Screen): StoryObj => ({
  parameters: { docs: { description: { story: s.note } } },
  render: (_, { globals }) => <App s={s} scheme={String(globals.scheme)} />,
  play: async ({ canvasElement }) => {
    const f = await pageOf(canvasElement)
    if (f?.contentDocument) draw(f.contentDocument, s)
    f?.classList.remove('opacity-0')
  },
})

const START: Screen = { path: '/p/shop/', tab: 'Items', note: '' }
export const Walkthrough: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Plays the new layout through: the items, one opened (its detail), its conversation, the projects. A blue mark shows each tap.',
      },
    },
  },
  render: (_, { globals }) => <App s={START} scheme={String(globals.scheme)} caption />,
  play: async ({ canvasElement }) => {
    const f = await pageOf(canvasElement),
      doc = f?.contentDocument,
      win = f?.contentWindow
    if (!doc || !win) return
    const bar = (t: Tab) => doc.querySelector(`#protoBar [data-tab="${t}"]`)
    draw(doc, START)
    say(canvasElement, '1 / 5 · Items: this project’s items')
    f.classList.remove('opacity-0')
    await wait(2500)
    // an item with subitems and documents, so its detail has something to show
    const row =
      doc.querySelector('#list [data-act="open"][data-n="1"]') || doc.querySelector('#list [data-act="open"][data-n]')
    say(canvasElement, '2 / 5 · Tap an item')
    await wait(1200)
    await tap(doc, row)
    ;(row as HTMLElement | null)?.click()
    for (let i = 0; i < 40 && !doc.getElementById('itemTop'); i++) await wait(25) // drawn as soon as it opens: no flash
    draw(doc, { path: '', tab: 'Items', item: 'detail', note: '' })
    say(canvasElement, '2 / 5 · Its detail first: title, state, what it is, its documents and subitems (no box here)')
    await wait(2800)
    say(canvasElement, '3 / 5 · Tap Comments')
    await wait(1200)
    await tap(doc, bar('Comments'))
    draw(doc, { path: '', tab: 'Comments', item: 'comments', note: '' })
    say(canvasElement, '3 / 5 · Its conversation with the agents, and the box to reply')
    await wait(2800)
    say(canvasElement, '4 / 5 · Tap Items: back to its detail')
    await wait(1200)
    await tap(doc, bar('Items'))
    draw(doc, { path: '', tab: 'Items', item: 'detail', note: '' })
    await wait(2000)
    say(canvasElement, '5 / 5 · Tap Projects')
    await wait(1200)
    await tap(doc, bar('Projects'))
    draw(doc, { path: '', tab: 'Projects', projects: true, note: '' })
    say(canvasElement, '5 / 5 · Every project, and Documents, Activity, Deleted, Settings')
    await wait(2800)
    say(canvasElement, 'Done. Reload this page to watch it again')
  },
}

export const Projects = story({
  path: '/p/shop/',
  tab: 'Projects',
  projects: true,
  note: 'The top level: every project, and Documents, Activity, Deleted, Settings.',
})
export const Items = story({ path: '/p/shop/', tab: 'Items', note: "A project's items; the box writes a new input." })
export const ItemDetail = story({
  path: '/p/shop/F1',
  tab: 'Items',
  item: 'detail',
  note: 'An opened item, its first page: title, state, what it is, its documents and subitems. No box here.',
})
export const ItemComments = story({
  path: '/p/shop/F1',
  tab: 'Comments',
  item: 'comments',
  note: 'The same item, its second page: the conversation with the agents, and the box to reply.',
})
export const ItemWaitingOnYou = story({
  path: '/p/shop/T7',
  tab: 'Comments',
  item: 'comments',
  note: 'An item whose agent asks you: the question is on the Comments page, where you answer.',
})
export const ProjectComments = story({
  path: '/p/shop/inputs',
  tab: 'Comments',
  note: 'Comments with no item open: everything said in the project, newest first.',
})
export const Document = story({
  path: '/p/shop/D1',
  tab: 'Items',
  sheet: true,
  note: "A document opens over the item's detail, as a sheet: no bar under it.",
})
