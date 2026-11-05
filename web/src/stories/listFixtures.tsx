// The item list's demo project and how a story draws it: the project's items go through the page's own steps
// (listBody, heldRows, drawRows, listViews) and the page's ItemList draws them, with the state the page keeps for it. Used by the item list's stories and the
// prototypes.
import { useRef, useState, type ReactNode } from 'react'
import { EmptyList, ItemList, type ListEvents } from '../features/list/ItemList'
import { SelBar } from '../features/list/SelBar'
import { DeskFilters, FiltersButton, FilterStrip, type FilterEvents } from '../features/list/Filters'
import { drawRows, listViews } from '../features/list/drawRows'
import { heldRows, listBody } from '../features/list/rows'
import { queueHead, type DropHow } from '../model/items'
import { NO_FILTERS, type ListKey, type ListQuery } from '../model/route'
import type { Item, SavedView } from '../model/types'
import { filtersSet, otherTabs, searchWords } from '../model/visible'
import { SearchHints, type CrossFacts } from '../ui/SearchHints'
import { PROJECT_TONES } from '../ui/tones'
import type { Tab } from '../model/words'
import { T, item, message, noRowEvents, modelOf } from './fixtures'
import { act, acts } from './acts'

export const listOn: ListEvents = {
  ...noRowEvents,
  ...acts('List', ['view', 'ownView', 'drop', 'dragEnd', 'ownMenu', 'rename', 'renameStop', 'subMore', 'needsMore', 'archiveAll'] as const, { ownMenu: 'Item list › Views › Your own views, sorting' }),
  dragStart: () => null,
  dragOver: () => false,
}
const agent = { by: 'claude-code', t: T }
const ask = (id: number, text: string) => ({ wait: { id, kind: 'ask' as const, text, by: 'claude-code', files: [] }, thread: [message({ id, kind: 'ask', text })] })

/** A project as it is on a usual day: what waits on you, work in progress with its subitems, the queue, later, finished. */
export const PROJECT: Item[] = [
  item({ n: 1, status: 'doing', pri: 'P1', title: 'Export keeps the filter you set', agent }),
  item({ n: 2, type: 'bug', pri: 'P0', title: 'Saving drops the last word', ...ask(21, 'Is it every time, or only after a voice note?') }),
  item({ n: 3, status: 'proposed', by: 'claude-code', title: 'Keep the filter in the export file name' }),
  item({ n: 4, type: 'task', status: 'review', title: 'Sort by priority, then by number', thread: [message({ id: 41, text: 'Done: the list sorts by priority, then by number.' })] }),
  item({ n: 5, pri: 'P1', title: 'Search finds words in the talk' }),
  item({ n: 6, title: 'Excel export as well' }),
  item({ n: 7, type: 'idea', pri: 'P3', when: 'later', title: 'A dark theme for printing' }),
  item({ n: 8, status: 'done', title: 'Undo puts the row back' }),
  item({ n: 9, type: 'bug', status: 'dropped', title: 'Export button too small on the phone' }),
  item({ n: 10, status: 'done', archived: true, title: 'Rename projects' }),
  item({ n: 11, type: 'rule', title: 'Commit messages are in English' }),
  item({ n: 12, type: 'rule', status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item' }),
  item({ n: 14, type: 'task', parent: 1, title: 'Read the filter from the address' }),
  item({ n: 15, type: 'task', parent: 1, status: 'done', title: 'Write the rows the list shows' }),
  item({ n: 16, type: 'task', parent: 1, when: 'later', title: 'Keep the sort too' }),
]

/** What the page holds besides the project: the item open, rows picked, parents folded or showing their hidden
 * subitems, rows held still after you acted on them (the list as it was, and what each row you acted on says), your
 * own views, the bar over the rows, and what a tap does. */
export interface Holding {
  open?: number
  selected?: number[]
  folded?: number[]
  subMore?: number[]
  held?: { before: Item[]; said: Record<number, string> }
  saved?: readonly SavedView[]
  top?: ReactNode
  /** the filters set show over the rows (and take themselves off) */
  filters?: boolean
  /** the desktop's views opened onto all their lines from the start (⌄, F670) */
  viewsOpen?: boolean
  /** a row being dragged (`out`: off every row) */
  dragging?: { out: boolean }
  /** what a search finds in other projects (the hints under the list and in its empty line) */
  cross?: CrossFacts
  /** the row being dragged and where it would go, as the page works it out */
  drag?: { n: number; at?: { n?: number; how: DropHow } }
  on?: Partial<ListEvents>
}

/** The list as the page draws it, holding what the page holds for it (the route's tab and filters, stores.ui's folded
 * parents, shown subitems, picked rows): its views, Show more, a parent's fold, Cmd- and Shift-click to pick and Clear
 * search and filters work here (T662); what needs the rest of the page (opening an item, changing one) shows in the
 * Actions panel. */
export const listOf = (items: Item[], tab: Tab, q: Partial<ListQuery>, desk: boolean, h: Holding = {}) => <LiveList items={items} tab={tab} q={q} desk={desk} h={h} />

const toggle = (set: ReadonlySet<number>, n: number) => {
  const next = new Set(set)
  if (!next.delete(n)) next.add(n)
  return next
}

function LiveList({ items, tab: tab0, q: q0, desk, h }: { items: Item[]; tab: Tab; q: Partial<ListQuery>; desk: boolean; h: Holding }) {
  const m = modelOf(items)
  const [where, setWhere] = useState<{ tab: Tab; query: ListQuery }>({ tab: tab0, query: { ...NO_FILTERS, ...q0 } })
  const { tab, query } = where
  const [folded, setFolded] = useState(() => new Set(h.folded))
  const [subMore, setSubMore] = useState(() => new Set(h.subMore))
  const [needsAll, setNeedsAll] = useState(false)
  const [selected, setSelected] = useState(() => new Set(h.selected))
  const from = useRef<number | null>(null)
  const st = { folded, subMore, needsAll, open: h.open ?? null, desk }
  const body = listBody(m, tab, query, st)
  let rows = body.kind === 'rows' ? body.rows : []
  // rows you acted on hold still until the list changes (another view)
  const moved = tab !== tab0 || JSON.stringify(query) !== JSON.stringify({ ...NO_FILTERS, ...q0 })
  if (h.held && !moved) {
    const was = listBody(modelOf(h.held.before), tab, query, st)
    rows = heldRows(was.kind === 'rows' ? was.rows : [], m, tab, query, new Map(Object.entries(h.held.said).map(([n, s]) => [Number(n), s])))
  }
  const words = searchWords(query.q)
  const drawn = drawRows(m, rows, { slug: 'demo', openN: h.open ?? null, selected, words, desk, drafts: new Set(), head: queueHead(m.items), seen: { since: T }, drag: { n: h.drag?.n ?? null, at: h.drag?.at ?? null }, heldHeight: () => 64 })
  const { views, ownViews } = listViews(m, tab, query, body, { list: h.saved ?? [], edit: -1 })
  const why = body.kind === 'empty' ? body.why : body.kind === 'rows' ? body.empty : undefined
  // the page's nav.view and nav.showFilters: Archive is its own tab, a view of items goes back to Items
  const show = (f: Partial<ListQuery>, resetOthers: boolean) =>
    setWhere(tab === 'items' ? { tab, query: { ...query, ...f } } : { tab: 'items', query: { ...query, ...(resetOthers ? { type: 'all', when: 'all', pri: 'all', sort: 'all' } : {}), ...f } })
  const order = drawn.flatMap((r) => (r.kind === 'item' || r.kind === 'needs' || r.kind === 'held' ? [r.it.n] : []))
  // the page's selection.pick: Cmd-click picks or lets go of one, Shift-click the rows between
  const pick = (n: number, range: boolean) => {
    const a = order.indexOf(from.current ?? -1)
    const b = order.indexOf(n)
    const next = range && a >= 0 && b >= 0 ? new Set([...selected, ...order.slice(Math.min(a, b), Math.max(a, b) + 1)]) : toggle(selected, n)
    from.current = n
    setSelected(next)
  }
  const on: ListEvents = {
    ...listOn,
    open: (n, how) => (desk && how && (how.metaKey || how.ctrlKey || how.shiftKey) ? pick(n, how.shiftKey) : listOn.open(n, how)),
    fold: (n) => setFolded(toggle(folded, n)),
    subMore: (n) => setSubMore(toggle(subMore, n)),
    needsMore: () => setNeedsAll(!needsAll),
    view: (value) => (value === 'archive' ? setWhere({ tab: 'archive', query: { ...query, status: 'all' } }) : show({ status: value }, true)),
    ownView: (i) => {
      const v = h.saved?.[i]
      if (v) show({ type: v.type, when: v.when, status: v.status, pri: v.pri, sort: v.sort }, false)
    },
    ...h.on,
  }
  // the filters set, over the rows (the page's filterEvents: they change the list; Save as a view needs Taska)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // the desktop's views row: Filters at its start (opens the filters over the rows), ⌄ opens it onto all its lines
  const [viewsOpen, setViewsOpen] = useState(!!h.viewsOpen)
  const set = filtersSet(tab, query)
  const filterOn: FilterEvents = {
    set: (k, v) => setWhere({ tab, query: { ...query, [k]: v } }),
    unset: (k) => setWhere({ tab, query: { ...query, [k]: NO_FILTERS[k] } }),
    reset: () => setWhere({ tab, query: { ...query, q: '', type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' } }),
    saveView: act('Filters: save as a view'),
  }
  const filters = desk ? (
    <DeskFilters tab={tab} list={query} set={set} open={filtersOpen} place="" hidden={false} on={{ ...filterOn, toggle: () => setFiltersOpen(!filtersOpen) }} />
  ) : (
    <FilterStrip set={set} hidden={false} onUnset={(k) => filterOn.unset(k as ListKey)} onReset={filterOn.reset} />
  )
  // a search says where else its words are, as the page does: under the rows, or in the empty line
  const hints = (shown: number) =>
    words.length ? <SearchHints other={otherTabs(m, words, tab, shown)} cross={h.cross ?? { list: [], failed: false, q: query.q }} tone={() => PROJECT_TONES[1]} onShow={(t) => setWhere({ tab: t, query })} onGo={act('Search hints: go')} /> : null
  return (
    <div className="flex h-full flex-col">
      <ItemList
        loading={body.kind === 'loading'}
        desk={desk}
        openN={h.open ?? null}
        dragging={h.dragging ?? (h.drag ? { out: h.drag.at?.how === 'out' } : null)}
        views={views}
        viewsLead={desk ? <FiltersButton set={set.length > 0} open={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} /> : undefined}
        viewsMore={desk ? { open: viewsOpen, toggle: () => setViewsOpen(!viewsOpen) } : undefined}
        ownViews={ownViews}
        rows={drawn}
        top={h.top ?? ((h.filters && set.length) || (desk && filtersOpen) ? filters : selected.size && desk ? <SelBar n={selected.size} on={{ set: act('Picked: set'), clear: () => setSelected(new Set()) }} /> : undefined)}
        empty={
          why ? (
            <EmptyList
              why={why}
              q={words.join(' ')}
              status={query.status}
              organizerOn={m.facts.organizer.on}
              onReset={() => setWhere({ tab, query: { ...query, q: '', type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' } })}
              onConnect={act('List: connect an agent → Agents › Who works here')}
              hints={hints(0)}
            />
          ) : null
        }
        bottom={words.length && drawn.length ? <div className="flex flex-col py-4">{hints(drawn.length)}</div> : null}
        on={on}
      />
    </div>
  )
}
