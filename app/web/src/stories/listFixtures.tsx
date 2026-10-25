// The item list's demo project and how a story draws it: the project's items go through the page's own steps
// (listBody, heldRows, drawRows, listViews) and the page's ItemList draws them. Used by the item list's stories and the
// prototypes.
import type { ReactNode } from 'react'
import { EmptyList, ItemList, type ListEvents } from '../features/list/ItemList'
import { drawRows, listViews } from '../features/list/drawRows'
import { ViewBar } from '../features/list/ViewBar'
import { heldRows, listBody } from '../features/list/rows'
import { queueHead } from '../model/items'
import { NO_FILTERS, type ListQuery } from '../model/route'
import type { Item, SavedView } from '../model/types'
import { searchWords } from '../model/visible'
import type { Tab } from '../model/words'
import { T, item, message, noRowEvents, modelOf } from './fixtures'

export const listOn: ListEvents = { ...noRowEvents, view() {}, ownView() {}, dragStart: () => null, dragOver: () => false, drop() {}, dragEnd() {}, ownMenu() {}, rename() {}, renameStop() {}, subMore() {}, needsMore() {}, archiveAll() {} }
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
  /** drawn at the end of the views' row (a prototype's part not built yet) */
  viewsEnd?: ReactNode
  on?: Partial<ListEvents>
}

export function listOf(items: Item[], tab: Tab, q: Partial<ListQuery>, desk: boolean, h: Holding = {}) {
  const m = modelOf(items)
  const query = { ...NO_FILTERS, ...q }
  const st = { folded: new Set(h.folded), subMore: new Set(h.subMore), needsAll: false, open: h.open ?? null, desk }
  const body = listBody(m, tab, query, st)
  let rows = body.kind === 'rows' ? body.rows : []
  if (h.held) {
    const was = listBody(modelOf(h.held.before), tab, query, st)
    rows = heldRows(was.kind === 'rows' ? was.rows : [], m, tab, query, new Map(Object.entries(h.held.said).map(([n, s]) => [Number(n), s])))
  }
  const words = searchWords(query.q)
  const drawn = drawRows(m, rows, { slug: 'demo', openN: h.open ?? null, selected: new Set(h.selected), words, desk, drafts: new Set(), head: queueHead(m.items), seen: { since: T }, drag: { n: null, at: null }, heldHeight: () => 64 })
  const { views, ownViews } = listViews(m, tab, query, body, { list: h.saved ?? [], edit: -1 })
  const why = body.kind === 'empty' ? body.why : body.kind === 'rows' ? body.empty : undefined
  return (
    <div className="flex h-full flex-col">
      <ItemList
        loading={body.kind === 'loading'}
        desk={desk}
        openN={h.open ?? null}
        views={h.viewsEnd ? null : views}
        ownViews={ownViews}
        rows={drawn}
        top={
          h.viewsEnd ? (
            <>
              {h.top}
              <div className="flex items-center">
                <div className="min-w-0 flex-1">
                  <ViewBar views={views ?? []} own={ownViews} onView={() => {}} />
                </div>
                {h.viewsEnd}
              </div>
            </>
          ) : (
            h.top
          )
        }
        empty={why ? <EmptyList why={why} status={query.status} organizerOn={false} onReset={() => {}} onConnect={() => {}} /> : null}
        on={{ ...listOn, ...h.on }}
      />
    </div>
  )
}
