// F479 on the desktop, a prototype: the page around the search (stories/searchDesk.tsx), each part the page's own
// component with the demo projects Shop and Home (searchFixtures.ts): the sidebar with its Search row (or the rail
// with its magnifier), the project's bar, the list with no search box over it (its filter at the end of the views'
// row, r796), the item open in its pane, the box under it; and the preview of what the search found, drawn by the
// pages that show it (an item's page, a document, an input as the New input page lists it).
import type { ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { Composer } from '../features/composer/Composer'
import { ItemPage } from '../features/item/ItemPage'
import { Rail, Sidebar, type SidebarEvents } from '../features/sidebar/Sidebar'
import { sideLinks } from '../features/sidebar/sideLinks'
import { boxRole, shownBox } from '../model/boxFoot'
import type { Found } from '../model/find'
import { codeOf, type ProjectModel } from '../model/project'
import { NO_FILTERS, parseRoute } from '../model/route'
import { latestMessage } from '../model/talk'
import type { Item, ProjectRow } from '../model/types'
import { FiltersButton, ProjectBar } from '../pages/Header'
import { agentInfo, deskTabs, tabCounts } from '../pages/headFacts'
import { toneOf } from '../ui/tones'
import { docAt } from './docPage'
import { input } from './fixtures'
import { pageOf } from './itemPage'
import { itemFacts, noItemEvents, talkEnv, talkFacts } from './itemFixtures'
import { saidRowOf } from './inputFixtures'
import { listOf } from './listFixtures'
import { D1, HOME, SHOP } from './searchFixtures'
import { sideOn } from './sideFixtures'

/** The projects in the sidebar, as Taska last listed them: Shop (you are in it), Home, and one more. */
const ROWS: ProjectRow[] = [
  { name: 'shop', title: 'Shop', open: 0, needs: 0, pos: 0 },
  { name: 'home', title: 'Home', open: 1, needs: 0, pos: 1 },
  { name: 'notes', title: '读书笔记', open: 2, needs: 1, pos: 2 },
]
export const TONES = sideProjects(ROWS, SHOP, 'shop').tones
export const modelFor = (slug: string): ProjectModel => (slug === 'home' ? HOME : SHOP)
export const titleOf = (slug: string) => modelFor(slug).facts.title

/** The item a row found is or opens. */
export const itemOf = (x: Found): Item | undefined => (x.n == null ? undefined : (modelFor(x.project).byN.get(x.n) ?? (x.item as Item | undefined)))

// ---------------------------------------------------------------- the preview

/** What the search's highlighted row shows beside the list, as the page that opens it draws it (read only). */
export function previewOf(x: Found): ReactNode {
  const m = modelFor(x.project)
  if (x.kind === 'docs') return <div className="px-6 pt-5 pb-8">{docAt(D1, true, { viewOnly: true })}</div>
  if (x.kind === 'inputs')
    return saidRowOf(input({ id: x.key, text: x.title ?? '', t: x.t ?? '', acked: true, touched: x.n == null ? [] : [x.n] }))
  const it = itemOf(x)
  if (!it) return null
  return (
    <div className="px-1 pt-1">
      <ItemPage it={it} f={itemFacts(m, it)} env={talkEnv(m, true, { latest: latestMessage(it) })} facts={talkFacts(m)} on={noItemEvents} />
    </div>
  )
}

// ---------------------------------------------------------------- the page

/** The box under the pane, as the desktop draws it: a reply to the item open. */
function DeskBox({ m, n }: { m: ProjectModel; n: number }) {
  const route = parseRoute(`/p/shop/${codeOf(m, n)}`, '')
  if (route.page !== 'project') throw new Error('not a project')
  const role = boxRole(m, route, false, m.facts.title, null, { reply: null, quote: null, sel: new Set() }, { mine: {}, going: {}, open: new Set() })
  const shown = shownBox(role, { mode: null, text: '', key: 'here', recordingFor: null })
  return (
    <footer className="relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-8 pt-3 pb-5 dark:border-transparent dark:bg-transparent dark:pt-1">
      <Composer line={shown.line} waiting={shown.waiting} placeholder={shown.placeholder} sendWord={shown.send} text="" desk composePage={false} micTip="Voice note · ⌥V" on={{ text() {}, send() {}, attach() {}, mic() {} }} />
    </footer>
  )
}

/** The end of the views' row: the list's filter, where the search box was (r796: no row of its own over the list). */
const FiltersEnd = () => (
  <div className="flex shrink-0 items-center self-stretch border-b border-zinc-200 pr-2 dark:border-zinc-800">
    <FiltersButton set={false} open={false} onClick={() => {}} />
  </div>
)

/** The desktop's project page: the sidebar (or its rail), the project's bar, the list, the item open in its pane. */
export function DeskPage({ slug, n, rail, onSearch }: { slug: string; n: number; rail: boolean; onSearch(): void }) {
  const m = modelFor(slug)
  const projects = sideProjects(ROWS, m, slug).list
  const sOn: SidebarEvents = { ...sideOn, search: onSearch }
  const it = m.byN.get(n) as Item
  return (
    <div className="flex h-full">
      {rail ? (
        <Rail projects={projects} composing={false} settingsOpen={false} on={sOn} />
      ) : (
        <Sidebar phone={false} projects={projects} composing={false} links={sideLinks(slug, null)} place="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800" on={sOn} />
      )}
      <div className="grid h-full min-w-0 flex-1 grid-cols-[360px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-white wide:grid-cols-[420px_minmax(0,1fr)] dark:bg-zinc-950">
        <ProjectBar
          title={m.facts.title}
          tone={toneOf(TONES, slug)}
          tabs={deskTabs(tabCounts(m, 'items', NO_FILTERS, true), 'items', false)}
          agent={agentInfo(m, 0)}
          notSaved={0}
          place="col-span-2"
          on={{ tab() {}, agents() {}, notSaved() {} }}
        />
        <section className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-zinc-800">{listOf(m.items, 'items', {}, true, { open: n, viewsEnd: <FiltersEnd /> })}</section>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1">{pageOf(it, true, { docs: n === 1 && slug === 'shop' ? [D1] : [] })}</div>
          <DeskBox m={m} n={n} />
        </div>
      </div>
    </div>
  )
}
