// The item list in each of its views (T591: the groups and names Yadong had before the rewrite). A demo project's
// items go through the page's own steps: listBody (which rows, in which order), drawRows (what each row shows) and
// listViews (the views' row), then the page's ItemList draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { queueHead } from '../../model/items'
import { NO_FILTERS, type ListQuery } from '../../model/route'
import type { Item, SavedView } from '../../model/types'
import type { Tab } from '../../model/words'
import { Frames } from '../../stories/Frames'
import { T, item, message, modelOf, noRowEvents } from '../../stories/fixtures'
import { drawRows, listViews } from './drawRows'
import { EmptyList, ItemList, type ListEvents } from './ItemList'
import { listBody } from './rows'

export default { title: 'Components/Item list/Views' } satisfies Meta
type Story = StoryObj

const on: ListEvents = { ...noRowEvents, view() {}, ownView() {}, dragStart: () => null, dragOver: () => false, drop() {}, dragEnd() {}, ownMenu() {}, rename() {}, renameStop() {}, subMore() {}, needsMore() {}, archiveAll() {} }
const agent = { by: 'claude-code', t: T }
const ask = (id: number, text: string) => ({ wait: { id, kind: 'ask' as const, text, by: 'claude-code', files: [] }, thread: [message({ id, kind: 'ask', text })] })

// a project as it is on a usual day: what waits on you, work in progress with its subitems, the queue, later, finished
const PROJECT: Item[] = [
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

function list(items: Item[], tab: Tab, q: Partial<ListQuery>, desk: boolean, saved: readonly SavedView[] = []) {
  const m = modelOf(items)
  const query = { ...NO_FILTERS, ...q }
  const body = listBody(m, tab, query, { folded: new Set(), subMore: new Set(), needsAll: false, open: null, desk })
  const rows = body.kind === 'rows' ? drawRows(m, body.rows, { slug: 'demo', openN: null, selected: new Set(), words: [], desk, drafts: new Set(), head: queueHead(m.items), seen: { since: T }, drag: { n: null, at: null }, heldHeight: () => 0 }) : []
  const { views, ownViews } = listViews(m, tab, query, body, { list: saved, edit: -1 })
  const why = body.kind === 'empty' ? body.why : body.kind === 'rows' ? body.empty : undefined
  return (
    <div className="flex h-full flex-col">
      <ItemList
        loading={body.kind === 'loading'}
        desk={desk}
        views={views}
        ownViews={ownViews}
        rows={rows}
        empty={why ? <EmptyList why={why} status={query.status} organizerOn={false} onReset={() => {}} onConnect={() => {}} /> : null}
        on={on}
      />
    </div>
  )
}

const view = (tab: Tab, q: Partial<ListQuery>, items = PROJECT, saved: readonly SavedView[] = []): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={760}>{(layout) => list(items, tab, q, layout === 'desk', saved)}</Frames>,
})

export const Active = view('items', { status: 'all' })
export const NeedsYou = view('items', { status: 'wait' })
export const All = view('items', { status: 'every' })
export const Queue = view('items', { status: 'queued' })
export const Later = view('items', { status: 'later' })
export const Finished = view('items', { status: 'closed' })
export const Archive = view('archive', {})
export const Rules = view('rules', {})
const bugs: SavedView = { name: 'Bugs first', type: 'bug', when: 'all', status: 'all', pri: 'all', sort: 'all' }
export const YourOwnViews = view('items', { type: 'bug' }, PROJECT, [bugs, { name: 'Later ideas', type: 'idea', when: 'later', status: 'all', pri: 'all', sort: 'all' }])
export const EmptyProject = view('items', { status: 'all' }, [])
export const SmallProject = view('items', { status: 'all' }, [item({ n: 1, title: 'Plan the trip' }), item({ n: 2, status: 'done', title: 'Book the flights' })])

/** Before the project's data comes; and an empty list, for each reason it can be empty. */
export const LoadingAndEveryEmptyList: Story = {
  name: 'Loading, and every empty list',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <div className="flex flex-col divide-y divide-dashed divide-zinc-300 dark:divide-zinc-700">
          <div className="flex h-32 flex-col">
            <ItemList loading views={null} rows={[]} on={on} />
          </div>
          {(['no-items', 'none', 'no-match', 'no-rules', 'nothing-archived', 'empty'] as const).map((why) => (
            <div key={why} className="flex flex-col">
              <ItemList loading={false} views={null} rows={[]} on={on} empty={<EmptyList why={why} status="wait" organizerOn={false} onReset={() => {}} onConnect={() => {}} />} />
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
