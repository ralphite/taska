// The item list: the views' row, then its rows in the order of your loop (what waits on you, the agents' queue,
// Later, finished work), or a word on why it is empty. Props only; ItemListContainer gives it the rows.

import { forwardRef, type ReactNode, useLayoutEffect, useRef } from 'react'
import type { NeedAct } from '../../model/needStates'
import type { Item, RuleProposal } from '../../model/types'
import { Icon, type IconName } from '../../ui/Icon'
import { Empty, Skeleton } from '../../ui/bits'
import { ArchiveAllLine, HiddenKidsLine, ItemRow, NeedsRow, ProposalRow, type RowEvents, type RowFacts, type RowLook } from './ListRows'
import type { ViewChip } from './rows'
import { ViewBar, type OwnViewChip } from './ViewBar'
import { useRowSwipe, type RowSwipe } from '../../ui/rowSwipe'
import { PULL } from '../../ui/tones'

export type DrawnRow =
  | { kind: 'item'; key: string; it: Item; depth: number; band: string; foldable: boolean; folded: boolean; facts: RowFacts; look: RowLook; said?: string }
  | { kind: 'needs'; key: string; it: Item; depth: number; facts: RowFacts; look: RowLook; excerpt: string; said?: string; act?: NeedAct }
  | { kind: 'hidden-kids'; key: string; parent: number; depth: number; open: boolean; later: number }
  | { kind: 'archive-all'; key: string; n: number }
  | { kind: 'proposal'; key: string; p: RuleProposal }

export interface ListEvents extends RowEvents {
  view(value: string): void
  ownView(i: number): void
  /** an item dragged in the list (the desktop, with a mouse): -> its code, if it can be */
  dragStart(n: number): string | null
  /** over row `n` (at `y`, 0 its top to 1 its bottom) or over no row: -> it can go there */
  dragOver(n: number | null, y: number): boolean
  drop(): void
  dragEnd(): void
  ownMenu(i: number, x: number, y: number): void
  rename(i: number, name: string): void
  renameStop(): void
  subMore(parent: number): void
  archiveAll(): void
  /** an agent's proposed change to the rules: opened (I693) */
  proposal(p: number): void
}

export interface ItemListProps {
  loading: boolean
  views: ViewChip[] | null
  ownViews?: OwnViewChip[]
  rows: DrawnRow[]
  /** shown when there are no rows */
  empty?: ReactNode
  /** above the rows: the bar of what is selected */
  top?: ReactNode
  /** at the start of the views' row (the desktop's Filters button, F670) */
  viewsLead?: ReactNode
  /** the desktop's views row opened onto all its lines (⌄, ⌃; F670) */
  viewsMore?: { open: boolean; toggle(): void }
  on: ListEvents
  /** room for the box over the list's end on the phone */
  /** an item is being dragged (its rows are marked through their look): off every row it stands on its own */
  dragging?: { out: boolean } | null
  desk?: boolean
  /** the item open beside the list (the desktop; a document's item while it shows): opening another item brings its
   * row into view (not a document, and not when the list changes with it: another tab) */
  openN?: number | null
  /** what is open is the item itself (not its document) */
  itemShown?: boolean
  /** which list this is (its tab) */
  listKey?: string
  /** the phone: a row swipes right to go forward, left to show the ways back */
  swipe?: RowSwipe
}

const NO_SWIPE: RowSwipe = { right: () => null, blocked: () => true }

/** What the rows show, as one string: it changes when the list is drawn anew (a row comes, goes or moves, its item
 * changes: Done, Later, Won't do, a subitem done), not each time the page draws it the same (T589 #10486). */
export function drawingKey(rows: DrawnRow[]): string {
  return rows
    .map((r) => {
      if (r.kind !== 'item' && r.kind !== 'needs') return JSON.stringify(r)
      const it = r.it
      return [r.key, it.status, it.when, it.later_until ?? '', it.archived ? 1 : 0, it.wait ? 1 : 0, it.t1, r.facts.openKids, r.said ?? ''].join(':')
    })
    .join(',')
}

export const ItemList = forwardRef<HTMLDivElement, ItemListProps>(function ItemList(props, ref) {
  const { loading, views, ownViews, rows, empty, top, viewsLead, viewsMore, on, dragging = null, desk = false, swipe, openN = null, itemShown = false, listKey = '' } = props
  const own = useRef<HTMLDivElement | null>(null)
  const wasOpen = useRef<{ n: number | null; list: string; loading: boolean } | null>(null)
  /** the page opened at an item: its row comes into view the first time it shows, in whichever list it is */
  const first = useRef<boolean | null>(null)
  useLayoutEffect(() => {
    // and when you go from one item to another in the same list; not for a document, not for another tab. It is done
    // as the rows are drawn, before the browser has laid out those it does not show yet, as the page always has.
    const was = wasOpen.current
    wasOpen.current = { n: openN, list: listKey, loading }
    if (first.current === null && !loading) first.current = itemShown && openN != null
    if (loading || !itemShown || !desk || openN == null) return
    const row = own.current?.querySelector(`article[data-n="${openN}"] > :first-child`)
    if (first.current) {
      // braces: scrollIntoView may return a promise, and an effect may return only a clean-up
      if (row) {
        first.current = false
        row.scrollIntoView({ block: 'nearest' })
      }
      return
    }
    if (!was || was.loading || openN === was.n || listKey !== was.list) return
    row?.scrollIntoView({ block: 'nearest' })
  }, [openN, desk, listKey, loading, itemShown, rows])
  useRowSwipe(own, !desk && !!swipe, swipe ?? NO_SWIPE, drawingKey(rows))
  const rowOf = (t: EventTarget) => (t as Element).closest?.<HTMLElement>('article[data-n]') ?? null
  return (
    // The views' row is above the list, not in it: the list scrolls and bounces (the phone's pull at its top) under it,
    // and the row never moves (B758)
    <div id="list" className="flex min-h-0 flex-1 flex-col">
      {loading ? null : top}
      {views && !loading ? (
        // the desktop: as high as the pane's bar beside it, one line under both (B669); opened, as tall as its lines
        <div className="flex shrink-0 items-stretch lg:min-h-bar">
          <div className="min-w-0 flex-1">
            <ViewBar views={views} own={ownViews} lead={viewsLead} more={viewsMore} onView={on.view} onOwn={on.ownView} onOwnMenu={on.ownMenu} onRename={on.rename} onRenameStop={on.renameStop} />
          </div>
        </div>
      ) : null}
    <div
      ref={(el) => {
        own.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      data-list-scroll
      {...(dragging?.out ? { 'data-drop-out': '' } : {})}
      onPointerDown={(e) => {
        // only a mouse drags a row (a finger scrolls and swipes)
        const a = rowOf(e.target)
        if (a) a.draggable = desk && e.pointerType === 'mouse' && !(e.target as Element).closest('button, a, input, textarea')
      }}
      onDragStart={(e) => {
        const a = rowOf(e.target)
        const code = a ? on.dragStart(Number(a.dataset.n)) : null
        if (!code) return e.preventDefault()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', code)
      }}
      onDragOver={(e) => {
        if (!dragging) return
        const a = rowOf(e.target)
        const r = a?.getBoundingClientRect()
        if (!on.dragOver(a ? Number(a.dataset.n) : null, r ? (e.clientY - r.top) / r.height : 0)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        if (!dragging) return
        e.preventDefault()
        on.drop()
      }}
      onDragEnd={() => on.dragEnd()}
      className={`${PULL} min-h-0 flex-1 overflow-y-auto outline-none overscroll-contain pb-6 data-drop-out:bg-blue-50/60 phone:-mb-(--foot-h) phone:pb-[calc(var(--foot-h,0px)+var(--float-h,0px)+1.5rem)] lg:scrollbar-thin lg:scrollbar-gutter-stable lg:hover:scrollbar-thumb-zinc-500/80 dark:data-drop-out:bg-blue-400/5 dark:lg:hover:scrollbar-thumb-zinc-400/70`}
    >
      {loading ? (
        <Skeleton shape="item" n={6} />
      ) : (
        <>
          {rows.map((r) => {
            switch (r.kind) {
              case 'item':
                return <ItemRow key={r.key} it={r.it} depth={r.depth} band={r.band} foldable={r.foldable} folded={r.folded} facts={r.facts} look={r.look} said={r.said} on={on} />
              case 'needs':
                return <NeedsRow key={r.key} it={r.it} depth={r.depth} facts={r.facts} look={r.look} excerpt={r.excerpt} said={r.said} act={r.act} on={on} />
              case 'hidden-kids':
                return <HiddenKidsLine key={r.key} parent={r.parent} depth={r.depth} open={r.open} later={r.later} onToggle={() => on.subMore(r.parent)} />
              case 'archive-all':
                return <ArchiveAllLine key={r.key} n={r.n} onArchive={on.archiveAll} />
              case 'proposal':
                return <ProposalRow key={r.key} p={r.p} onOpen={() => on.proposal(r.p.id)} />
            }
          })}
          {!rows.length ? empty : null}
        </>
      )}
    </div>
    </div>
  )
})

/** The words for an empty list. */
/** An empty project's first steps (D115 #20): each ticks itself once done; with all done, the list's own words. */
export interface FirstSteps {
  agent: boolean
  input: boolean
  phone: boolean
  on: { connect(): void; say(): void; phone(): void }
}

function FirstRun({ steps }: { steps: FirstSteps }) {
  const step = (done: boolean, label: string, icon: IconName, run: () => void) => (
    <li>
      <button onClick={run} disabled={done} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800">
        {done ? <Icon n="check" c="size-5 text-emerald-600 dark:text-emerald-400" sw="2.5" /> : <span className="size-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />}
        <span className={`flex-1 ${done ? 'text-zinc-500 line-through decoration-zinc-300 dark:text-zinc-400 dark:decoration-zinc-600' : 'font-medium'}`}>{label}</span>
        {done ? null : <Icon n={icon} c="size-4 text-zinc-400" />}
      </button>
    </li>
  )
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <ol aria-label="First steps" className="flex flex-col gap-1">
        {step(steps.agent, 'Connect an agent', 'bot', steps.on.connect)}
        {step(steps.input, 'Say your first input', 'mic', steps.on.say)}
        {step(steps.phone, 'Use on your phone', 'phone', steps.on.phone)}
      </ol>
    </div>
  )
}

export function EmptyList({ why, status, organizerOn, onReset, onConnect, firstRun = null }: {
  why: string
  status: string
  organizerOn: boolean
  onReset(): void
  onConnect(): void
  /** an empty project's first steps, until all are done */
  firstRun?: FirstSteps | null
}) {
  if (why === 'no-items' && firstRun && !(firstRun.agent && firstRun.input && firstRun.phone)) return <FirstRun steps={firstRun} />
  if (why === 'no-items')
    return (
      <Empty>
        No items yet.
        <br />
        Write below; {organizerOn ? 'the organizer' : 'your agent'} turns it into items.
        <br />
        <button onClick={onConnect} className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
          Connect a coding agent
        </button>
      </Empty>
    )
  if (why === 'none') return <Empty>No items</Empty>
  if (why === 'nothing-archived') return <Empty>Nothing archived</Empty>
  if (why === 'no-match')
    return (
      <Empty>
        No matching items
        <button onClick={onReset} className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
          Clear filters
        </button>
      </Empty>
    )
  return <Empty>{status === 'wait' ? 'Nothing needs you' : status === 'done' ? 'Nothing done yet' : status === 'dropped' ? "Nothing marked won't do" : 'Nothing here'}</Empty>
}
