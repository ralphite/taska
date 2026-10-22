// T456 (#5708, #5712): a prototype of a new phone layout, to look at before anything is built. Each story is the real
// page (the Storybook demo project) with the new bottom bar drawn over it: Projects · Items · Comments, in the order
// of the levels (a project holds items, an item holds its comments). An opened item is two pages: its detail under
// Items, its conversation under Comments. Nothing here changes Taska itself.
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

/** Runs inside the page: the new bar, and the item split into its two pages. */
function draw(doc: Document, s: Screen) {
  const byId = (id: string) => doc.getElementById(id)
  const hide = (id: string) => {
    const e = byId(id)
    if (e) e.style.display = 'none'
  }
  hide('tabs') // Items / Inputs / Rules go: the bar has the levels; Rules move into the Items views
  if (s.projects) {
    const d = byId('drawer'),
      app = byId('app')
    byId('projBtn')?.click()
    if (d) Object.assign(d.style, { width: '100%', maxWidth: 'none', transform: 'none' })
    if (app) app.style.visibility = 'hidden'
  }
  if (s.item === 'detail') {
    hide('itemTalk')
    hide('foot') // nothing to write on the detail page: the box is under Comments
  }
  if (s.item === 'comments') {
    hide('itemTop')
    const b = byId('detailBody')
    if (b) b.scrollTop = b.scrollHeight
  }
  if (s.sheet) return
  const bar = doc.createElement('div')
  bar.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;height:78px;padding-bottom:20px;background:#fff;border-top:1px solid #e4e4e7;' +
    'display:flex;align-items:center;justify-content:space-around;z-index:60;font:500 10.5px -apple-system,system-ui'
  for (const t of ['Projects', 'Items', 'Comments'] as Tab[]) {
    const on = t === s.tab,
      color = on ? '#2563eb' : '#71717a',
      count = t === 'Comments' && s.item ? '<span style="margin-left:2px;color:#a1a1aa">4</span>' : ''
    const el = doc.createElement('div')
    el.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:3px;width:96px;color:${color}`
    el.innerHTML =
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" ` +
      `stroke-linejoin="round">${ICON[t]}</svg><span>${t}${count}</span>`
    bar.append(el)
  }
  doc.body.append(bar)
  const app = byId('app')
  if (app) app.style.paddingBottom = '78px'
}

function App({ s, scheme }: { s: Screen; scheme: string }) {
  return (
    <iframe
      title="Taska"
      src={`/storybook/app.html#path=${encodeURIComponent(s.path)}&theme=${scheme === 'dark' ? 'dark' : 'light'}`}
      className="block h-screen w-full border-0"
    />
  )
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    const f = canvasElement.querySelector('iframe')
    for (let i = 0; i < 100 && !f?.contentDocument?.getElementById('app'); i++) await wait(100)
    await wait(900)
    if (f?.contentDocument) draw(f.contentDocument, s)
  },
})

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
