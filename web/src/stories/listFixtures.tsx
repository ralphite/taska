// The task list's demo project and how a story draws it: the project's tasks go through the page's own steps
// (listBody, heldRows, drawRows, listViews) and the page's TaskList draws them, with the state the page keeps for it. Used by the task list's stories and the
// prototypes.
import { useRef, useState, type ReactNode } from 'react'
import { EmptyList, TaskList, type ListEvents } from '../features/list/TaskList'
import { SelBar } from '../features/list/SelBar'
import { DeskFilters, FiltersButton, FilterStrip, type FilterEvents } from '../features/list/Filters'
import { projectTags } from '../model/tasks'
import type { RowFacts } from '../features/list/ListRows'
import { drawRows, listViews } from '../features/list/drawRows'
import { heldMark, heldRows, listBody } from '../features/list/rows'
import { queueHead, type DropHow } from '../model/tasks'
import { NO_FILTERS, type ListKey, type ListQuery } from '../model/route'
import { firstSteps } from '../model/project'
import type { Task, SavedView } from '../model/types'
import { filtersSet } from '../model/visible'
import type { Tab } from '../model/words'
import { T, task, message, noRowEvents, modelOf } from './fixtures'
import { act, acts } from './acts'

const firstActs = acts('First steps', ['connect', 'say', 'phone'] as const, { connect: 'Agents', phone: 'Settings › Use on your phone' })
export const listOn: ListEvents = {
  ...noRowEvents,
  ...acts('List', ['view', 'ownView', 'drop', 'dragEnd', 'ownMenu', 'rename', 'renameStop', 'subMore', 'archiveAll', 'proposal'] as const, { ownMenu: 'Task list › Views › Your own views, sorting', proposal: 'Rules › Screens › A proposal opened' }),
  dragStart: () => null,
  dragOver: () => false,
}
const agent = { by: 'claude-code', t: T }
const ask = (id: number, text: string) => ({ wait: { id, kind: 'ask' as const, text, by: 'claude-code', files: [] }, thread: [message({ id, kind: 'ask', text })] })

/** A project as it is on a usual day: what waits on you, work in progress with its subtasks, the queue, later, finished. */
export const PROJECT: Task[] = [
  task({ n: 1, status: 'doing', pri: 'P1', title: 'Export keeps the filter you set', agent }),
  task({ n: 2, tags: ['bug'], pri: 'P0', title: 'Saving drops the last word', ...ask(21, 'Is it every time, or only after a voice note?') }),
  task({ n: 3, status: 'proposed', by: 'claude-code', title: 'Keep the filter in the export file name' }),
  task({ n: 4, status: 'review', title: 'Sort by priority, then by number', thread: [message({ id: 41, text: 'Done: the list sorts by priority, then by number.' })] }),
  task({ n: 5, pri: 'P1', title: 'Search finds words in the talk' }),
  task({ n: 6, title: 'Excel export as well' }),
  task({ n: 7, pri: 'P3', when: 'later', title: 'A dark theme for printing' }),
  task({ n: 8, status: 'done', title: 'Undo puts the row back' }),
  task({ n: 9, tags: ['bug'], status: 'dropped', title: 'Export button too small on the phone' }),
  task({ n: 10, status: 'done', archived: true, title: 'Rename projects' }),
  task({ n: 14, parent: 1, title: 'Read the filter from the address' }),
  task({ n: 15, parent: 1, status: 'done', title: 'Write the rows the list shows' }),
  task({ n: 16, parent: 1, when: 'later', title: 'Keep the sort too' }),
]

/** What the page holds besides the project: the task open, rows picked, parents folded or showing their hidden
 * subtasks, rows held still after you acted on them (the list as it was, and what each row you acted on says), your
 * own views, the bar over the rows, and what a tap does. */
export interface Holding {
  open?: number
  selected?: number[]
  folded?: number[]
  subMore?: number[]
  held?: { before: Task[]; said: Record<number, string> }
  saved?: readonly SavedView[]
  top?: ReactNode
  /** the filters set show over the rows (and take themselves off) */
  filters?: boolean
  /** the desktop's views opened onto all their lines from the start (⌄, T670) */
  viewsOpen?: boolean
  /** a row being dragged (`out`: off every row) */
  dragging?: { out: boolean }
  /** the row being dragged and where it would go, as the page works it out */
  drag?: { n: number; at?: { n?: number; how: DropHow } }
  on?: Partial<ListEvents>
  /** an empty project's first steps, as done (D115 #20; else as its data says) */
  firstRun?: Partial<{ agent: boolean; input: boolean; phone: boolean }>
  /** what a prototype adds to a row (D152: its tags, a group, what it waits for) */
  facts?(it: Task): Partial<RowFacts>
  /** a prototype's own tag the list shows (else the filters' own) */
  tags?: { on: string | null; pick(t: string | null): void }
}

/** The list as the page draws it, holding what the page holds for it (the route's tab and filters, stores.ui's folded
 * parents, shown subtasks, picked rows): its views, Show more, a parent's fold, Cmd- and Shift-click to pick and Clear
 * filters work here (T662); what needs the rest of the page (opening a task, changing one) shows in the
 * Actions panel. */
export const listOf = (tasks: Task[], tab: Tab, q: Partial<ListQuery>, desk: boolean, h: Holding = {}) => <LiveList tasks={tasks} tab={tab} q={q} desk={desk} h={h} />

const toggle = (set: ReadonlySet<number>, n: number) => {
  const next = new Set(set)
  if (!next.delete(n)) next.add(n)
  return next
}

function LiveList({ tasks, tab: tab0, q: q0, desk, h }: { tasks: Task[]; tab: Tab; q: Partial<ListQuery>; desk: boolean; h: Holding }) {
  const all = modelOf(tasks)
  // a prototype's tag picked: only the tasks with it; each row still drawn from the whole project
  const tag = h.tags?.on ?? null
  const m = tag ? modelOf(tasks.filter((it) => it.tags.includes(tag))) : all
  const [where, setWhere] = useState<{ tab: Tab; query: ListQuery }>({ tab: tab0, query: { ...NO_FILTERS, ...q0 } })
  const { tab, query } = where
  const [folded, setFolded] = useState(() => new Set(h.folded))
  const [subMore, setSubMore] = useState(() => new Set(h.subMore))
  const [selected, setSelected] = useState(() => new Set(h.selected))
  const from = useRef<number | null>(null)
  const st = { folded, subMore, open: h.open ?? null, desk }
  const body = listBody(m, tab, query, st)
  let rows = body.kind === 'rows' ? body.rows : []
  // rows you acted on hold still until the list changes (another view)
  const moved = tab !== tab0 || JSON.stringify(query) !== JSON.stringify({ ...NO_FILTERS, ...q0 })
  if (h.held && !moved) {
    const was = listBody(modelOf(h.held.before), tab, query, st)
    rows = heldRows(was.kind === 'rows' ? was.rows : [], m, tab, query, new Map(Object.entries(h.held.said).map(([n, s]) => [Number(n), heldMark({ said: s, f: 'status', v: m.byN.get(Number(n))?.status })])))  // struck when the change closed it (T766)
  }
  const drawn0 = drawRows(all, rows, { slug: 'demo', openN: h.open ?? null, selected, words: [], desk, drafts: new Set(), head: queueHead(m.tasks), seen: { since: T }, drag: { n: h.drag?.n ?? null, at: h.drag?.at ?? null } })
  const drawn = h.facts ? drawn0.map((r) => (r.kind === 'task' || r.kind === 'needs' ? { ...r, facts: { ...r.facts, ...h.facts?.(r.it) } } : r)) : drawn0
  const { views, ownViews } = listViews(m, tab, query, body, { list: h.saved ?? [], edit: -1 })
  const why = body.kind === 'empty' ? body.why : body.kind === 'rows' ? body.empty : undefined
  // the page's nav.view and nav.showFilters: Archive is its own tab, a view of tasks goes back to Tasks
  const show = (f: Partial<ListQuery>, resetOthers: boolean) =>
    setWhere(tab === 'tasks' ? { tab, query: { ...query, ...f } } : { tab: 'tasks', query: { ...query, ...(resetOthers ? { type: 'all', when: 'all', pri: 'all', sort: 'all' } : {}), ...f } })
  const order = drawn.flatMap((r) => (r.kind === 'task' || r.kind === 'needs' ? [r.it.n] : []))
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
    view: (value) => (value === 'archive' ? setWhere({ tab: 'archive', query: { ...query, status: 'all' } }) : show({ status: value }, true)),
    ownView: (i) => {
      const v = h.saved?.[i]
      if (v) show({ tag: v.tag, when: v.when, status: v.status, pri: v.pri, sort: v.sort }, false)
    },
    ...h.on,
  }
  // the filters set, over the rows (the page's filterEvents: they change the list; Save as a view needs Taska)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // the desktop's views row: Filters at its start (opens the filters over the rows), ⌄ opens it onto all its lines
  const [viewsOpen, setViewsOpen] = useState(!!h.viewsOpen)
  const set: [ListKey, ReactNode][] = [...(tag ? [['tag', '#' + tag] as [ListKey, string]] : []), ...filtersSet(tab, query)]
  const filterOn: FilterEvents = {
    set: (k, v) => (h.tags && k === 'tag' ? h.tags.pick(v === 'all' ? null : v) : setWhere({ tab, query: { ...query, [k]: v } })),
    unset: (k) => (h.tags && k === 'tag' ? h.tags.pick(null) : setWhere({ tab, query: { ...query, [k]: NO_FILTERS[k] } })),
    reset: () => (h.tags?.pick(null), setWhere({ tab, query: { ...query, tag: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' } })),
    saveView: act('Filters: save as a view'),
  }
  const filters = desk ? (
    <DeskFilters tab={tab} list={h.tags ? { ...query, tag: tag ?? 'all' } : query} set={set} open={filtersOpen} place="" hidden={false} tags={projectTags(tasks)} on={{ ...filterOn, toggle: () => setFiltersOpen(!filtersOpen) }} />
  ) : (
    <FilterStrip set={set} hidden={false} onUnset={(k) => filterOn.unset(k as ListKey)} onReset={filterOn.reset} />
  )
  return (
    <div className="flex h-full flex-col">
      <TaskList
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
              status={query.status}
              organizerOn={m.facts.organizer.on}
              onReset={() => setWhere({ tab, query: { ...query, tag: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' } })}
              onConnect={act('List: connect an agent → Agents')}
              firstRun={{ ...firstSteps(m), ...h.firstRun, on: firstActs }}
            />
          ) : null
        }
        on={on}
      />
    </div>
  )
}
