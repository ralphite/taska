// F479 on the desktop, a prototype (nothing here changes Taska): search is a button in the sidebar's head, left of
// Hide sidebar (r796), and / anywhere; it opens a dialog in the command palette's sheet that listens at once (r655,
// r769) and searches every project by meaning. The dialog holds the phone's own search parts (pages/SearchPage: the
// box, the kinds, the results by project, the states), fed by the same flow as the phone's stories (searchPhone.tsx)
// with the demo project Shop (searchFixtures.ts). What is not built yet is drawn here: the dialog's keys, the page
// around it with no list search box (the filter at the end of the views' row, r796), and the way back to the search
// from a result. Every other part is the page's own component.
//
// The journeys
// 1. Find something by saying it. Click Search (or press /): the dialog opens, recording. Say it; ↵ or ↑ stops, the
//    words are written out into the box, and it searches: the results by project, the one you are in first.
// 2. Say more: the mic in the box, or ⌥V; ↵ stops. What you added is lit at the end; it searches all of it again.
// 3. Fix what it heard: click the right one of a word's two versions. Or type: click the words, or just start typing
//    (while it records, the first key throws the recording away and the box takes your keys); ↵ searches.
// 4. Use a result: ↑↓ walk the rows (blue; the pointer's row grey), ↵ or a click opens it in its project's pane, the
//    dialog gone; "Back to Search" (or Esc) brings the dialog back with the same results.
// 5. Leave: Esc, the x, or a click outside; the next search starts afresh, listening.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { Tooltip } from '../app/Tooltip'
import { Composer } from '../features/composer/Composer'
import { DocPaneNav } from '../features/docs/DocPane'
import { ViewBar } from '../features/list/ViewBar'
import { Rail, Sidebar, type SidebarEvents } from '../features/sidebar/Sidebar'
import { sideLinks } from '../features/sidebar/sideLinks'
import { boxRole, shownBox } from '../model/boxFoot'
import type { Found } from '../model/find'
import { codeOf, type ProjectModel } from '../model/project'
import { refCard } from '../model/refCard'
import { NO_FILTERS, parseRoute } from '../model/route'
import type { Item, ProjectRow } from '../model/types'
import { FiltersButton, ProjectBar } from '../pages/Header'
import { agentInfo, deskTabs, tabCounts } from '../pages/headFacts'
import { SearchBody, SearchBox, Status, type SearchEvents, type SearchView } from '../pages/SearchPage'
import { searchView, type SearchPlace } from '../pages/searchView'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { toneOf } from '../ui/tones'
import { Frame } from './Frames'
import { noRowEvents, T } from './fixtures'
import { pageOf } from './itemPage'
import { listOf } from './listFixtures'
import { D1, HOME, ORDER, SHOP } from './searchFixtures'
import { AT, useFlow, type Flow } from './searchPhone'
import { sideOn } from './sideFixtures'

/** The projects in the sidebar, as Taska last listed them: Shop (you are in it), Home, and one more. */
const ROWS: ProjectRow[] = [
  { name: 'shop', title: 'Shop', open: 0, needs: 0, pos: 0 },
  { name: 'home', title: 'Home', open: 1, needs: 0, pos: 1 },
  { name: 'notes', title: '读书笔记', open: 2, needs: 1, pos: 2 },
]
const TONES = sideProjects(ROWS, SHOP, 'shop').tones
const modelFor = (slug: string): ProjectModel => (slug === 'home' ? HOME : SHOP)

/** The search's data around it: you are in Shop; the rows are the desktop's (the pointer lights them, an item's
 * actions show on it). */
const placeFor = (onOpen: (x: Found) => void): SearchPlace => ({
  here: 'shop',
  m: SHOP,
  order: ORDER,
  tone: (slug) => toneOf(TONES, slug),
  seen: { since: T },
  drafts: new Set(),
  on: (x) => ({ ...noRowEvents, open: () => onOpen(x) }),
  now: Date.parse('2026-11-02T18:00:00-08:00'),
  desk: true,
})

const typingIn = (el: Element | null) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable

// ---------------------------------------------------------------- the dialog

/** The rows it found, in the order the keys walk them, with the keys' row lit (none while it searches). */
function litView(v: SearchView, sel: number): { v: SearchView; rows: Found[] } {
  const rows = (v.groups ?? []).flatMap((g) => g.rows)
  const lit = v.phase === 'found' ? rows[Math.min(sel, rows.length - 1)]?.key : undefined
  const groups = v.groups?.map((g) => ({
    ...g,
    rows: g.rows.map((r) => (r.kind === 'item' ? { ...r, look: { ...r.look, current: r.key === lit } } : { ...r, current: r.key === lit })),
  }))
  return { v: { ...v, groups: groups ?? null }, rows: rows.map((r) => r.found) }
}

/** The search in the command palette's sheet (the same frame, title row and close button), near the top and growing
 * down as it fills, so its box never moves: the box on top as the palette's field is, the kinds under it, then what
 * it found or what it is doing. Its keys: ↵ stops a recording, or
 * opens the keys' row (searches, once you typed); ↑↓ walk the rows; ⌥V says more; Esc closes; any other key, while it
 * records, starts typing. */
export function SearchDialog({ v: v0, on, sel, onSel, onClose }: { v: SearchView; on: SearchEvents; sel: number; onSel(i: number): void; onClose(): void }) {
  const root = useRef<HTMLDivElement>(null)
  const walked = useRef(false)
  const { v, rows } = litView(v0, sel)
  const rec = v.phase === 'listening'
  // the keys go to the field when it shows, else to the dialog (while it records, the field is hidden); a button you
  // clicked in it keeps them
  useLayoutEffect(() => {
    const r = root.current
    if (!r) return
    const field = r.querySelector<HTMLTextAreaElement>('textarea:not([hidden])')
    const active = document.activeElement
    if (active === (field ?? r) || (!field && active && active !== r && r.contains(active))) return
    if (field) {
      field.focus({ preventScroll: true })
      field.setSelectionRange(field.value.length, field.value.length)
    } else r.focus({ preventScroll: true })
  }, [v.typed, v.phase])
  useLayoutEffect(() => {
    if (!walked.current) return
    walked.current = false
    root.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])
  const keys = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    const stop = () => (e.preventDefault(), e.stopPropagation())
    if (e.key === 'Escape') return (stop(), onClose())
    if (e.altKey && e.code === 'KeyV') return (stop(), rec ? on.stop() : on.mic())
    if (rec) {
      if (e.key === 'Enter') return (stop(), on.stop())
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        stop()
        const join = v.words && !/\s$/.test(v.words) && e.key !== ' ' ? ' ' : ''
        return on.type(v.words + join + e.key)
      }
      return
    }
    if (!rows.length || v.phase !== 'found') return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      stop()
      walked.current = true
      return onSel((Math.min(sel, rows.length - 1) + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
    }
    if (e.key === 'Enter' && !e.shiftKey && !(v.typed && v.words.trim())) return (stop(), on.open(rows[Math.min(sel, rows.length - 1)]))
  }
  const again = !!v.groups && v.phase === 'searching'
  // what shows under the box: the results, or a word in the middle (recording, writing out: nothing)
  const middle = !v.groups && ['searching', 'nothing', 'unheard', 'nomic', 'offline'].includes(v.phase)
  return (
    <Sheet open look={{ top: true }} desk onClose={onClose}>
      <div ref={root} tabIndex={-1} onKeyDownCapture={keys} data-part="search" className="flex min-h-0 flex-1 flex-col outline-none">
        <SheetLayout
          title="Search"
          sub={
            <>
              <div className={`px-4 pt-1 ${v.groups || middle ? 'pb-3' : ''}`}>
                <SearchBox v={v} on={on} desk />
              </div>
              {v.kinds ? (
                <div className="flex h-12 items-center border-b border-zinc-200 pr-4 pl-2 dark:border-zinc-800">
                  <div className="min-w-0 flex-1 [&>[data-views]]:border-0">
                    <ViewBar views={v.kinds} onView={on.kind} />
                  </div>
                  {again ? (
                    <div className="shrink-0 [&>p]:mb-0 [&>p]:bg-transparent dark:[&>p]:bg-transparent">
                      <Status>Searching…</Status>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          }
          body={
            v.groups ? (
              <div className="-mx-4 -mt-2 dark:bg-zinc-950">
                <SearchBody v={v} on={on} desk />
              </div>
            ) : middle ? (
              <div className="flex min-h-44 flex-col justify-center">
                <SearchBody v={v} on={on} desk />
              </div>
            ) : null
          }
        />
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------- the page around it

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
export function DeskPage({ slug, n, rail, lead, onSearch }: { slug: string; n: number; rail: boolean; lead?: ReactNode; onSearch(): void }) {
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
          <div className="min-h-0 flex-1">{pageOf(it, true, { lead, docs: n === 1 && slug === 'shop' ? [D1] : [] })}</div>
          <DeskBox m={m} n={n} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the whole of it

export interface DeskOpts {
  /** the sidebar folded to its rail */
  rail?: boolean
  /** the keys' row, the nth result */
  sel?: number
}

/** The desktop through the search, from the state `start` names; `still`: it stays in that state (a state's story). */
export function SearchDesk({ start = {}, still = false, rail = false, sel: sel0 = 0 }: { start?: Partial<Flow>; still?: boolean } & DeskOpts) {
  const { f, on, set, openSearch, back } = useFlow(start, still)
  const [sel, setSel] = useState(sel0)
  // what the pane shows: the item open before the search, then the result you opened
  const [pane, setPane] = useState(() => (start.open?.n != null ? { slug: start.open.project, n: start.open.n } : { slug: 'shop', n: 1 }))
  // a new answer or kind: the keys' row is the first again
  const [was, setWas] = useState({ a: f.answer, k: f.kind })
  if (was.a !== f.answer || was.k !== f.kind) {
    setWas({ a: f.answer, k: f.kind })
    setSel(0)
  }
  const desk: SearchEvents = {
    ...on,
    // typing while it records or writes out: what was said goes, the box takes your keys
    type: (words) => set({ words, added: '', heard: [], typed: true, ...(f.phase === 'listening' || f.phase === 'writing' ? { phase: f.answer ? 'found' : 'ready' } : {}) }),
    open: (x) => {
      if (x.n != null) setPane({ slug: x.project, n: x.n })
      on.open(x)
    },
  }
  // the page's keys: / opens the search; on a result, Esc goes back to it
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/' && f.at !== 'search' && !typingIn(document.activeElement)) {
        e.preventDefault()
        openSearch()
      } else if (e.key === 'Escape' && f.at === 'open') {
        e.preventDefault()
        back()
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  const v = searchView(f, placeFor(desk.open))
  return (
    <>
      <DeskPage slug={pane.slug} n={pane.n} rail={rail} lead={f.at === 'open' ? <DocPaneNav to="Search" onBack={back} /> : undefined} onSearch={openSearch} />
      {f.at === 'search' ? <SearchDialog v={v} on={desk} sel={sel} onSel={setSel} onClose={on.leave} /> : null}
    </>
  )
}

/** The page's own tooltip, over the whole window (the buttons' tips with their keys). */
export const Tips = () => <Tooltip card={(ref) => refCard(SHOP, ref)} />

/** The desktop at a width (1440 unless the story says), 900 high. */
export const DeskFrame = ({ width = 1440, label, children }: { width?: number; label?: string; children: ReactNode }) => (
  <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
    <Frame layout="desk" width={width} height={900} label={label}>
      {children}
    </Frame>
    <Tips />
  </div>
)

/** A state's story: the desktop, opened on that state, staying in it. */
export const deskStory = (at: keyof typeof AT, o: DeskOpts & { width?: number } = {}) => ({
  render: () => (
    <DeskFrame width={o.width}>
      <SearchDesk start={AT[at]} still rail={o.rail} sel={o.sel} />
    </DeskFrame>
  ),
})
/** The page before the search, the sidebar as it is or folded. */
export const pageStory = (o: DeskOpts & { width?: number } = {}) => ({
  render: () => (
    <DeskFrame width={o.width}>
      <SearchDesk still rail={o.rail} />
    </DeskFrame>
  ),
})
