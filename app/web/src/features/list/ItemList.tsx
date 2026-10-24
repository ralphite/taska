// The item list: the views' row, then its rows in the order of your loop (what waits on you, the agents' queue,
// Later, finished work), or a word on why it is empty. Props only; ItemListContainer gives it the rows.

import { forwardRef, type ReactNode, useLayoutEffect, useRef } from 'react'
import type { Item } from '../../model/types'
import { Empty } from '../../ui/bits'
import { ArchiveAllLine, HeldRow, HiddenKidsLine, ItemRow, NeedsMoreLine, NeedsRow, Zone, type RowEvents, type RowFacts, type RowLook } from './ListRows'
import type { ViewChip } from './rows'
import { ViewBar, type OwnViewChip } from './ViewBar'
import { useRowSwipe, type RowSwipe } from './rowSwipe'

export type DrawnRow =
  | { kind: 'item'; key: string; it: Item; depth: number; band: string; foldable: boolean; folded: boolean; facts: RowFacts; look: RowLook }
  | { kind: 'needs'; key: string; it: Item; depth: number; facts: RowFacts; look: RowLook; excerpt: string }
  | { kind: 'held'; key: string; it: Item; code: string; said: string; height: number }
  | { kind: 'zone'; key: string; zone: string; label: string; n: number }
  | { kind: 'hidden-kids'; key: string; parent: number; depth: number; open: boolean; later: number; done: number }
  | { kind: 'needs-more'; key: string; open: boolean; rest: number }
  | { kind: 'archive-all'; key: string; n: number }

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
  needsMore(): void
  archiveAll(): void
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
  /** under the rows: search hints */
  bottom?: ReactNode
  on: ListEvents
  /** room for the box over the list's end on the phone */
  onScroll?(top: number): void
  /** each item row's element, for its height */
  rowRef?(n: number): (el: HTMLElement | null) => void
  /** an item is being dragged (its rows are marked through their look): off every row it stands on its own */
  dragging?: { out: boolean } | null
  desk?: boolean
  /** the item open beside the list (the desktop; a document's item while it shows): opening another item brings its
   * row into view (not a document, and not when the list changes with it: another tab) */
  openN?: number | null
  /** what is open is the item itself (not its document) */
  itemShown?: boolean
  /** the page opened at the item shows its row too (in Items; an item of Archive or Rules opens at the list's top) */
  firstShows?: boolean
  /** which list this is (its tab) */
  listKey?: string
  /** the phone: a row swipes right to go forward, left to show the ways back */
  swipe?: RowSwipe
}

const NO_SWIPE: RowSwipe = { right: () => null, blocked: () => true }

export const ItemList = forwardRef<HTMLDivElement, ItemListProps>(function ItemList(props, ref) {
  const { loading, views, ownViews, rows, empty, top, bottom, on, onScroll, rowRef, dragging = null, desk = false, swipe, openN = null, itemShown = false, firstShows = false, listKey = '' } = props
  const own = useRef<HTMLDivElement | null>(null)
  const wasOpen = useRef<{ n: number | null; list: string; loading: boolean } | null>(null)
  useLayoutEffect(() => {
    // the item's row comes into view when its rows first show (the page opened at it) and when you go from one item
    // to another in the same list; not for a document, not for another tab
    const was = wasOpen.current
    wasOpen.current = { n: openN, list: listKey, loading }
    if (loading || !itemShown || !desk || openN == null) return
    if (was && !was.loading ? openN === was.n || listKey !== was.list : !firstShows) return
    own.current?.querySelector(`article[data-n="${openN}"] > :first-child`)?.scrollIntoView({ block: 'nearest' })
  }, [openN, desk, listKey, loading, itemShown, firstShows])
  useRowSwipe(own, !desk && !!swipe, swipe ?? NO_SWIPE, rows)
  const rowOf = (t: EventTarget) => (t as Element).closest?.<HTMLElement>('article[data-n]') ?? null
  return (
    <div
      id="list"
      ref={(el) => {
        own.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      {...(dragging?.out ? { 'data-drop-out': '' } : {})}
      onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}
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
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 data-drop-out:bg-blue-50/60 phone:-mb-(--foot-h) phone:pb-[calc(var(--foot-h,0px)+1.5rem)] lg:scrollbar-thin lg:scrollbar-gutter-stable lg:hover:scrollbar-thumb-zinc-500/80 dark:data-drop-out:bg-blue-400/5 dark:lg:hover:scrollbar-thumb-zinc-400/70"
    >
      {loading ? (
        <div className="px-6 py-16 text-center text-sm text-zinc-400">Loading…</div>
      ) : (
        <>
          {top}
          {views ? <ViewBar views={views} own={ownViews} onView={on.view} onOwn={on.ownView} onOwnMenu={on.ownMenu} onRename={on.rename} onRenameStop={on.renameStop} /> : null}
          {rows.map((r) => {
            switch (r.kind) {
              case 'item':
                return <ItemRow key={r.key} it={r.it} depth={r.depth} band={r.band} foldable={r.foldable} folded={r.folded} facts={r.facts} look={r.look} on={on} rowRef={rowRef?.(r.it.n)} />
              case 'needs':
                return <NeedsRow key={r.key} it={r.it} depth={r.depth} facts={r.facts} look={r.look} excerpt={r.excerpt} on={on} rowRef={rowRef?.(r.it.n)} />
              case 'held':
                return <HeldRow key={r.key} it={r.it} code={r.code} said={r.said} height={r.height} on={on} />
              case 'zone':
                return <Zone key={r.key} kind={r.zone} label={r.label} n={r.n} />
              case 'hidden-kids':
                return <HiddenKidsLine key={r.key} depth={r.depth} open={r.open} later={r.later} done={r.done} onToggle={() => on.subMore(r.parent)} />
              case 'needs-more':
                return <NeedsMoreLine key={r.key} open={r.open} rest={r.rest} onToggle={on.needsMore} />
              case 'archive-all':
                return <ArchiveAllLine key={r.key} n={r.n} onArchive={on.archiveAll} />
            }
          })}
          {!rows.length ? empty : null}
          {bottom}
        </>
      )}
    </div>
  )
})

/** The words for an empty list. */
export function EmptyList({ why, status, organizerOn, onReset, onConnect, hints }: {
  why: string
  status: string
  organizerOn: boolean
  onReset(): void
  onConnect(): void
  hints?: ReactNode
}) {
  if (why === 'no-items')
    return (
      <Empty>
        No items yet.
        <br />
        Write your first thought below
        {organizerOn ? ' and the organizer turns it into items' : ' and your coding agent turns it into items'}.
        <br />
        <button onClick={onConnect} className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
          Connect a coding agent
        </button>
      </Empty>
    )
  if (why === 'none') return <Empty>No items</Empty>
  if (why === 'no-rules') return <Empty>No rules</Empty>
  if (why === 'nothing-archived') return <Empty>Nothing archived</Empty>
  if (why === 'no-match' || why === 'no-match-rules')
    return (
      <Empty>
        {why === 'no-match-rules' ? 'No matching rules' : 'No matching items'}
        <span className="mt-3 flex flex-col">{hints}</span>
        <button onClick={onReset} className="mt-3 h-11 text-blue-600 hover:underline dark:text-blue-400">
          Clear search and filters
        </button>
      </Empty>
    )
  return <Empty>{status === 'wait' ? 'Nothing needs you.' : status === 'closed' ? 'Nothing finished yet.' : 'Nothing here.'}</Empty>
}
